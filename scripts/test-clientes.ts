/**
 * Tests de `lib/clientes.ts`.
 *
 * Lo que más importa fijar acá es que la agregación cruce las DOS fuentes.
 * Medido en producción hay 45 clientes que existen sólo en `recibos`: si el
 * módulo mirara nada más que `comprobantes`, esos 45 desaparecerían de la
 * pantalla sin que nadie se entere.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  agregarClientes, aplicarFiltros, coincideBusqueda, chipsActivos,
  contarFiltros, hayFiltros, opcionesUnidad, resumenClientes,
  movimientosDe, situacionDe, volumenDe, montoPrincipal, montoSecundario,
  tieneNotas, desglosePorMoneda, FILTROS_INICIALES,
  type FiltrosClientes,
} from '../src/lib/clientes.ts'

let n = 5000
function c(over: Partial<any> = {}): any {
  n++
  return {
    id: `FC-A-${n}`, tipo: 'FACT A', numero: n, fecha: '2026-08-01',
    cliente: 'MAGNASCO BROKERS SRL', persona: 'TORIBIO ACHAVAL',
    monto_ars: 100_000, monto_usd: null, estado: 'cobrada',
    created_at: '2026-08-01T00:00:00Z',
    ...over,
  }
}
let m = 19000
function r(over: Partial<any> = {}): any {
  m++
  return {
    id: m, fecha: '2026-08-05', cliente: 'MAGNASCO BROKERS SRL',
    persona: 'TORIBIO ACHAVAL', monto_ars: 50_000, monto_usd: null,
    forma_pago: 'transferencia', created_at: '2026-08-05T00:00:00Z',
    ...over,
  }
}
const f = (over: Partial<FiltrosClientes> = {}): FiltrosClientes => ({ ...FILTROS_INICIALES, ...over })

// ── Agregación ──────────────────────────────────────────────────────────────

test('agrupa por nombre y cuenta cada tipo de documento', () => {
  const cs = agregarClientes([
    c({ cliente: 'ACME', tipo: 'FACT A' }),
    c({ cliente: 'ACME', tipo: 'FACT B' }),
    c({ cliente: 'ACME', tipo: 'NC A' }),
  ], [r({ cliente: 'ACME' })])
  assert.equal(cs.length, 1)
  assert.equal(cs[0].facturas, 2)
  assert.equal(cs[0].notas, 1)
  assert.equal(cs[0].recibos, 1)
  assert.equal(cs[0].documentos, 3, 'los recibos no cuentan como documentos emitidos')
})

test('un cliente que sólo aparece en recibos NO se pierde', () => {
  // El caso real: 45 de los 184 clientes de producción están únicamente acá.
  const cs = agregarClientes([c({ cliente: 'ACME' })], [r({ cliente: 'SOLO EN RECIBOS' })])
  assert.equal(cs.length, 2)
  const solo = cs.find(x => x.nombre === 'SOLO EN RECIBOS')!
  assert.equal(solo.recibos, 1)
  assert.equal(solo.documentos, 0)
  assert.match(situacionDe(solo), /Sólo recibos/)
})

test('las anuladas cuentan como documento pero no suman plata', () => {
  const cs = agregarClientes([
    c({ cliente: 'ACME', monto_ars: 100, estado: 'cobrada' }),
    c({ cliente: 'ACME', monto_ars: 900, estado: 'anulada' }),
  ], [])
  assert.equal(cs[0].documentos, 2)
  assert.equal(cs[0].ars, 100)
})

/* ══════════════════════════════════════════════════════════════════════════
   IMPORTES
   ══════════════════════════════════════════════════════════════════════════
   Contar documentos no demuestra que el importe esté bien. Estos tests fijan
   resultados monetarios exactos.

   La regla: facturas no anuladas + notas de débito − notas de crédito, en la
   misma base (`monto_ars`/`monto_usd`, totales con IVA) y con cada moneda
   por su cuenta. */

const F = (over = {}) => c({ tipo: 'FACT A', ...over })
const NC = (over = {}) => c({ tipo: 'NC A', ...over })
const ND = (over = {}) => c({ tipo: 'ND A', ...over })

test('un recibo NO incrementa lo facturado', () => {
  const [x] = agregarClientes(
    [F({ cliente: 'ACME', monto_ars: 100 })],
    [r({ cliente: 'ACME', monto_ars: 100 })],
  )
  assert.equal(x.ars, 100, 'el recibo documenta un cobro, no una facturación')
  assert.equal(x.facturadoArs, 100)
  assert.equal(x.recibos, 1)
})

test('una NC parcial descuenta sólo su parte', () => {
  const [x] = agregarClientes([
    F({ cliente: 'ACME', monto_ars: 100 }),
    NC({ cliente: 'ACME', monto_ars: 30 }),
  ], [])
  assert.equal(x.facturadoArs, 100)
  assert.equal(x.ncArs, 30)
  assert.equal(x.ars, 70)
})

test('cancelación completa por NC: aporta 0, no -100', () => {
  // El caso que Nico pidió verificar. La factura queda anulada y la NC la
  // referencia: la exclusión de la factura YA representa la cancelación, así
  // que restar la nota además sería contarla dos veces.
  const [x] = agregarClientes([
    F({ id: 'FC-A-1', cliente: 'ACME', monto_ars: 100, estado: 'anulada' }),
    NC({ cliente: 'ACME', monto_ars: 100, factura_asociada_id: 'FC-A-1' }),
  ], [])
  assert.equal(x.facturadoArs, 0, 'la factura anulada no suma')
  assert.equal(x.ncArs, 0, 'la NC no vuelve a descontar lo ya excluido')
  assert.equal(x.ars, 0)
})

test('si la factura vinculada NO está anulada, la NC sí descuenta', () => {
  // NC parcial con vínculo: la factura sigue sumando entera y la nota
  // descuenta su parte.
  const [x] = agregarClientes([
    F({ id: 'FC-A-2', cliente: 'ACME', monto_ars: 100, estado: 'cobrada' }),
    NC({ cliente: 'ACME', monto_ars: 40, factura_asociada_id: 'FC-A-2' }),
  ], [])
  assert.equal(x.ars, 60)
})

test('una NC sin vínculo descuenta siempre', () => {
  // Es el estado de las 7 NC de producción: `factura_asociada_id` vacío.
  const [x] = agregarClientes([
    F({ cliente: 'ACME', monto_ars: 100 }),
    NC({ cliente: 'ACME', monto_ars: 25, factura_asociada_id: null }),
  ], [])
  assert.equal(x.ars, 75)
})

test('una NC con vínculo roto descuenta: no se adivina qué canceló', () => {
  const [x] = agregarClientes([
    F({ cliente: 'ACME', monto_ars: 100 }),
    NC({ cliente: 'ACME', monto_ars: 25, factura_asociada_id: 'FC-A-NO-EXISTE' }),
  ], [])
  assert.equal(x.ars, 75)
})

test('una factura anulada por otro motivo no habilita descuentos ajenos', () => {
  // Anulada sin NC que la referencie: se excluye y nada más. Otra NC del
  // mismo cliente, sin vínculo, sigue descontando normalmente.
  const [x] = agregarClientes([
    F({ id: 'FC-A-3', cliente: 'ACME', monto_ars: 500, estado: 'anulada' }),
    F({ cliente: 'ACME', monto_ars: 100 }),
    NC({ cliente: 'ACME', monto_ars: 20 }),
  ], [])
  assert.equal(x.facturadoArs, 100)
  assert.equal(x.ars, 80)
})

test('una nota de débito suma', () => {
  const [x] = agregarClientes([
    F({ cliente: 'ACME', monto_ars: 100 }),
    ND({ cliente: 'ACME', monto_ars: 15 }),
  ], [])
  assert.equal(x.ndArs, 15)
  assert.equal(x.ars, 115)
})

test('facturas + ND − NC, todo junto', () => {
  const [x] = agregarClientes([
    F({ cliente: 'ACME', monto_ars: 1000 }),
    F({ cliente: 'ACME', monto_ars: 500 }),
    ND({ cliente: 'ACME', monto_ars: 200 }),
    NC({ cliente: 'ACME', monto_ars: 300 }),
  ], [])
  assert.equal(x.facturadoArs, 1500)
  assert.equal(x.ndArs, 200)
  assert.equal(x.ncArs, 300)
  assert.equal(x.ars, 1400)
})

test('ARS y USD nunca se suman entre sí', () => {
  const [x] = agregarClientes([
    F({ cliente: 'ACME', monto_ars: 1000, monto_usd: null }),
    F({ cliente: 'ACME', monto_ars: null, monto_usd: 50 }),
    NC({ cliente: 'ACME', monto_ars: 100, monto_usd: null }),
    NC({ cliente: 'ACME', monto_ars: null, monto_usd: 10 }),
  ], [])
  assert.equal(x.ars, 900)
  assert.equal(x.usd, 40)
  // Ni el total ni ninguna cifra intermedia mezclan monedas.
  assert.equal(x.facturadoArs, 1000)
  assert.equal(x.facturadoUsd, 50)
})

test('un cliente sólo en USD muestra el dólar como cifra principal', () => {
  const [x] = agregarClientes([F({ cliente: 'ACME', monto_ars: null, monto_usd: 4598 })], [])
  assert.equal(x.ars, 0)
  assert.equal(x.usd, 4598)
  assert.deepEqual(montoPrincipal(x), { valor: 4598, moneda: 'usd' })
  assert.equal(montoSecundario(x), null, 'sin pesos no hay segunda cifra')
})

test('con las dos monedas, el dólar es el secundario', () => {
  const [x] = agregarClientes([
    F({ cliente: 'ACME', monto_ars: 1000, monto_usd: null }),
    F({ cliente: 'ACME', monto_ars: null, monto_usd: 50 }),
  ], [])
  assert.deepEqual(montoPrincipal(x), { valor: 1000, moneda: 'ars' })
  assert.deepEqual(montoSecundario(x), { valor: 50, moneda: 'usd' })
})

test('un total de cero se calcula, no se esconde', () => {
  const [x] = agregarClientes([
    F({ cliente: 'ACME', monto_ars: 100 }),
    NC({ cliente: 'ACME', monto_ars: 100 }),
  ], [])
  assert.equal(x.ars, 0)
  assert.equal(montoPrincipal(x).valor, 0)
})

test('más crédito que facturación da negativo, y eso es un dato real', () => {
  // Ocurre en producción: un cliente con tres NC contra una factura menor.
  // El resultado negativo dice que se emitió más crédito del que se facturó
  // en esa moneda; taparlo con un cero sería falsear.
  const [x] = agregarClientes([
    F({ cliente: 'ACME', monto_ars: null, monto_usd: 3200 }),
    NC({ cliente: 'ACME', monto_ars: null, monto_usd: 3872 }),
    NC({ cliente: 'ACME', monto_ars: null, monto_usd: 3872 }),
  ], [])
  assert.equal(x.usd, -4544)
  assert.deepEqual(montoPrincipal(x), { valor: -4544, moneda: 'usd' })
})

test('una NC en una moneda no afecta el total de la otra', () => {
  // Caso real: la única factura del cliente está en dólares y la NC en pesos.
  // No hay tipo de cambio guardado, así que no se relacionan.
  const [x] = agregarClientes([
    F({ cliente: 'ACME', monto_ars: null, monto_usd: 11016 }),
    NC({ cliente: 'ACME', monto_ars: 15587414, monto_usd: null }),
  ], [])
  assert.equal(x.usd, 11016, 'el dólar queda intacto')
  assert.equal(x.ars, -15587414)
})

test('sin notas no hay desglose que mostrar', () => {
  const [sinNotas] = agregarClientes([F({ cliente: 'ACME', monto_ars: 100 })], [])
  assert.equal(tieneNotas(sinNotas), false)
  const [conNotas] = agregarClientes([
    F({ cliente: 'B', monto_ars: 100 }), NC({ cliente: 'B', monto_ars: 10 }),
  ], [])
  assert.equal(tieneNotas(conNotas), true)
})

test('ANULADO y los vacíos no son clientes', () => {
  const cs = agregarClientes([
    c({ cliente: 'ANULADO' }), c({ cliente: '' }), c({ cliente: null }), c({ cliente: 'REAL SA' }),
  ], [r({ cliente: null })])
  assert.deepEqual(cs.map(x => x.nombre), ['REAL SA'])
})

test('el último movimiento mira comprobantes Y recibos', () => {
  const cs = agregarClientes(
    [c({ cliente: 'ACME', fecha: '2026-01-01' })],
    [r({ cliente: 'ACME', fecha: '2026-09-15' })],
  )
  assert.equal(cs[0].ultimo, '2026-09-15')
})

test('ordena por movimiento más reciente, no por facturación', () => {
  // Con 111 de 184 clientes con un solo documento, un ranking por plata deja
  // arriba a gente que no se va a buscar nunca.
  const cs = agregarClientes([
    c({ cliente: 'GRANDE Y VIEJO', monto_ars: 99_000_000, fecha: '2024-01-01' }),
    c({ cliente: 'CHICO Y RECIENTE', monto_ars: 10, fecha: '2026-09-01' }),
  ], [])
  assert.deepEqual(cs.map(x => x.nombre), ['CHICO Y RECIENTE', 'GRANDE Y VIEJO'])
})

test('junta las unidades de negocio de las dos fuentes, sin repetir', () => {
  const cs = agregarClientes(
    [c({ cliente: 'ACME', persona: 'CONSULTORIA' }), c({ cliente: 'ACME', persona: 'COMERCIAL' })],
    [r({ cliente: 'ACME', persona: 'CONSULTORIA' })],
  )
  assert.deepEqual(cs[0].unidades, ['COMERCIAL', 'CONSULTORIA'])
})

// ── Señal operativa ─────────────────────────────────────────────────────────

test('cuenta pendientes y cobros sin cerrar por separado', () => {
  const cs = agregarClientes([
    c({ cliente: 'ACME', estado: 'pendiente' }),
    c({ cliente: 'ACME', estado: 'pendiente' }),
    c({ cliente: 'ACME', estado: 'faltan_retenciones' }),
    c({ cliente: 'ACME', estado: 'echeq_pendiente' }),
    c({ cliente: 'ACME', estado: 'cobrada' }),
  ], [])
  assert.equal(cs[0].pendientes, 2)
  assert.equal(cs[0].porCerrar, 2)
  assert.match(situacionDe(cs[0]), /2 facturas pendientes/)
})

test('lo pendiente gana sobre lo que sólo falta cerrar', () => {
  const conAmbos = agregarClientes([
    c({ cliente: 'A', estado: 'pendiente' }), c({ cliente: 'A', estado: 'faltan_retenciones' }),
  ], [])[0]
  assert.match(situacionDe(conAmbos), /pendiente/)
  const soloCerrar = agregarClientes([c({ cliente: 'B', estado: 'echeq_pendiente' })], [])[0]
  assert.match(situacionDe(soloCerrar), /sin cerrar/)
  const alDia = agregarClientes([c({ cliente: 'C', estado: 'cobrada' })], [])[0]
  assert.equal(situacionDe(alDia), 'Al día')
})

test('el contexto se apaga cuando no hay nada pendiente', () => {
  const conPend = resumenClientes(agregarClientes([
    c({ cliente: 'A', estado: 'pendiente' }),
    c({ cliente: 'A', estado: 'pendiente' }),
    c({ cliente: 'B', estado: 'pendiente' }),
    c({ cliente: 'C', estado: 'cobrada' }),
  ], []))
  assert.equal(conPend.total, 3)
  assert.equal(conPend.conPendientes, 2)
  assert.equal(conPend.facturasPendientes, 3)
  assert.equal(conPend.hayAlgo, true)

  const limpio = resumenClientes(agregarClientes([c({ cliente: 'C', estado: 'cobrada' })], []))
  assert.equal(limpio.hayAlgo, false)
})

// ── Búsqueda y filtros ──────────────────────────────────────────────────────

test('la búsqueda encuentra por nombre sin acentos ni mayúsculas', () => {
  const [x] = agregarClientes([c({ cliente: 'COMPAÑÍA INVERSORA RIO NEGRO' })], [])
  assert.equal(coincideBusqueda(x, 'compania'), true)
  assert.equal(coincideBusqueda(x, 'RIO NEGRO'), true)
  assert.equal(coincideBusqueda(x, 'zzz'), false)
  assert.equal(coincideBusqueda(x, ''), true)
})

test('la búsqueda también encuentra por unidad de negocio', () => {
  const [x] = agregarClientes([c({ cliente: 'ACME', persona: 'CONSULTORIA' })], [])
  assert.equal(coincideBusqueda(x, 'consultoria'), true)
})

test('filtra por unidad y por "sólo con pendientes"', () => {
  const cs = agregarClientes([
    c({ cliente: 'A', persona: 'CONSULTORIA', estado: 'pendiente' }),
    c({ cliente: 'B', persona: 'COMERCIAL', estado: 'cobrada' }),
    c({ cliente: 'C', persona: 'CONSULTORIA', estado: 'cobrada' }),
  ], [])
  assert.equal(aplicarFiltros(cs, f({ unidad: 'CONSULTORIA' })).length, 2)
  assert.equal(aplicarFiltros(cs, f({ soloPendientes: true })).length, 1)
  assert.equal(aplicarFiltros(cs, f({ unidad: 'COMERCIAL', soloPendientes: true })).length, 0)
  assert.deepEqual(opcionesUnidad(cs), ['COMERCIAL', 'CONSULTORIA'])
})

test('los chips reflejan sólo lo que está puesto', () => {
  assert.equal(contarFiltros(f()), 0)
  assert.equal(hayFiltros(f()), false)
  const puestos = f({ unidad: 'COMERCIAL', soloPendientes: true })
  assert.equal(contarFiltros(puestos), 2)
  assert.deepEqual(chipsActivos(puestos).map(x => x.label), ['COMERCIAL', 'Con pendientes'])
})

// ── Movimientos ─────────────────────────────────────────────────────────────

test('los movimientos mezclan documentos y recibos en una sola línea de tiempo', () => {
  const comps = [
    c({ cliente: 'ACME', tipo: 'FACT A', numero: 100, fecha: '2026-01-10' }),
    c({ cliente: 'OTRO', tipo: 'FACT A', numero: 999, fecha: '2026-05-05' }),
    c({ cliente: 'ACME', tipo: 'NC A', numero: 7, fecha: '2026-03-01' }),
  ]
  const recs = [r({ cliente: 'ACME', id: 555, fecha: '2026-02-01' })]
  const ms = movimientosDe('ACME', comps, recs)
  assert.deepEqual(ms.map(x => x.titulo), ['NC A 7', 'Recibo 555', 'FACT A 100'])
  assert.ok(!ms.some(x => x.titulo.includes('999')), 'no puede colarse el documento de otro cliente')
  assert.equal(ms.find(x => x.tipo === 'recibo')!.estado, undefined)
})

test('un cliente sin movimientos devuelve una lista vacía, no explota', () => {
  assert.deepEqual(movimientosDe('NO EXISTE', [c()], [r()]), [])
})

// ── Presentación ────────────────────────────────────────────────────────────

test('el volumen se lee en castellano y singulariza bien', () => {
  const [uno] = agregarClientes([c({ cliente: 'A' })], [])
  assert.equal(volumenDe(uno), '1 factura')
  const [varios] = agregarClientes(
    [c({ cliente: 'B' }), c({ cliente: 'B' }), c({ cliente: 'B', tipo: 'NC A' })],
    [r({ cliente: 'B' })],
  )
  assert.equal(volumenDe(varios), '2 facturas · 1 nota · 1 recibo')
})

/* El desglose es lo que se lee en la ficha. Si dejara una resta armada entre
   monedas distintas, mostraría una cuenta que nadie hizo. */

test('el desglose separa las monedas y no arma restas entre ellas', () => {
  const [x] = agregarClientes([
    F({ cliente: 'MIXTO', monto_usd: 3200, monto_ars: 0 }),
    NC({ cliente: 'MIXTO', monto_ars: 3872, monto_usd: 0 }),
  ], [])
  const d = desglosePorMoneda(x)
  assert.deepEqual(d.map(f => f.moneda), ['ars', 'usd'])
  const [pesos, dolares] = d
  assert.equal(pesos.facturado, 0)
  assert.equal(pesos.nc, 3872)
  assert.equal(pesos.total, -3872)
  assert.equal(dolares.facturado, 3200)
  assert.equal(dolares.nc, 0, 'la NC en pesos no puede aparecer del lado del dólar')
  assert.equal(dolares.total, 3200)
})

test('el desglose no inventa un bloque de una moneda que el cliente no usa', () => {
  const [x] = agregarClientes([
    F({ cliente: 'SOLO PESOS', monto_ars: 1000, monto_usd: 0 }),
    NC({ cliente: 'SOLO PESOS', monto_ars: 300, monto_usd: 0 }),
  ], [])
  const d = desglosePorMoneda(x)
  assert.equal(d.length, 1)
  assert.equal(d[0].moneda, 'ars')
  assert.equal(d[0].total, 700)
})

test('cada bloque del desglose cierra con el total de esa moneda', () => {
  const [x] = agregarClientes([
    F({ cliente: 'AMBAS', monto_ars: 1500, monto_usd: 90 }),
    ND({ cliente: 'AMBAS', monto_ars: 200, monto_usd: 10 }),
    NC({ cliente: 'AMBAS', monto_ars: 300, monto_usd: 25 }),
  ], [])
  for (const f of desglosePorMoneda(x)) {
    assert.equal(f.total, f.facturado + f.nd - f.nc)
  }
  assert.deepEqual(desglosePorMoneda(x).map(f => f.total), [1400, 75])
})

test('sin notas no hay desglose que mostrar', () => {
  const [x] = agregarClientes([F({ cliente: 'LIMPIO', monto_ars: 500 })], [])
  assert.equal(tieneNotas(x), false)
})

test('ninguna situación queda vacía ni filtra snake_case', () => {
  for (const estado of ['pendiente', 'cobrada', 'faltan_retenciones', 'echeq_pendiente', 'anulada']) {
    const [x] = agregarClientes([c({ cliente: 'A', estado })], [])
    assert.ok(situacionDe(x).length > 0)
    assert.doesNotMatch(situacionDe(x), /_/)
  }
})
