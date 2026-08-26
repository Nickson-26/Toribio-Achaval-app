/**
 * Pruebas de la lógica del Inicio.
 *
 * Lo importante que se verifica acá:
 *   · el cálculo de antigüedad (+60 días) sobre el estado correcto;
 *   · que un item con 0 casos NO se renderice;
 *   · que Pendientes y "+60 días" sean UN item, no dos que cuenten doble;
 *   · que "Faltan retenciones" no se comunique como deuda;
 *   · que el resumen no duplique el pendiente;
 *   · que el filtro de año aparezca sólo con más de un año.
 *
 * Correr: npm test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  DIAS_ANTIGUEDAD, calcularAtencion, calcularResumen, construirActividad,
  ultimasFacturas, tiempoRelativo, diasDesde, aniosDisponibles,
  mostrarFiltroAnio, unidadesDisponibles, aplicarFiltros, saludo,
  type ComprobanteHome,
} from '../src/lib/home.ts'

const HOY = new Date('2026-08-21T16:00:00')

/** Factura ARS con IVA discriminado: neto 100.000, total 121.000. */
function fact(over: Partial<ComprobanteHome> = {}): ComprobanteHome {
  return {
    id: 'FC-A-1', tipo: 'FACT A', numero: 1, fecha: '2026-08-01',
    cliente: 'ACME', persona: 'CONSULTORIA', estado: 'pendiente',
    monto_ars: 121000, neto_ars: 100000, ...over,
  }
}
const diasAtras = (n: number) => {
  const d = new Date(HOY); d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

// ── diasDesde ───────────────────────────────────────────────────────────────
test('diasDesde cuenta correctamente', () => {
  assert.equal(diasDesde('2026-08-21', HOY), 0)
  assert.equal(diasDesde('2026-08-20', HOY), 1)
  assert.equal(diasDesde('2026-06-22', HOY), 60)
  assert.equal(diasDesde('2026-06-21', HOY), 61)
  assert.equal(diasDesde(null, HOY), null)
  assert.equal(diasDesde('basura', HOY), null)
})

// ── +60 días ────────────────────────────────────────────────────────────────
test('el umbral de antigüedad es 60 días', () => {
  assert.equal(DIAS_ANTIGUEDAD, 60)
})

test('CLAVE: +60 días cuenta sólo pendientes, y estrictamente mayores a 60', () => {
  const items = calcularAtencion([
    fact({ id: 'A', fecha: diasAtras(61) }),   // cuenta
    fact({ id: 'B', fecha: diasAtras(90) }),   // cuenta
    fact({ id: 'C', fecha: diasAtras(60) }),   // NO: exactamente 60
    fact({ id: 'D', fecha: diasAtras(10) }),   // NO: reciente
  ], { hoy: HOY })
  const p = items.find(i => i.id === 'pendientes')!
  assert.equal(p.cantidad, 4)
  assert.ok(p.destacado)
  assert.match(p.destacado!.texto, /^2 llevan más de 60 días$/)
  assert.equal(p.destacado!.monto, 200000)
})

test('CLAVE: otros estados NO entran en el cálculo de antigüedad', () => {
  // Todas viejas, pero sólo una está pendiente.
  const items = calcularAtencion([
    fact({ id: 'A', fecha: diasAtras(200), estado: 'pendiente' }),
    fact({ id: 'B', fecha: diasAtras(200), estado: 'cobrada' }),
    fact({ id: 'C', fecha: diasAtras(200), estado: 'faltan_retenciones' }),
    fact({ id: 'D', fecha: diasAtras(200), estado: 'echeq_pendiente' }),
    fact({ id: 'E', fecha: diasAtras(200), estado: 'emitida' }),
    fact({ id: 'F', fecha: diasAtras(200), estado: 'anulada' }),
  ], { hoy: HOY })
  const p = items.find(i => i.id === 'pendientes')!
  assert.equal(p.cantidad, 1)
  assert.equal(p.destacado!.monto, 100000)
  assert.match(p.destacado!.texto, /^1 lleva más de 60 días$/)  // singular
})

test('sin facturas viejas no hay línea destacada', () => {
  const items = calcularAtencion([fact({ fecha: diasAtras(5) })], { hoy: HOY })
  assert.equal(items.find(i => i.id === 'pendientes')!.destacado, undefined)
})

test('DECISIÓN: pendientes y +60 días son UN item, no dos', () => {
  // Dos items separados contarían dos veces las mismas facturas.
  const items = calcularAtencion([
    fact({ id: 'A', fecha: diasAtras(100) }),
    fact({ id: 'B', fecha: diasAtras(2) }),
  ], { hoy: HOY })
  assert.equal(items.filter(i => i.id === 'pendientes').length, 1)
  assert.equal(items.length, 1)
})

// ── Render condicional ──────────────────────────────────────────────────────
test('REQUISITO: un item con 0 casos NO se devuelve', () => {
  const items = calcularAtencion([fact({ estado: 'cobrada' })], { hoy: HOY })
  assert.deepEqual(items, [])
})

test('sin datos, la cola queda vacía (la pantalla muestra el empty state)', () => {
  assert.deepEqual(calcularAtencion([], { hoy: HOY }), [])
})

test('la cola crece dinámicamente con los estados que existan', () => {
  const base = [fact({ estado: 'pendiente' })]
  assert.equal(calcularAtencion(base, { hoy: HOY }).length, 1)

  const conRet = [...base, fact({ id: 'R', estado: 'faltan_retenciones' })]
  assert.equal(calcularAtencion(conRet, { hoy: HOY }).length, 2)

  const conEcheq = [...conRet, fact({ id: 'E', estado: 'echeq_pendiente' })]
  assert.equal(calcularAtencion(conEcheq, { hoy: HOY }).length, 3)

  const conSol = calcularAtencion(conEcheq, { hoy: HOY, solicitudesPendientes: 2, puedeVerUsuarios: true })
  assert.equal(conSol.length, 4)
})

test('el orden prioriza lo cobrable', () => {
  const items = calcularAtencion(
    [fact({ estado: 'pendiente' }), fact({ id: 'R', estado: 'faltan_retenciones' }), fact({ id: 'E', estado: 'echeq_pendiente' })],
    { hoy: HOY, solicitudesPendientes: 1, puedeVerUsuarios: true }
  )
  assert.deepEqual(items.map(i => i.id), ['pendientes', 'retenciones', 'echeq', 'solicitudes'])
})

// ── Faltan retenciones ──────────────────────────────────────────────────────
test('CLAVE: Faltan retenciones NO se comunica como deuda', () => {
  const items = calcularAtencion([fact({ estado: 'faltan_retenciones' })], { hoy: HOY })
  const r = items.find(i => i.id === 'retenciones')!
  assert.match(r.detalle, /Pago recibido/)
  // Nunca vocabulario de impago
  for (const prohibido of [/impag/i, /deuda/i, /vencid/i, /atrasad/i, /moros/i]) {
    assert.ok(!prohibido.test(r.titulo + r.detalle), `no debería decir ${prohibido}`)
  }
})

test('CLAVE: pendientes y retenciones NO comparten tono', () => {
  const items = calcularAtencion(
    [fact({ estado: 'pendiente' }), fact({ id: 'R', estado: 'faltan_retenciones' })], { hoy: HOY })
  const p = items.find(i => i.id === 'pendientes')!
  const r = items.find(i => i.id === 'retenciones')!
  assert.equal(p.tono, 'warning')
  assert.equal(r.tono, 'info')
  assert.notEqual(p.tono, r.tono)
})

test('ningún copy expone snake_case ni vocabulario de vencimiento', () => {
  const items = calcularAtencion(
    [fact({ estado: 'pendiente', fecha: diasAtras(90) }), fact({ id: 'R', estado: 'faltan_retenciones' }), fact({ id: 'E', estado: 'echeq_pendiente' })],
    { hoy: HOY, solicitudesPendientes: 3, puedeVerUsuarios: true })
  for (const i of items) {
    const txt = [i.titulo, i.detalle, i.cta, i.destacado?.texto ?? ''].join(' ')
    assert.ok(!txt.includes('_'), `snake_case en: ${txt}`)
    assert.ok(!/vencid|atrasad|moros/i.test(txt), `vocabulario de vencimiento en: ${txt}`)
  }
})

// ── Permisos ────────────────────────────────────────────────────────────────
test('REQUISITO: las solicitudes de acceso son sólo para quien puede verlas', () => {
  const c = [fact({ estado: 'cobrada' })]
  assert.equal(calcularAtencion(c, { hoy: HOY, solicitudesPendientes: 3, puedeVerUsuarios: false }).length, 0)
  assert.equal(calcularAtencion(c, { hoy: HOY, solicitudesPendientes: 3, puedeVerUsuarios: true }).length, 1)
  // Con permiso pero sin solicitudes, tampoco aparece.
  assert.equal(calcularAtencion(c, { hoy: HOY, solicitudesPendientes: 0, puedeVerUsuarios: true }).length, 0)
})

test('el item de solicitudes no muestra monto', () => {
  const i = calcularAtencion([], { hoy: HOY, solicitudesPendientes: 2, puedeVerUsuarios: true })[0]
  assert.equal(i.monto, null)
  assert.match(i.detalle, /2 usuarios esperan aprobación/)
})

// ── Resumen ─────────────────────────────────────────────────────────────────
test('el resumen calcula facturado, cobrado y su porcentaje', () => {
  const r = calcularResumen([
    fact({ id: 'A', estado: 'cobrada' }),
    fact({ id: 'B', estado: 'cobrada' }),
    fact({ id: 'C', estado: 'pendiente' }),
    fact({ id: 'D', estado: 'pendiente' }),
  ])
  assert.equal(r.facturado, 400000)
  assert.equal(r.cobrado, 200000)
  assert.equal(r.pctCobrado, 50)
  assert.equal(r.cantidadFacturas, 4)
})

test('DECISIÓN: el resumen NO expone "pendiente"', () => {
  // Ya vive en la cola de atención, con más contexto. Repetirlo sería el mismo
  // número dos veces en la misma pantalla.
  const r = calcularResumen([fact()])
  assert.ok(!('pendiente' in r))
  assert.deepEqual(
    Object.keys(r).sort(),
    ['cantidadFacturas', 'cantidadUSD', 'cobrado', 'facturado', 'pctCobrado', 'usd']
  )
})

test('el resumen excluye anuladas y no-facturas', () => {
  const r = calcularResumen([
    fact({ id: 'A', estado: 'cobrada' }),
    fact({ id: 'B', estado: 'anulada' }),
    fact({ id: 'C', tipo: 'NC A', estado: 'emitida' }),
  ])
  assert.equal(r.cantidadFacturas, 1)
  assert.equal(r.facturado, 100000)
})

test('el USD suma sólo las facturas en dólares', () => {
  const r = calcularResumen([
    fact({ id: 'A', monto_usd: 1000, tipo_cambio: 1000, neto_usd: 826.45 }),
    fact({ id: 'B' }),
  ])
  assert.equal(r.usd, 1000)
  assert.equal(r.cantidadUSD, 1)
})

test('sin facturado, el porcentaje es 0 y no NaN', () => {
  const r = calcularResumen([])
  assert.equal(r.pctCobrado, 0)
  assert.equal(r.facturado, 0)
})

// ── Filtros ─────────────────────────────────────────────────────────────────
test('REQUISITO: el filtro de año aparece sólo con más de un año', () => {
  const unAnio = [fact({ fecha: '2026-01-01' }), fact({ fecha: '2026-08-01' })]
  assert.equal(mostrarFiltroAnio(unAnio), false)
  assert.deepEqual(aniosDisponibles(unAnio), ['2026'])

  const dos = [...unAnio, fact({ fecha: '2025-05-01' })]
  assert.equal(mostrarFiltroAnio(dos), true)
  assert.deepEqual(aniosDisponibles(dos), ['2026', '2025'])
})

test('la regla del año es dinámica, no está atada a 2026', () => {
  assert.equal(mostrarFiltroAnio([fact({ fecha: '2031-01-01' })]), false)
  assert.equal(mostrarFiltroAnio([fact({ fecha: '2031-01-01' }), fact({ fecha: '2032-01-01' })]), true)
})

test('aplicarFiltros filtra por mes, unidad y año', () => {
  const datos = [
    fact({ id: 'A', fecha: '2026-08-05', persona: 'CONSULTORIA' }),
    fact({ id: 'B', fecha: '2026-07-05', persona: 'CONSULTORIA' }),
    fact({ id: 'C', fecha: '2026-08-10', persona: 'COMERCIAL' }),
  ]
  assert.equal(aplicarFiltros(datos, { mes: 'all', unidad: 'all', anio: 'all' }).length, 3)
  assert.equal(aplicarFiltros(datos, { mes: '08', unidad: 'all', anio: 'all' }).length, 2)
  assert.equal(aplicarFiltros(datos, { mes: 'all', unidad: 'COMERCIAL', anio: 'all' }).length, 1)
  assert.equal(aplicarFiltros(datos, { mes: '08', unidad: 'CONSULTORIA', anio: '2026' }).length, 1)
  assert.equal(aplicarFiltros(datos, { mes: 'all', unidad: 'all', anio: '2025' }).length, 0)
})

test('unidadesDisponibles sale de los datos, no de una lista fija', () => {
  assert.deepEqual(
    unidadesDisponibles([fact({ persona: 'COMERCIAL' }), fact({ persona: 'CONSULTORIA' }), fact({ persona: 'COMERCIAL' })]),
    ['COMERCIAL', 'CONSULTORIA']
  )
})

// ── Actividad ───────────────────────────────────────────────────────────────
test('la actividad mezcla comprobantes y recibos por fecha real', () => {
  const ev = construirActividad(
    [fact({ id: 'FC-A-10', created_at: '2026-08-21T10:00:00' }),
     fact({ id: 'FC-A-11', created_at: '2026-08-19T10:00:00' })],
    [{ id: 500, cliente: 'ACME', monto_ars: 5000, created_at: '2026-08-20T10:00:00' }]
  )
  assert.deepEqual(ev.map(e => e.clave), ['c-FC-A-10', 'r-500', 'c-FC-A-11'])
  assert.equal(ev[1].titulo, 'Recibo 500 registrado')
  assert.match(ev[0].titulo, /^Factura FC-A-10 creada$/)
})

test('sin created_at, el evento no se inventa', () => {
  assert.equal(construirActividad([fact({ created_at: null })], []).length, 0)
})

test('las notas de crédito se nombran Nota, no Factura', () => {
  const ev = construirActividad([fact({ id: 'NC-A-5', tipo: 'NC A', created_at: '2026-08-21T10:00:00' })], [])
  assert.match(ev[0].titulo, /^Nota NC-A-5 creada$/)
})

test('la actividad respeta el límite', () => {
  const muchos = Array.from({ length: 20 }, (_, i) =>
    fact({ id: `F${i}`, created_at: `2026-08-${String(i + 1).padStart(2, '0')}T10:00:00` }))
  assert.equal(construirActividad(muchos, [], 6).length, 6)
})

// ── Tiempo relativo ─────────────────────────────────────────────────────────
test('con hora real se muestra tiempo relativo', () => {
  assert.equal(tiempoRelativo('2026-08-21T12:00:00', HOY), 'hace 4 h')
  assert.equal(tiempoRelativo('2026-08-21T15:30:00', HOY), 'hace 30 min')
  assert.equal(tiempoRelativo('2026-08-20T10:00:00', HOY), 'ayer')
  assert.equal(tiempoRelativo('2026-08-18T10:00:00', HOY), 'hace 3 días')
  assert.equal(tiempoRelativo('2026-07-18T10:00:00', HOY), '18 jul')
})

test('REQUISITO: sin hora no se inventa precisión', () => {
  // Sólo fecha: nunca "hace N minutos".
  assert.equal(tiempoRelativo('2026-08-21', HOY), 'hoy')
  assert.equal(tiempoRelativo('2026-08-20', HOY), 'ayer')
  assert.ok(!/min|hace \d+ h/.test(tiempoRelativo('2026-08-21', HOY)))
})

test('tiempoRelativo tolera valores inválidos', () => {
  assert.equal(tiempoRelativo(null), '')
  assert.equal(tiempoRelativo(''), '')
  assert.equal(tiempoRelativo('basura'), '')
})

// ── Últimas facturas ────────────────────────────────────────────────────────
test('las últimas facturas se ordenan por número desc y excluyen notas', () => {
  const r = ultimasFacturas([
    fact({ id: 'FC-A-1', numero: 1 }),
    fact({ id: 'FC-A-9', numero: 9 }),
    fact({ id: 'NC-A-5', numero: 5, tipo: 'NC A' }),
    fact({ id: 'FC-A-5', numero: 5 }),
  ], 3)
  assert.deepEqual(r.map(c => c.id), ['FC-A-9', 'FC-A-5', 'FC-A-1'])
})

// ── Saludo ──────────────────────────────────────────────────────────────────
test('el saludo usa el primer nombre real y la franja horaria', () => {
  assert.equal(saludo('Nicolás Scaniglia', new Date('2026-08-21T09:00:00')), 'Buen día, Nicolás')
  assert.equal(saludo('Nicolás Scaniglia', new Date('2026-08-21T15:00:00')), 'Buenas tardes, Nicolás')
  assert.equal(saludo('Nicolás Scaniglia', new Date('2026-08-21T22:00:00')), 'Buenas noches, Nicolás')
})

test('sin nombre, el saludo no queda colgado', () => {
  assert.equal(saludo(null, new Date('2026-08-21T09:00:00')), 'Buen día')
  assert.equal(saludo('   ', new Date('2026-08-21T09:00:00')), 'Buen día')
})
