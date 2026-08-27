/**
 * Tests de `lib/facturacion.ts`.
 *
 * Corre sin navegador y sin dependencias: node:test + type-stripping nativo.
 *
 * Lo que más importa acá es `accionesPara()`. Es la única fuente de verdad de
 * qué ve cada rol, y un error suyo se traduce directo en un botón que un
 * viewer no debería tener. Por eso el bloque de permisos prueba los tres roles
 * contra los seis estados, no una muestra.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizar, coincideBusqueda, aplicarFiltros, soloFacturas, ordenar,
  contarPorTipo, calcularTotales, opcionesAnio, opcionesUnidad, opcionesPuntoVenta,
  estadosPresentes, chipsActivos, contarFiltros, hayFiltros,
  accionesPara, accionPrimaria, muestraDesagregado, fechaCorta,
  puntoVentaDe, esARS, esUSD, FILTROS_INICIALES,
  type FiltrosFacturacion,
} from '../src/lib/facturacion.ts'
import { puede } from '../src/design/permissions.ts'
import { ESTADOS_ORDEN, estadoLabel } from '../src/design/status.ts'

// ── Fixtures ────────────────────────────────────────────────────────────────
let n = 4000
function f(over: Partial<any> = {}): any {
  n++
  return {
    id: `FC-A-${n}`, tipo: 'FACT A', numero: n, fecha: '2026-08-01',
    cliente: 'CLIENTE SA', persona: 'TORIBIO ACHAVAL', concepto: null,
    monto_ars: 100_000, monto_usd: null, tipo_cambio: null,
    neto_ars: 82_644, neto_usd: null, iva: 17_356,
    arba_ars: null, arba_usd: null, estado: 'pendiente',
    recibo_id: null, fecha_cobro: null, punto_venta: '0002',
    created_at: '2026-08-01T00:00:00Z',
    ...over,
  }
}

const filtros = (over: Partial<FiltrosFacturacion> = {}): FiltrosFacturacion =>
  ({ ...FILTROS_INICIALES, ...over })

// ── Búsqueda ────────────────────────────────────────────────────────────────

test('normalizar saca acentos y mayúsculas', () => {
  assert.equal(normalizar('Consultoría'), 'consultoria')
  assert.equal(normalizar('MAGNASCO'), 'magnasco')
  assert.equal(normalizar(null), '')
})

test('la búsqueda encuentra por número parcial', () => {
  const c = f({ numero: 4261 })
  assert.equal(coincideBusqueda(c, '426'), true)
  assert.equal(coincideBusqueda(c, '4261'), true)
  assert.equal(coincideBusqueda(c, '9999'), false)
})

test('la búsqueda encuentra por cliente sin importar acentos ni caja', () => {
  const c = f({ cliente: 'FIDEICOMISO HUDSÓN LAGOON' })
  assert.equal(coincideBusqueda(c, 'hudson'), true)
  assert.equal(coincideBusqueda(c, 'LAGOON'), true)
})

test('la búsqueda encuentra por unidad y por concepto', () => {
  const c = f({ persona: 'CONSULTORIA', concepto: 'Honorarios de agosto' })
  assert.equal(coincideBusqueda(c, 'consultoria'), true)
  assert.equal(coincideBusqueda(c, 'honorarios'), true)
})

test('búsqueda vacía no filtra nada', () => {
  assert.equal(coincideBusqueda(f(), ''), true)
  assert.equal(coincideBusqueda(f(), '   '), true)
})

// ── Filtros ─────────────────────────────────────────────────────────────────

test('filtra por año', () => {
  const cs = [f({ fecha: '2026-01-05' }), f({ fecha: '2025-11-20' })]
  assert.equal(aplicarFiltros(cs, filtros({ anio: '2026' })).length, 1)
})

test('filtra por unidad', () => {
  const cs = [f({ persona: 'CONSULTORIA' }), f({ persona: 'TORIBIO ACHAVAL' })]
  assert.equal(aplicarFiltros(cs, filtros({ unidad: 'CONSULTORIA' })).length, 1)
})

test('filtra por punto de venta, con 0002 por defecto', () => {
  const cs = [f({ punto_venta: '' }), f({ punto_venta: '0004' })]
  assert.equal(puntoVentaDe(cs[0]), '0002')
  assert.equal(aplicarFiltros(cs, filtros({ puntoVenta: '0002' })).length, 1)
  assert.equal(aplicarFiltros(cs, filtros({ puntoVenta: '0004' })).length, 1)
})

test('filtra por moneda: ARS excluye las que tienen USD', () => {
  const soloPesos = f({ monto_ars: 1000, monto_usd: null })
  const conDolar  = f({ monto_ars: 1000, monto_usd: 10 })
  assert.equal(esARS(soloPesos), true)
  assert.equal(esARS(conDolar), false)
  assert.equal(esUSD(conDolar), true)
  const cs = [soloPesos, conDolar]
  assert.equal(aplicarFiltros(cs, filtros({ moneda: 'ars' })).length, 1)
  assert.equal(aplicarFiltros(cs, filtros({ moneda: 'usd' })).length, 1)
})

test('el filtro de estados es multi-select y vacío significa todos', () => {
  const cs = [f({ estado: 'pendiente' }), f({ estado: 'cobrada' }), f({ estado: 'anulada' })]
  assert.equal(aplicarFiltros(cs, filtros({ estados: [] })).length, 3)
  assert.equal(aplicarFiltros(cs, filtros({ estados: ['pendiente'] })).length, 1)
  assert.equal(aplicarFiltros(cs, filtros({ estados: ['pendiente', 'cobrada'] })).length, 2)
})

test('búsqueda y filtros se combinan sobre el mismo universo', () => {
  // La regresión que motivó unificar: antes la búsqueda iba al servidor y los
  // filtros a memoria, así que este cruce podía devolver filas fantasma.
  const cs = [
    f({ cliente: 'MAGNASCO BROKERS', estado: 'pendiente', fecha: '2026-08-01' }),
    f({ cliente: 'MAGNASCO BROKERS', estado: 'cobrada',   fecha: '2026-08-01' }),
    f({ cliente: 'OTRO CLIENTE',     estado: 'pendiente', fecha: '2026-08-01' }),
    f({ cliente: 'MAGNASCO BROKERS', estado: 'pendiente', fecha: '2025-08-01' }),
  ]
  const r = aplicarFiltros(cs, filtros({ buscar: 'magnasco', estados: ['pendiente'], anio: '2026' }))
  assert.equal(r.length, 1)
  assert.equal(r[0].cliente, 'MAGNASCO BROKERS')
})

test('soloFacturas descarta NC y ND', () => {
  const cs = [f({ tipo: 'FACT A' }), f({ tipo: 'NC' }), f({ tipo: 'ND' }), f({ tipo: 'FACT B' })]
  assert.equal(soloFacturas(cs).length, 2)
})

test('ordena por número descendente sin mutar el original', () => {
  const cs = [f({ numero: 10 }), f({ numero: 30 }), f({ numero: 20 })]
  const r = ordenar(cs)
  assert.deepEqual(r.map(x => x.numero), [30, 20, 10])
  assert.deepEqual(cs.map(x => x.numero), [10, 30, 20])
})

// ── Conteos y totales ───────────────────────────────────────────────────────

test('contarPorTipo cuenta los cuatro tipos', () => {
  const cs = [f({ tipo: 'FACT A' }), f({ tipo: 'FACT A' }), f({ tipo: 'FACT B' }), f({ tipo: 'FACT E' })]
  const r = contarPorTipo(cs)
  assert.equal(r['FACT A'], 2)
  assert.equal(r['FACT B'], 1)
  assert.equal(r['FACT DE CREDITO'], 0)
  assert.equal(r['FACT E'], 1)
})

test('los totales excluyen anuladas de los importes pero las cuentan', () => {
  const cs = [
    f({ monto_ars: 100, estado: 'cobrada' }),
    f({ monto_ars: 900, estado: 'anulada' }),
  ]
  const t = calcularTotales(cs)
  assert.equal(t.ars, 100)
  assert.equal(t.cantidad, 2)
})

test('los totales separan pendientes de faltan_retenciones', () => {
  // Son conceptos distintos: en una el dinero no entró, en la otra sí.
  const cs = [
    f({ estado: 'pendiente' }), f({ estado: 'pendiente' }),
    f({ estado: 'faltan_retenciones' }),
  ]
  const t = calcularTotales(cs)
  assert.equal(t.pendientes, 2)
  assert.equal(t.faltanRetenciones, 1)
})

test('el total USD suma sólo las que tienen importe en dólares', () => {
  const cs = [f({ monto_usd: 100 }), f({ monto_usd: null }), f({ monto_usd: 50 })]
  const t = calcularTotales(cs)
  assert.equal(t.usd, 150)
  assert.equal(t.cantidadUSD, 2)
})

// ── Opciones derivadas ──────────────────────────────────────────────────────

test('las opciones de año salen de los datos, descendente', () => {
  const cs = [f({ fecha: '2024-01-01' }), f({ fecha: '2026-05-05' }), f({ fecha: '2026-08-08' })]
  assert.deepEqual(opcionesAnio(cs), ['2026', '2024'])
})

test('opciones de unidad y punto de venta sin repetidos', () => {
  const cs = [
    f({ persona: 'CONSULTORIA', punto_venta: '0002' }),
    f({ persona: 'CONSULTORIA', punto_venta: '0004' }),
    f({ persona: 'TORIBIO ACHAVAL', punto_venta: '' }),
  ]
  assert.deepEqual(opcionesUnidad(cs), ['CONSULTORIA', 'TORIBIO ACHAVAL'])
  assert.deepEqual(opcionesPuntoVenta(cs), ['0002', '0004'])
})

test('estadosPresentes incluye emitida cuando existe de verdad', () => {
  // El bug original: `emitida` no estaba entre los chips y sus comprobantes
  // eran invisibles salvo que no filtraras por estado.
  const cs = [f({ estado: 'pendiente' }), f({ estado: 'emitida' })]
  const r = estadosPresentes(cs, ESTADOS_ORDEN)
  assert.ok(r.includes('emitida'))
  assert.equal(r.length, 2)
})

test('estadosPresentes no ofrece estados que no existen en los datos', () => {
  const cs = [f({ estado: 'cobrada' })]
  assert.deepEqual(estadosPresentes(cs, ESTADOS_ORDEN), ['cobrada'])
})

test('estadosPresentes respeta el orden operativo, no el de aparición', () => {
  const cs = [f({ estado: 'anulada' }), f({ estado: 'pendiente' })]
  assert.deepEqual(estadosPresentes(cs, ESTADOS_ORDEN), ['pendiente', 'anulada'])
})

// ── Chips de filtro ─────────────────────────────────────────────────────────

test('los chips activos usan etiquetas humanas, nunca snake_case', () => {
  const chips = chipsActivos(filtros({ estados: ['faltan_retenciones'] }), estadoLabel)
  assert.equal(chips.length, 1)
  assert.equal(chips[0].label, 'Faltan retenciones')
  assert.ok(!chips[0].label.includes('_'))
})

test('cada chip sabe qué filtro limpiar', () => {
  const chips = chipsActivos(
    filtros({ anio: '2026', unidad: 'CONSULTORIA', moneda: 'usd', estados: ['pendiente'] }),
    estadoLabel,
  )
  assert.deepEqual(chips.map(c => c.clave), ['anio', 'unidad', 'moneda', 'estados'])
  assert.equal(chips.find(c => c.clave === 'estados')!.valor, 'pendiente')
})

test('el contador del botón Filtros ignora la búsqueda', () => {
  // El texto ya se ve escrito en su campo: contarlo dos veces confunde.
  assert.equal(contarFiltros(filtros({ buscar: 'algo' })), 0)
  assert.equal(contarFiltros(filtros({ estados: ['pendiente', 'cobrada'], anio: '2026' })), 3)
})

test('hayFiltros sí considera la búsqueda', () => {
  assert.equal(hayFiltros(FILTROS_INICIALES), false)
  assert.equal(hayFiltros(filtros({ buscar: 'x' })), true)
})

// ── Permisos ────────────────────────────────────────────────────────────────

const permisosDe = (rol: string | null) => (a: any) => puede(rol, a)
const ESTADOS_TODOS = ESTADOS_ORDEN

test('un viewer no recibe NINGUNA acción de escritura, en ningún estado', () => {
  for (const estado of ESTADOS_TODOS) {
    const acciones = accionesPara(f({ estado }), permisosDe('viewer'))
    assert.deepEqual(
      acciones, [],
      `el viewer recibió ${acciones.map(a => a.id).join(',')} en estado ${estado}`,
    )
  }
})

test('un viewer no tiene acción primaria: la tarjeta mobile no ofrece nada', () => {
  for (const estado of ESTADOS_TODOS) {
    assert.equal(accionPrimaria(f({ estado }), permisosDe('viewer')), null)
  }
})

test('un editor puede cobrar y editar pero NUNCA eliminar', () => {
  for (const estado of ESTADOS_TODOS) {
    const ids = accionesPara(f({ estado }), permisosDe('editor')).map(a => a.id)
    assert.ok(!ids.includes('eliminar'), `el editor podía eliminar en estado ${estado}`)
  }
  const ids = accionesPara(f({ estado: 'pendiente' }), permisosDe('editor')).map(a => a.id)
  assert.ok(ids.includes('cobrar'))
  assert.ok(ids.includes('editar'))
})

test('un admin sí puede eliminar', () => {
  const ids = accionesPara(f({ estado: 'cobrada' }), permisosDe('admin')).map(a => a.id)
  assert.ok(ids.includes('eliminar'))
})

test('un rol nulo se trata como viewer', () => {
  assert.deepEqual(accionesPara(f(), permisosDe(null)), [])
})

// ── Acciones por estado ─────────────────────────────────────────────────────

const admin = permisosDe('admin')

test('pendiente ofrece Registrar cobro como acción primaria', () => {
  const p = accionPrimaria(f({ estado: 'pendiente' }), admin)
  assert.equal(p?.id, 'cobrar')
  assert.equal(p?.label, 'Registrar cobro')
})

test('faltan_retenciones ofrece Completar cobro, no Registrar cobro', () => {
  // El dinero ya entró: pedirle "registrar cobro" otra vez es mentirle
  // al usuario sobre qué le falta.
  const p = accionPrimaria(f({ estado: 'faltan_retenciones' }), admin)
  assert.equal(p?.id, 'cobrar')
  assert.equal(p?.label, 'Completar cobro')
})

test('echeq_pendiente ofrece Confirmar acreditación', () => {
  const p = accionPrimaria(f({ estado: 'echeq_pendiente' }), admin)
  assert.equal(p?.id, 'acreditacion')
})

test('cobrada no ofrece acción primaria: el circuito está cerrado', () => {
  assert.equal(accionPrimaria(f({ estado: 'cobrada' }), admin), null)
})

test('las retenciones se gestionan sólo cuando el dinero ya entró', () => {
  const con = ['cobrada', 'faltan_retenciones']
  for (const estado of ESTADOS_TODOS) {
    const ids = accionesPara(f({ estado }), admin).map(a => a.id)
    assert.equal(
      ids.includes('retenciones'), con.includes(estado),
      `retenciones mal ofrecida en estado ${estado}`,
    )
  }
})

test('una anulada no se edita ni se vuelve a anular', () => {
  const ids = accionesPara(f({ estado: 'anulada' }), admin).map(a => a.id)
  assert.ok(!ids.includes('editar'))
  assert.ok(!ids.includes('anular'))
  assert.ok(!ids.includes('cobrar'))
})

test('eliminar está marcada como peligrosa', () => {
  const a = accionesPara(f(), admin).find(x => x.id === 'eliminar')
  assert.equal(a?.peligrosa, true)
})

test('hay a lo sumo una acción primaria', () => {
  for (const estado of ESTADOS_TODOS) {
    const n = accionesPara(f({ estado }), admin).filter(a => a.primaria).length
    assert.ok(n <= 1, `${n} acciones primarias en estado ${estado}`)
  }
})

// ── Presentación ────────────────────────────────────────────────────────────

test('las FACT B no muestran neto ni IVA desagregados', () => {
  assert.equal(muestraDesagregado('FACT B'), false)
  assert.equal(muestraDesagregado('FACT A'), true)
})

test('fechaCorta deja día y mes, y tolera nulos', () => {
  assert.equal(fechaCorta('2026-08-26'), '26/08')
  assert.equal(fechaCorta(null), '—')
  assert.equal(fechaCorta(''), '—')
})
