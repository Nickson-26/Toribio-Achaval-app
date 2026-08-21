/**
 * Prueba de regresión del registro de cobro.
 *
 * Bug original (regresión introducida y no commiteada, ver AUDITORIA_REDISEÑO.md):
 *   ComprobanteForms.tsx hacía
 *       if (reciboError && reciboError.code !== '23505') throw ...
 *   es decir, si el número de recibo ya estaba ocupado se TRAGABA el error y
 *   seguía adelante vinculando la factura a ese recibo — que podía ser de otro
 *   cliente — mostrando además un toast de éxito.
 *
 * Invariante que se verifica acá:
 *   UNA FACTURA NUNCA PUEDE QUEDAR VINCULADA A UN RECIBO DE OTRO CLIENTE.
 *
 * Correr:  npm test
 * (usa node:test y el type-stripping nativo de Node 22, sin dependencias)
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizarCliente,
  esMismoCliente,
  verificarReciboCompatible,
  resolverColision,
} from '../src/lib/cobro.ts'

// ── normalizarCliente ────────────────────────────────────────────
test('normalizarCliente tolera ruido de carga manual', () => {
  assert.equal(normalizarCliente('  acme   s.a. '), 'ACME SA')
  assert.equal(normalizarCliente('Construcciones Ñandú'), 'CONSTRUCCIONES NANDU')
  assert.equal(normalizarCliente('TORIBIO P. DE ACHAVAL Y CÍA. S.A.'), 'TORIBIO P DE ACHAVAL Y CIA SA')
  assert.equal(normalizarCliente(null), '')
  assert.equal(normalizarCliente(''), '')
})

test('esMismoCliente equipara variantes de la misma razón social', () => {
  assert.ok(esMismoCliente('ACME S.A.', 'acme sa'))
  assert.ok(esMismoCliente('Río Negro SRL', 'RIO NEGRO SRL'))
})

test('esMismoCliente NO equipara clientes distintos', () => {
  assert.ok(!esMismoCliente('ACME S.A.', 'ACME HOLDINGS S.A.'))
  assert.ok(!esMismoCliente('Constructora Sur', 'Constructora Norte'))
})

test('esMismoCliente es falso si falta alguno de los dos', () => {
  // Ante la duda no se vincula.
  assert.ok(!esMismoCliente(null, 'ACME'))
  assert.ok(!esMismoCliente('ACME', ''))
  assert.ok(!esMismoCliente(null, null))
})

// ── verificarReciboCompatible — el guard central ─────────────────
const facturaAcme = { id: 'FC-A-4086', cliente: 'ACME S.A.' }

test('REGRESIÓN: rechaza vincular una factura a un recibo de OTRO cliente', () => {
  const reciboDeOtro = { id: 19205, cliente: 'CONSTRUCTORA SUR SRL', nro_fact: 'FC-A-4090' }
  const r = verificarReciboCompatible(reciboDeOtro, facturaAcme)
  assert.equal(r.ok, false)
  assert.match(r.motivo!, /CONSTRUCTORA SUR SRL/)
  assert.match(r.motivo!, /ACME S\.A\./)
})

test('rechaza vincular a un recibo inexistente', () => {
  const r = verificarReciboCompatible(null, facturaAcme)
  assert.equal(r.ok, false)
  assert.match(r.motivo!, /no existe/i)
})

test('rechaza vincular a un recibo sin cliente cargado', () => {
  const r = verificarReciboCompatible({ id: 19206, cliente: null }, facturaAcme)
  assert.equal(r.ok, false)
  assert.match(r.motivo!, /no tiene cliente/i)
})

test('acepta vincular a un recibo del mismo cliente', () => {
  const r = verificarReciboCompatible({ id: 19207, cliente: 'acme s.a.' }, facturaAcme)
  assert.equal(r.ok, true)
})

// ── resolverColision — qué hacer ante un 23505 ───────────────────
test('REGRESIÓN: ante colisión con recibo de otro cliente, renumera (no reusa)', () => {
  const ocupante = { id: 19200, cliente: 'CONSTRUCTORA SUR SRL', nro_fact: 'FC-A-4090' }
  assert.equal(resolverColision(ocupante, facturaAcme), 'renumerar')
})

test('ante colisión con otra factura del MISMO cliente, también renumera', () => {
  // Mismo cliente pero otra factura: son dos cobros distintos, no se comparte recibo.
  const ocupante = { id: 19200, cliente: 'ACME S.A.', nro_fact: 'FC-A-4099' }
  assert.equal(resolverColision(ocupante, facturaAcme), 'renumerar')
})

test('ante colisión con el mismo cobro repetido, reusa (idempotencia)', () => {
  // Doble click / reintento: mismo cliente y misma factura.
  const ocupante = { id: 19200, cliente: 'ACME S.A.', nro_fact: 'FC-A-4086' }
  assert.equal(resolverColision(ocupante, facturaAcme), 'reusar')
})

test('ante colisión sin poder leer el ocupante, renumera', () => {
  assert.equal(resolverColision(null, facturaAcme), 'renumerar')
})

// ── Escenario completo de la carrera que causaba el bug ──────────
test('ESCENARIO: dos usuarios cobrando a la vez no cruzan recibos', () => {
  const facturaA = { id: 'FC-A-4086', cliente: 'ACME S.A.' }
  const facturaB = { id: 'FC-A-4087', cliente: 'CONSTRUCTORA SUR SRL' }

  // Ambos leyeron getNextReciboId() y obtuvieron 19200.
  // El usuario B insertó primero.
  const reciboDeB = { id: 19200, cliente: 'CONSTRUCTORA SUR SRL', nro_fact: facturaB.id }

  // El usuario A choca con 23505. Con el bug viejo, seguía y vinculaba
  // FC-A-4086 (ACME) al recibo 19200 de CONSTRUCTORA SUR.
  assert.equal(resolverColision(reciboDeB, facturaA), 'renumerar')

  // Y si alguien intentara forzar la vinculación, el guard lo frena.
  const forzado = verificarReciboCompatible(reciboDeB, facturaA)
  assert.equal(forzado.ok, false)
})
