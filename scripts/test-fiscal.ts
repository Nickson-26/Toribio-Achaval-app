/**
 * Pruebas de la interpretación fiscal.
 *
 * Cubre los dos bugs corregidos:
 *   A) Dashboard/Informe le restaban 21 % a las Factura B, que no discriminan
 *      IVA. Subestimaban el neto exactamente un 21 %.
 *   B) El formulario de Nota de Crédito calculaba IVA 21 % para NC B y
 *      NC FACT DE CREDITO igual que para NC A.
 *
 * Correr: npm test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { netoARS, brutoARS, ivaARS, discriminaIVA, desdeNeto, IVA_RATE } from '../src/lib/fiscal.ts'

test('IVA_RATE sigue siendo 21%', () => {
  assert.equal(IVA_RATE, 0.21)
})

// ── Qué tipos discriminan IVA ───────────────────────────────────────────────
test('los tipos B no discriminan IVA', () => {
  assert.equal(discriminaIVA('FACT B'), false)
  assert.equal(discriminaIVA('NC B'), false)
  assert.equal(discriminaIVA('ND B'), false)
})

test('los tipos A, FCE y E sí discriminan IVA', () => {
  for (const t of ['FACT A', 'FACT DE CREDITO', 'FACT E', 'NC A', 'ND A', 'NC FACT DE CREDITO']) {
    assert.equal(discriminaIVA(t), true, `${t} debería discriminar IVA`)
  }
})

test('FACT E se mantiene como discriminado (no se cambió su tratamiento)', () => {
  // Decisión explícita: cambiar el tratamiento de exportación es una
  // definición contable, no un bug de código.
  assert.equal(discriminaIVA('FACT E'), true)
})

test('discriminaIVA tolera espacios y minúsculas', () => {
  assert.equal(discriminaIVA(' fact b '), false)
  assert.equal(discriminaIVA('Fact B'), false)
})

test('sin tipo se asume que discrimina (comportamiento conservador)', () => {
  assert.equal(discriminaIVA(null), true)
  assert.equal(discriminaIVA(undefined), true)
})

// ── REGRESIÓN A: FACT B en ARS ──────────────────────────────────────────────
test('REGRESIÓN: en FACT B el total ES el neto, no se divide por 1,21', () => {
  const fb = { tipo: 'FACT B', monto_ars: 121000 }
  assert.equal(netoARS(fb), 121000)
  assert.equal(brutoARS(fb), 121000)
  assert.equal(ivaARS(fb), 0)
  // El comportamiento viejo devolvía 100000 (121000/1.21).
  assert.notEqual(netoARS(fb), 100000)
})

test('FACT A sí deriva el neto dividiendo por 1,21 cuando no hay neto cargado', () => {
  const fa = { tipo: 'FACT A', monto_ars: 121000 }
  assert.equal(netoARS(fa), 100000)
  assert.equal(ivaARS(fa), 21000)
})

test('FACT A usa el neto_ars real si está cargado', () => {
  const fa = { tipo: 'FACT A', monto_ars: 121000, neto_ars: 100000 }
  assert.equal(netoARS(fa), 100000)
})

// ── REGRESIÓN A: FACT B en USD ──────────────────────────────────────────────
test('REGRESIÓN: FACT B en USD convierte sin descontar IVA', () => {
  const fb = { tipo: 'FACT B', monto_usd: 1000, tipo_cambio: 1400 }
  assert.equal(netoARS(fb), 1400000)
  assert.equal(brutoARS(fb), 1400000)
  assert.equal(ivaARS(fb), 0)
})

test('FACT A en USD sin neto_usd deriva el neto por 1,21', () => {
  const fa = { tipo: 'FACT A', monto_usd: 1210, tipo_cambio: 1000 }
  assert.equal(netoARS(fa), 1000000)
})

test('FACT A en USD CON neto_usd usa el neto real (rama antes muerta)', () => {
  // getDashboardStats() no traía neto_usd, así que esta rama nunca corría.
  const fa = { tipo: 'FACT A', monto_usd: 1210, neto_usd: 1000, tipo_cambio: 1000 }
  assert.equal(netoARS(fa), 1000000)
})

test('una Factura E cargada sin IVA respeta su neto guardado', () => {
  // Caso real: FC-E-5 (exportación) tiene neto_usd == monto_usd, o sea que se
  // cargó sin IVA, que es lo que corresponde a una exportación.
  // El código viejo no traía neto_usd del servidor y le derivaba el neto
  // dividiendo por 1,21 — descontándole un impuesto que nunca se cobró.
  const fe = { tipo: 'FACT E', monto_usd: 19968.77, neto_usd: 19968.77, tipo_cambio: 1200 }
  assert.equal(netoARS(fe), 23962524)
  assert.equal(ivaARS(fe), 0)
  // Comportamiento viejo: 23962524 / 1.21 = 19803738.02
  assert.notEqual(netoARS(fe), 19803738.02)
})

test('sin tipo de cambio, una factura en USD aporta 0 (comportamiento preservado)', () => {
  assert.equal(netoARS({ tipo: 'FACT A', monto_usd: 1000, tipo_cambio: null }), 0)
  assert.equal(netoARS({ tipo: 'FACT B', monto_usd: 1000, tipo_cambio: null }), 0)
  assert.equal(brutoARS({ tipo: 'FACT A', monto_usd: 1000, tipo_cambio: null }), 0)
})

test('comprobante vacío da 0, no NaN', () => {
  assert.equal(netoARS({ tipo: 'FACT A' }), 0)
  assert.equal(netoARS({ tipo: 'FACT B' }), 0)
  assert.equal(brutoARS({ tipo: 'FACT B' }), 0)
})

// ── Magnitud del impacto, con la proporción real de producción ──────────────
test('el desvío de FACT B es exactamente el 21% de su neto', () => {
  const total = 274785591.08         // neto correcto de las 36 FACT B vivas
  const viejo = total / 1.21         // lo que mostraba el Dashboard
  assert.ok(Math.abs(viejo - 227095529.81) < 1, `esperaba ~227.095.529, dio ${viejo.toFixed(2)}`)
  const desvio = total - viejo
  assert.ok(Math.abs(desvio - 47690061.27) < 1, `esperaba ~47.690.061 de diferencia, dio ${desvio.toFixed(2)}`)
})

// ── REGRESIÓN B: alta de comprobantes ───────────────────────────────────────
test('REGRESIÓN: desdeNeto NO agrega IVA a NC B', () => {
  const r = desdeNeto('NC B', 100000)
  assert.deepEqual(r, { neto: 100000, iva: 0, total: 100000 })
})

test('REGRESIÓN: desdeNeto NO agrega IVA a ND B', () => {
  assert.deepEqual(desdeNeto('ND B', 50000), { neto: 50000, iva: 0, total: 50000 })
})

test('desdeNeto SÍ agrega IVA a NC A', () => {
  assert.deepEqual(desdeNeto('NC A', 100000), { neto: 100000, iva: 21000, total: 121000 })
})

test('desdeNeto SÍ agrega IVA a NC FACT DE CREDITO', () => {
  assert.deepEqual(desdeNeto('NC FACT DE CREDITO', 100000), { neto: 100000, iva: 21000, total: 121000 })
})

test('desdeNeto redondea a 2 decimales', () => {
  const r = desdeNeto('NC A', 33333.33)
  assert.equal(r.iva, 7000)
  assert.equal(r.total, 40333.33)
})

// ── Informe PDF: bases imponibles de las notas de crédito ───────────────────
//
// Bug corregido: `netoReal = totalNetoARS - totalNC` restaba el BRUTO de las
// NC a un total NETO de facturas. Y `totalNC` leía sólo monto_ars, así que las
// NC en dólares se contaban como cero.

test('REGRESIÓN: una NC A aporta bases distintas en bruto y en neto', () => {
  const nc = { tipo: 'NC A', monto_ars: 121000, neto_ars: 100000, iva: 21000 }
  assert.equal(brutoARS(nc), 121000)   // para mostrar y comparar contra bruto
  assert.equal(netoARS(nc), 100000)    // para restar de un total neto
  assert.notEqual(brutoARS(nc), netoARS(nc))
})

test('REGRESIÓN: una NC en USD ya no vale cero si tiene tipo de cambio', () => {
  const nc = { tipo: 'NC A', monto_ars: 0, monto_usd: 1210, neto_usd: 1000, tipo_cambio: 1000 }
  // El código viejo hacía `s + (f.monto_ars || 0)` -> 0
  assert.equal(brutoARS(nc), 1210000)
  assert.equal(netoARS(nc), 1000000)
})

test('una NC en USD sin tipo de cambio sigue aportando 0 (no se inventa un TC)', () => {
  // Caso real: NC-A-423 y NC-A-424 tienen monto_usd 3.872 y monto_ars 0, pero
  // NO tienen tipo_cambio. Sin TC no hay forma de convertirlas sin inventar un
  // dato, así que se mantienen en 0. Es un problema de carga, no de cálculo.
  const nc = { tipo: 'NC A', monto_ars: 0, monto_usd: 3872, tipo_cambio: null }
  assert.equal(brutoARS(nc), 0)
  assert.equal(netoARS(nc), 0)
})

test('una NC B aporta el mismo valor en bruto y en neto', () => {
  const nc = { tipo: 'NC B', monto_ars: 3872 }
  assert.equal(brutoARS(nc), 3872)
  assert.equal(netoARS(nc), 3872)
})

test('magnitud del ajuste en netoReal con las NC reales de producción', () => {
  // Las 7 NC de producción: 44.197.686,94 brutas vs 36.527.686,00 netas.
  const bruto = 44197686.94, neto = 36527686.00
  const ajuste = bruto - neto
  assert.ok(Math.abs(ajuste - 7670000.94) < 1, `esperaba ~7.670.000, dio ${ajuste.toFixed(2)}`)
})

// ── La NC B que ya existe en producción no cambia ───────────────────────────
test('la única NC B de producción se interpreta igual que antes', () => {
  // Está guardada sin iva ni neto_ars discriminados, que es lo correcto.
  const ncb = { tipo: 'NC B', monto_ars: 500000, neto_ars: null, iva: null }
  assert.equal(netoARS(ncb), 500000)
  assert.equal(ivaARS(ncb), 0)
})
