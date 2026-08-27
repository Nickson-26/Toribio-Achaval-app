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
  calcularSenales, resumenHoy, pagosDelDia, esperandoRetenciones,
  echeqsPorAcreditar, pendientesDeCobro, pendientesAntiguas,
  tipoInicialPara, diasDesde, arsCorto, DIAS_ANTIGUEDAD,
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

test('faltan_retenciones no vuelve a pedir "registrar cobro"', () => {
  // El dinero ya entró: pedirle registrar el cobro otra vez es mentirle al
  // usuario sobre qué le falta. Lo que falta es el recibo — ver el bloque de
  // señales, donde se afina el label.
  const p = accionPrimaria(f({ estado: 'faltan_retenciones' }), admin)
  assert.equal(p?.id, 'cobrar')
  assert.ok(!/registrar cobro/i.test(p!.label))
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

/* ══════════════════════════════════════════════════════════════════════════
   SEÑALES OPERATIVAS
   ══════════════════════════════════════════════════════════════════════════ */

const HOY = new Date('2026-08-27T12:00:00Z')

// Fixtures con la forma real que tienen los datos en producción.
const pagada = (over = {}) => f({
  estado: 'cobrada', pago_recibido: true, recibo_id: 19300,
  fecha_cobro: '2026-08-20', ...over,
})
const conRetencionesPendientes = (over = {}) => f({
  estado: 'faltan_retenciones', pago_recibido: true, recibo_id: null,
  fecha_pago: '2026-08-25', medio_pago: 'transferencia', ...over,
})
const pendiente = (over = {}) => f({ estado: 'pendiente', pago_recibido: false, ...over })

test('esperandoRetenciones detecta pago recibido sin recibo', () => {
  const cs = [pagada(), conRetencionesPendientes(), pendiente()]
  const r = esperandoRetenciones(cs)
  assert.equal(r.length, 1)
  assert.equal(r[0].estado, 'faltan_retenciones')
})

test('esperandoRetenciones se calcula por circuito, no por etiqueta', () => {
  // La condición es "pago recibido y sin recibo". Si algún día un estado
  // distinto cae en esa situación, la señal lo tiene que ver igual.
  const raro = f({ estado: 'emitida', pago_recibido: true, recibo_id: null })
  assert.equal(esperandoRetenciones([raro]).length, 1)
})

test('esperandoRetenciones ignora las anuladas', () => {
  const anulada = f({ estado: 'anulada', pago_recibido: true, recibo_id: null })
  assert.equal(esperandoRetenciones([anulada]).length, 0)
})

test('una cobrada con recibo no está esperando nada', () => {
  assert.equal(esperandoRetenciones([pagada()]).length, 0)
})

test('pendientesAntiguas usa el umbral de 60 días', () => {
  assert.equal(DIAS_ANTIGUEDAD, 60)
  const vieja  = pendiente({ fecha: '2026-05-01' })   // ~118 días
  const nueva  = pendiente({ fecha: '2026-08-20' })   // 7 días
  const justo  = pendiente({ fecha: '2026-06-28' })   // 60 días exactos
  const r = pendientesAntiguas([vieja, nueva, justo], HOY)
  assert.equal(r.length, 1)
  assert.equal(r[0].fecha, '2026-05-01')
})

test('las señales con cero casos NO aparecen', () => {
  // El requisito explícito: nada de tarjetas diciendo "0".
  const soloCobradas = [pagada(), pagada()]
  assert.deepEqual(calcularSenales(soloCobradas, HOY), [])
})

test('e-cheq no aparece cuando no hay ninguno, y aparece cuando lo hay', () => {
  assert.equal(calcularSenales([pendiente()], HOY).some(s => s.id === 'echeq'), false)
  const conEcheq = [f({ estado: 'echeq_pendiente' })]
  assert.equal(calcularSenales(conEcheq, HOY).some(s => s.id === 'echeq'), true)
})

test('la señal de e-cheq no promete una fecha de acreditación', () => {
  // referencia_pago está vacío en toda la base: inventar un "próximo: hoy"
  // sería peor que no decir nada.
  const s = calcularSenales([f({ estado: 'echeq_pendiente' })], HOY)
    .find(x => x.id === 'echeq')!
  assert.ok(!/próximo|acredita el|\d{2}\/\d{2}/i.test(s.detalle + (s.nota ?? '')))
})

test('la señal de retenciones aclara que el pago ya entró', () => {
  const s = calcularSenales([conRetencionesPendientes()], HOY).find(x => x.id === 'retenciones')!
  assert.equal(s.nota, 'El pago ya entró')
  assert.ok(/sin recibo/i.test(s.detalle))
})

test('la señal de pendientes informa la antigüedad sólo si existe', () => {
  const conViejas = calcularSenales([pendiente({ fecha: '2026-01-10' })], HOY)
    .find(s => s.id === 'pendientes')!
  assert.ok(/más de 60 días/.test(conViejas.nota ?? ''))

  const sinViejas = calcularSenales([pendiente({ fecha: '2026-08-25' })], HOY)
    .find(s => s.id === 'pendientes')!
  assert.equal(sinViejas.nota, undefined)
})

test('cada señal sabe con qué estados abrir la lista', () => {
  const cs = [conRetencionesPendientes(), pendiente(), f({ estado: 'echeq_pendiente' })]
  const s = calcularSenales(cs, HOY)
  assert.deepEqual(s.find(x => x.id === 'retenciones')!.estados, ['faltan_retenciones'])
  assert.deepEqual(s.find(x => x.id === 'pendientes')!.estados, ['pendiente'])
  assert.deepEqual(s.find(x => x.id === 'echeq')!.estados, ['echeq_pendiente'])
})

test('las señales van en orden de urgencia operativa', () => {
  const cs = [pendiente(), f({ estado: 'echeq_pendiente' }), conRetencionesPendientes()]
  assert.deepEqual(calcularSenales(cs, HOY).map(s => s.id), ['retenciones', 'echeq', 'pendientes'])
})

test('los montos de las señales suman sólo sus propios casos', () => {
  const cs = [
    conRetencionesPendientes({ monto_ars: 1_000_000 }),
    pendiente({ monto_ars: 500_000 }),
    pagada({ monto_ars: 9_999_999 }),
  ]
  const s = calcularSenales(cs, HOY)
  assert.equal(s.find(x => x.id === 'retenciones')!.montoARS, 1_000_000)
  assert.equal(s.find(x => x.id === 'pendientes')!.montoARS, 500_000)
})

/* ── Hoy ─────────────────────────────────────────────────────────────────── */

test('un pago cuenta hoy si su fecha_cobro es hoy', () => {
  assert.equal(pagosDelDia([pagada({ fecha_cobro: '2026-08-27' })], '2026-08-27').length, 1)
})

test('un pago cuenta hoy si su fecha_pago es hoy, aunque no tenga fecha_cobro', () => {
  // Es el caso real de producción: los 2 pagos de hoy sólo tienen fecha_pago,
  // porque están en la rama "pagó pero falta el recibo". Mirar un solo campo
  // los dejaba afuera.
  const c = conRetencionesPendientes({ fecha_cobro: null, fecha_pago: '2026-08-27' })
  assert.equal(pagosDelDia([c], '2026-08-27').length, 1)
})

test('los pagos de hoy no cuentan comprobantes anulados', () => {
  const c = f({ estado: 'anulada', fecha_cobro: '2026-08-27' })
  assert.equal(pagosDelDia([c], '2026-08-27').length, 0)
})

test('resumenHoy separa pagos de facturas emitidas', () => {
  const cs = [
    pagada({ fecha_cobro: '2026-08-27' }),
    f({ fecha: '2026-08-27', estado: 'pendiente' }),
    pagada({ fecha_cobro: '2026-08-01' }),
  ]
  const r = resumenHoy(cs, HOY)
  assert.equal(r.pagos, 1)
  assert.equal(r.emitidas, 1)
  assert.equal(r.hayAlgo, true)
})

test('resumenHoy avisa cuando no pasó nada, con el contexto de la semana', () => {
  const cs = [pagada({ fecha_cobro: '2026-08-24' }), pagada({ fecha_cobro: '2026-08-25' })]
  const r = resumenHoy(cs, HOY)
  assert.equal(r.pagos, 0)
  assert.equal(r.hayAlgo, false)
  assert.equal(r.pagosSemana, 2)
})

/* ── Tipo contextual al crear ────────────────────────────────────────────── */

test('la factura nueva hereda el tipo de la vista en la que estás', () => {
  assert.equal(tipoInicialPara('FACT B'), 'FACT B')
  assert.equal(tipoInicialPara('FACT A'), 'FACT A')
  assert.equal(tipoInicialPara('FACT DE CREDITO'), 'FACT DE CREDITO')
  assert.equal(tipoInicialPara('FACT E'), 'FACT E')
})

test('un tipo desconocido cae en FACT A y no rompe el formulario', () => {
  assert.equal(tipoInicialPara('CUALQUIER COSA' as any), 'FACT A')
})

/* ── Acciones, después de la reformulación ───────────────────────────────── */

/* ── Emitir recibo: la acción se ata al dato, no a la etiqueta ──────────────
   Criterio de producto: si el pago ya entró y todavía no hay recibo, lo
   principal es emitirlo. Que las retenciones estén pendientes es información
   del circuito, no el siguiente paso. */

test('faltan_retenciones SIN recibo ofrece Emitir recibo como primaria', () => {
  const p = accionPrimaria(conRetencionesPendientes({ recibo_id: null }), admin)
  assert.equal(p?.id, 'cobrar')
  assert.equal(p?.label, 'Emitir recibo')
})

test('faltan_retenciones CON recibo NO vuelve a ofrecer emitirlo', () => {
  // Ofrecer "Emitir recibo" sobre algo que ya tiene recibo es invitar a
  // duplicarlo. La condición es el dato, no el estado.
  const as = accionesPara(conRetencionesPendientes({ recibo_id: 19310 }), admin)
  assert.ok(!as.some(a => a.id === 'cobrar'), 'ofreció cobrar teniendo recibo')
  assert.ok(!as.some(a => /emitir recibo/i.test(a.label)))
})

test('con el recibo ya emitido, cargar retenciones pasa a ser la primaria', () => {
  // Es lo único que queda para cerrar, y no puede dejar una `cobrada` sin
  // recibo porque el recibo ya existe.
  const p = accionPrimaria(conRetencionesPendientes({ recibo_id: 19310 }), admin)
  assert.equal(p?.id, 'retenciones')
})

test('sin recibo, cargar retenciones existe pero es secundaria', () => {
  const as = accionesPara(conRetencionesPendientes({ recibo_id: null }), admin)
  const ret = as.find(a => a.id === 'retenciones')
  assert.ok(ret, 'las retenciones tienen que seguir estando disponibles')
  assert.ok(!ret!.primaria, 'no debe desplazar a Emitir recibo')
})

test('una pendiente con recibo tampoco ofrece registrar el cobro otra vez', () => {
  const as = accionesPara(pendiente({ recibo_id: 19311 }), admin)
  assert.ok(!as.some(a => a.id === 'cobrar'))
})

test('sigue habiendo a lo sumo una primaria en los casos con recibo', () => {
  for (const recibo_id of [null, 19310]) {
    for (const estado of ESTADOS_ORDEN) {
      const n = accionesPara(f({ estado, recibo_id }), admin).filter(a => a.primaria).length
      assert.ok(n <= 1, `${n} primarias en ${estado} con recibo_id=${recibo_id}`)
    }
  }
})

test('diasDesde cuenta la espera de una pendiente', () => {
  assert.equal(diasDesde('2026-08-27', HOY), 0)
  assert.equal(diasDesde('2026-08-20', HOY), 7)
  assert.equal(diasDesde('2026-06-14', HOY), 74)
  assert.equal(diasDesde(null, HOY), null)
  assert.equal(diasDesde('no-es-fecha', HOY), null)
})

test('diasDesde nunca devuelve negativos', () => {
  // Una factura con fecha futura es un error de carga, no un motivo para
  // mostrar "-3 días".
  assert.equal(diasDesde('2026-12-31', HOY), 0)
})

test('arsCorto abrevia sin perder la magnitud', () => {
  assert.match(arsCorto(66_732_770), /66,7 M/)
  assert.match(arsCorto(180_249_128), /180,2 M/)
  assert.match(arsCorto(1_000_000), /1 M/)
  assert.match(arsCorto(508_200), /508 mil/)
  assert.match(arsCorto(950), /950/)
  assert.equal(arsCorto(null), '—')
})

test('arsCorto conserva el signo', () => {
  assert.match(arsCorto(-2_500_000), /^-/)
})

test('cada señal trae una versión corta para el teléfono', () => {
  const cs = [conRetencionesPendientes(), pendiente({ fecha: '2026-01-10' }), f({ estado: 'echeq_pendiente' })]
  for (const s of calcularSenales(cs, HOY)) {
    assert.ok(s.detalleCorto.length > 0, `${s.id} sin detalleCorto`)
    // Se compara contra lo que realmente se renderiza en escritorio, que es
    // detalle + nota: la nota es justamente lo que hace largo el renglón.
    const largo = s.detalle + (s.nota ? ` · ${s.nota}` : '')
    assert.ok(
      s.detalleCorto.length < largo.length,
      `el detalle corto de ${s.id} no es más corto: "${s.detalleCorto}" vs "${largo}"`,
    )
  }
})

test('la versión corta de pendientes conserva la antigüedad', () => {
  const s = calcularSenales([pendiente({ fecha: '2026-01-10' })], HOY).find(x => x.id === 'pendientes')!
  assert.match(s.detalleCorto, /\+60d/)
})
