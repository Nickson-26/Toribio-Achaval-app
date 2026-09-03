/**
 * Tests de `lib/recibos.ts`.
 *
 * Dos cosas que conviene que queden fijadas: que la búsqueda encuentre por el
 * número de factura —que es como se busca un recibo en la práctica— y que el
 * vínculo con la factura funcione tanto por la relación como por `nro_fact`,
 * porque hoy la tabla `recibo_comprobantes` está vacía y todo el universo
 * depende del segundo camino.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  coincideBusqueda, aplicarFiltros, ordenar, facturasDe, facturaCorta,
  opcionesAnio, opcionesPersona, formasPagoPresentes,
  chipsActivos, contarFiltros, hayFiltros, calcularTotales, resumenHoy,
  formaPagoLabel, formaPagoHabitual, situacionDe, esARS, esUSD, FILTROS_INICIALES,
  type FiltrosRecibos,
} from '../src/lib/recibos.ts'

let n = 19000
function r(over: Partial<any> = {}): any {
  n++
  return {
    id: n, fecha: '2026-08-20', cliente: 'MAGNASCO BROKERS SRL', nro_fact: '4128',
    persona: 'TORIBIO ACHAVAL', monto_ars: 1_000_000, monto_usd: null,
    forma_pago: 'transferencia', retencion: null, nro_echeq: null,
    created_at: '2026-08-20T00:00:00Z',
    ...over,
  }
}
const f = (over: Partial<FiltrosRecibos> = {}): FiltrosRecibos => ({ ...FILTROS_INICIALES, ...over })

// ── Vínculo con la factura ──────────────────────────────────────────────────

test('la factura sale de nro_fact cuando no hay relación cargada', () => {
  assert.deepEqual(facturasDe(r({ nro_fact: '4128' })), ['4128'])
  assert.equal(facturaCorta(r({ nro_fact: '4128' })), '4128')
})

test('si existe la relación, gana sobre nro_fact', () => {
  const x = r({ nro_fact: '4128', recibo_comprobantes: [{ comprobante_id: 'FC-A-4200' }] })
  assert.deepEqual(facturasDe(x), ['FC-A-4200'])
})

test('varias facturas se resumen sin esconder cuántas son', () => {
  const x = r({ recibo_comprobantes: [
    { comprobante_id: 'FC-A-1' }, { comprobante_id: 'FC-A-2' }, { comprobante_id: 'FC-A-3' },
  ] })
  assert.equal(facturaCorta(x), 'FC-A-1 +2')
  assert.match(situacionDe(x), /3 facturas/)
})

test('un recibo sin factura lo dice', () => {
  const x = r({ nro_fact: null })
  assert.deepEqual(facturasDe(x), [])
  assert.equal(facturaCorta(x), '—')
  assert.match(situacionDe(x), /Sin factura asociada/)
})

// ── Búsqueda y filtros ──────────────────────────────────────────────────────

test('la búsqueda encuentra por cliente, número de recibo y número de factura', () => {
  const x = r({ id: 19301, cliente: 'JUANA MARIA CARROLL', nro_fact: '4261' })
  assert.equal(coincideBusqueda(x, 'juana'), true)
  assert.equal(coincideBusqueda(x, 'CARROLL'), true)
  assert.equal(coincideBusqueda(x, '19301'), true)
  assert.equal(coincideBusqueda(x, '4261'), true)
  assert.equal(coincideBusqueda(x, '9999'), false)
  assert.equal(coincideBusqueda(x, '  '), true)
})

test('filtra por año, mes, unidad, forma de pago y moneda, y todo se combina', () => {
  const rs = [
    r({ fecha: '2026-08-01', persona: 'CONSULTORIA', forma_pago: 'transferencia' }),
    r({ fecha: '2026-08-02', persona: 'CONSULTORIA', forma_pago: 'e-cheq' }),
    r({ fecha: '2026-03-02', persona: 'COMERCIAL', forma_pago: 'efectivo' }),
    r({ fecha: '2025-08-02', persona: 'CONSULTORIA', forma_pago: 'transferencia' }),
  ]
  assert.equal(aplicarFiltros(rs, f({ anio: '2026' })).length, 3)
  assert.equal(aplicarFiltros(rs, f({ mes: '08' })).length, 3)
  assert.equal(aplicarFiltros(rs, f({ persona: 'COMERCIAL' })).length, 1)
  assert.equal(aplicarFiltros(rs, f({ formaPago: 'e-cheq' })).length, 1)
  assert.equal(aplicarFiltros(rs, f({ anio: '2026', mes: '08', formaPago: 'transferencia' })).length, 1)
})

test('el filtro de moneda separa pesos de dólares', () => {
  const pesos  = r({ monto_ars: 1000, monto_usd: null })
  const dolar  = r({ monto_ars: 1000, monto_usd: 10 })
  assert.equal(esARS(pesos), true)
  assert.equal(esARS(dolar), false)
  assert.equal(esUSD(dolar), true)
  assert.equal(aplicarFiltros([pesos, dolar], f({ moneda: 'usd' })).length, 1)
  assert.equal(aplicarFiltros([pesos, dolar], f({ moneda: 'ars' })).length, 1)
})

test('los chips reflejan sólo lo que está puesto', () => {
  assert.equal(contarFiltros(f()), 0)
  assert.equal(hayFiltros(f()), false)
  const puestos = f({ anio: '2026', formaPago: 'e-cheq', moneda: 'usd' })
  assert.equal(contarFiltros(puestos), 3)
  assert.deepEqual(chipsActivos(puestos, m => m).map(c => c.label), ['2026', 'E-cheq', 'Dólares'])
})

test('ordena por número de recibo descendente sin mutar', () => {
  const rs = [r({ id: 100 }), r({ id: 300 }), r({ id: 200 })]
  assert.deepEqual(ordenar(rs).map(x => x.id), [300, 200, 100])
  assert.equal(rs[0].id, 100)
})

test('las opciones salen de los datos, no de una lista fija', () => {
  const rs = [
    r({ fecha: '2024-01-01', persona: 'B', forma_pago: 'efectivo' }),
    r({ fecha: '2026-01-01', persona: 'A', forma_pago: 'transferencia' }),
  ]
  assert.deepEqual(opcionesAnio(rs), ['2026', '2024'])
  assert.deepEqual(opcionesPersona(rs), ['A', 'B'])
  assert.deepEqual(formasPagoPresentes(rs), ['efectivo', 'transferencia'])
})

// ── Contexto ────────────────────────────────────────────────────────────────

test('el contexto de hoy baja la presencia cuando no se emitió nada', () => {
  const hoy = new Date('2026-08-27T12:00:00Z')
  const conActividad = resumenHoy([r({ fecha: '2026-08-27', monto_ars: 500 })], hoy)
  assert.equal(conActividad.hoy, 1)
  assert.equal(conActividad.montoHoyARS, 500)
  assert.equal(conActividad.hayAlgo, true)

  const quieto = resumenHoy([r({ fecha: '2026-08-24' })], hoy)
  assert.equal(quieto.hoy, 0)
  assert.equal(quieto.hayAlgo, false)
  assert.equal(quieto.semana, 1, 'sin actividad hoy tiene que dar el contexto de la semana')
})

test('los totales suman por moneda por separado', () => {
  const t = calcularTotales([
    r({ monto_ars: 100, monto_usd: null }),
    r({ monto_ars: null, monto_usd: 50 }),
    r({ monto_ars: 900, monto_usd: null }),
  ])
  assert.equal(t.cantidad, 3)
  assert.equal(t.ars, 1000)
  assert.equal(t.usd, 50)
  assert.equal(t.cantidadUSD, 1)
})

// ── Presentación ────────────────────────────────────────────────────────────

test('la forma de pago se muestra en castellano', () => {
  assert.equal(formaPagoLabel('transferencia'), 'Transferencia')
  assert.equal(formaPagoLabel('e-cheq'), 'E-cheq')
  assert.equal(formaPagoLabel(null), '—')
})

test('un e-cheq nombra su número, que es lo que queda en tránsito', () => {
  const x = r({ forma_pago: 'e-cheq', nro_echeq: '00123456' })
  assert.match(situacionDe(x), /E-cheq 00123456/)
})

test('ninguna situación filtra snake_case ni queda vacía', () => {
  for (const x of [r(), r({ nro_fact: null }), r({ forma_pago: 'e-cheq', nro_echeq: '1' }),
                   r({ forma_pago: null })]) {
    assert.ok(situacionDe(x).length > 0)
    assert.doesNotMatch(situacionDe(x), /_/)
  }
})

test('la forma de pago mayoritaria se calcula, no se fija', () => {
  const muchas = (n: number, fp: string) => Array.from({ length: n }, () => r({ forma_pago: fp }))
  assert.equal(formaPagoHabitual([...muchas(8, 'transferencia'), ...muchas(2, 'e-cheq')]), 'transferencia')
  // La proporción real de producción: 153 de 209.
  assert.equal(formaPagoHabitual([...muchas(153, 'transferencia'), ...muchas(31, 'efectivo'), ...muchas(25, 'e-cheq')]), 'transferencia')
  // Si mañana la mayoría es otra, la regla se acomoda sola.
  assert.equal(formaPagoHabitual([...muchas(8, 'efectivo'), ...muchas(2, 'e-cheq')]), 'efectivo')
})

test('sin mayoría clara no hay forma de pago habitual: las dos informan', () => {
  const muchas = (n: number, fp: string) => Array.from({ length: n }, () => r({ forma_pago: fp }))
  assert.equal(formaPagoHabitual([...muchas(5, 'transferencia'), ...muchas(6, 'efectivo')]), null)
})

test('con pocos recibos no se esconde ninguna forma de pago', () => {
  assert.equal(formaPagoHabitual([r(), r(), r()]), null)
  assert.equal(formaPagoHabitual([]), null)
})
