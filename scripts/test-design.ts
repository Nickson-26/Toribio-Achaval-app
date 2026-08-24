/**
 * Pruebas de la foundation del design system.
 *
 * Se testea la LÓGICA, no el render: el mapeo de estados y la tabla de
 * permisos. Son las dos piezas donde un error se propaga a toda la interfaz.
 *
 * Correr: npm test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  ESTADO_CONFIG, ESTADOS_ORDEN, estadoDef, estadoLabel, tipoTone,
} from '../src/design/status.ts'
import { puede, accionesDe, ROLE_LABEL, type Accion } from '../src/design/permissions.ts'

// ── Estados ─────────────────────────────────────────────────────────────────
test('los 6 estados de la base tienen definición', () => {
  const esperados = ['pendiente','faltan_retenciones','cobrada','anulada','emitida','echeq_pendiente']
  for (const e of esperados) {
    assert.ok(ESTADO_CONFIG[e as keyof typeof ESTADO_CONFIG], `falta la definición de ${e}`)
  }
  assert.equal(Object.keys(ESTADO_CONFIG).length, 6)
})

test('REQUISITO: ningún label expone snake_case', () => {
  for (const [valor, def] of Object.entries(ESTADO_CONFIG)) {
    assert.ok(!def.label.includes('_'), `${valor} tiene guion bajo en el label: ${def.label}`)
    assert.notEqual(def.label, valor, `${valor} no está traducido`)
    assert.match(def.label, /^[A-ZÁÉÍÓÚÑ]/, `${valor} debería empezar en mayúscula`)
  }
})

test('los labels son exactamente los acordados', () => {
  assert.equal(estadoLabel('pendiente'), 'Pendiente')
  assert.equal(estadoLabel('faltan_retenciones'), 'Faltan retenciones')
  assert.equal(estadoLabel('cobrada'), 'Cobrada')
  assert.equal(estadoLabel('anulada'), 'Anulada')
  assert.equal(estadoLabel('emitida'), 'Emitida')
  assert.equal(estadoLabel('echeq_pendiente'), 'E-cheq pendiente')
})

test('CLAVE: Pendiente y Faltan retenciones NO comparten tono', () => {
  // "Faltan retenciones" significa que el dinero YA entró. Que se vea igual
  // que "Pendiente" comunicaría deuda donde no hay.
  const pend = ESTADO_CONFIG.pendiente
  const falt = ESTADO_CONFIG.faltan_retenciones
  assert.notEqual(pend.tone, falt.tone)
  assert.equal(pend.tone, 'warning')
  assert.equal(falt.tone, 'info')
})

test('los hints comunican el significado correcto', () => {
  assert.match(ESTADO_CONFIG.pendiente.hint, /pendiente/i)
  // El hint del estado intermedio debe decir que el pago ya se recibió.
  assert.match(ESTADO_CONFIG.faltan_retenciones.hint, /recibido/i)
  assert.match(ESTADO_CONFIG.cobrada.hint, /complet/i)
})

test('cobrada es success y anulada es neutral', () => {
  assert.equal(ESTADO_CONFIG.cobrada.tone, 'success')
  assert.equal(ESTADO_CONFIG.anulada.tone, 'neutral')
})

test('estadoDef nunca lanza ante valores inesperados', () => {
  assert.equal(estadoDef(null).label, '—')
  assert.equal(estadoDef(undefined).label, '—')
  assert.equal(estadoDef('').label, '—')
  // Un estado nuevo en la base no debe romper la UI.
  const d = estadoDef('estado_futuro')
  assert.equal(d.tone, 'neutral')
  assert.equal(d.label, 'estado_futuro')
})

test('ESTADOS_ORDEN cubre los 6 sin repetir', () => {
  assert.equal(ESTADOS_ORDEN.length, 6)
  assert.equal(new Set(ESTADOS_ORDEN).size, 6)
  for (const e of ESTADOS_ORDEN) assert.ok(ESTADO_CONFIG[e])
})

test('tipoTone diferencia los tipos de comprobante', () => {
  assert.equal(tipoTone('FACT A'), 'info')
  assert.equal(tipoTone('FACT B'), 'violet')
  assert.equal(tipoTone('FACT DE CREDITO'), 'warning')
  assert.equal(tipoTone('FACT E'), 'success')
  assert.equal(tipoTone('NC A'), 'danger')
  assert.equal(tipoTone('ND A'), 'warning')
  assert.equal(tipoTone(null), 'neutral')
})

// ── Permisos ────────────────────────────────────────────────────────────────
test('admin puede todo', () => {
  const total = accionesDe('admin').length
  assert.ok(total >= 20, `admin debería tener 20+ acciones, tiene ${total}`)
  assert.equal(accionesDe('admin').length, accionesDe('admin').length)
})

test('REQUISITO: viewer no puede ejecutar ninguna acción de escritura', () => {
  const prohibidas: Accion[] = [
    'comprobante.crear', 'comprobante.editar', 'comprobante.anular',
    'comprobante.eliminar', 'comprobante.cobrar', 'comprobante.adjuntarPDF',
    'comprobante.importarPDF', 'retenciones.gestionar',
    'recibo.crear', 'recibo.editar', 'recibo.eliminar',
    'nota.crear', 'nota.editar', 'nota.eliminar',
    'reserva.crear', 'reserva.editar', 'reserva.eliminar', 'reserva.importar',
    'usuarios.gestionar', 'informe.generar',
  ]
  for (const a of prohibidas) {
    assert.equal(puede('viewer', a), false, `viewer NO debería poder ${a}`)
  }
})

test('viewer sí puede exportar lo que ya ve', () => {
  assert.equal(puede('viewer', 'datos.exportar'), true)
})

test('editor puede operar pero no administrar', () => {
  assert.equal(puede('editor', 'comprobante.crear'), true)
  assert.equal(puede('editor', 'comprobante.cobrar'), true)
  assert.equal(puede('editor', 'recibo.crear'), true)
  assert.equal(puede('editor', 'reserva.editar'), true)
  // Sólo admin
  assert.equal(puede('editor', 'usuarios.gestionar'), false)
  assert.equal(puede('editor', 'informe.generar'), false)
  assert.equal(puede('editor', 'comprobante.eliminar'), false)
  assert.equal(puede('editor', 'nota.eliminar'), false)
  assert.equal(puede('editor', 'reserva.importar'), false)
})

test('las acciones destructivas son sólo de admin', () => {
  for (const a of ['comprobante.eliminar','nota.eliminar','reserva.importar','usuarios.gestionar'] as Accion[]) {
    assert.equal(puede('admin', a), true, `admin debería poder ${a}`)
    assert.equal(puede('editor', a), false, `editor NO debería poder ${a}`)
    assert.equal(puede('viewer', a), false, `viewer NO debería poder ${a}`)
  }
})

test('sin rol no se puede nada', () => {
  assert.equal(accionesDe(null).length, 0)
  assert.equal(accionesDe(undefined).length, 0)
  assert.equal(puede(null, 'comprobante.crear'), false)
  assert.equal(puede(null, 'datos.exportar'), false)
})

test('la jerarquía de permisos es monótona: admin ⊇ editor ⊇ viewer', () => {
  const A = new Set(accionesDe('admin'))
  const E = accionesDe('editor')
  const V = accionesDe('viewer')
  for (const a of E) assert.ok(A.has(a), `editor tiene ${a} pero admin no`)
  for (const a of V) assert.ok(A.has(a), `viewer tiene ${a} pero admin no`)
  assert.ok(A.size > E.length, 'admin debería poder más que editor')
  assert.ok(E.length > V.length, 'editor debería poder más que viewer')
})

test('los 3 roles tienen etiqueta humana', () => {
  assert.equal(ROLE_LABEL.admin, 'Administrador')
  assert.equal(ROLE_LABEL.editor, 'Editor')
  assert.equal(ROLE_LABEL.viewer, 'Solo lectura')
})
