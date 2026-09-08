/**
 * Tests de `lib/documentos.ts`.
 *
 * Dos cosas que conviene dejar fijadas:
 *
 *   1. Que ND siga soportada con 0 filas. Hoy la tabla no tiene ninguna, y la
 *      tentación de "simplificar" borrando el soporte es exactamente lo que
 *      rompería el módulo el día que se emita la primera.
 *   2. Que la relación con la factura asociada funcione cuando exista, sin
 *      inventarla cuando no. Las 7 NC de producción tienen
 *      `factura_asociada_id` vacío.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CLASES, CLASE_LABEL, CLASE_SINGULAR, claseDe, soloNotas, porClase, contarPorClase,
  aplicarFiltros, coincideBusqueda, chipsActivos, contarFiltros, hayFiltros,
  ordenar, opcionesAnio, opcionesUnidad, opcionesPuntoVenta, puntoVentaDe,
  resumen, situacionDe, signoDe, muestraDesagregado,
  FILTROS_INICIALES, type FiltrosDocumentos,
} from '../src/lib/documentos.ts'

let n = 400
function d(over: Partial<any> = {}): any {
  n++
  return {
    id: `NC-A-${n}`, tipo: 'NC A', numero: n, fecha: '2026-08-01',
    cliente: 'SADELSA SA', persona: 'COMERCIAL', concepto: 'Ajuste',
    monto_ars: 1_000_000, monto_usd: null, neto_ars: 826_446, iva: 173_554,
    estado: 'emitida', punto_venta: '0002', factura_asociada_id: null,
    created_at: '2026-08-01T00:00:00Z',
    ...over,
  }
}
const f = (over: Partial<FiltrosDocumentos> = {}): FiltrosDocumentos => ({ ...FILTROS_INICIALES, ...over })

// ── Clases ──────────────────────────────────────────────────────────────────

test('separa NC de ND por el prefijo del tipo', () => {
  assert.equal(claseDe(d({ tipo: 'NC A' })), 'NC')
  assert.equal(claseDe(d({ tipo: 'NC B' })), 'NC')
  assert.equal(claseDe(d({ tipo: 'ND A' })), 'ND')
  assert.equal(claseDe(d({ tipo: 'FACT A' })), null, 'una factura no es una nota')
  assert.equal(claseDe(d({ tipo: null })), null)
})

test('soloNotas deja afuera las facturas', () => {
  const ds = [d({ tipo: 'NC A' }), d({ tipo: 'FACT A' }), d({ tipo: 'ND A' }), d({ tipo: 'FACT B' })]
  assert.equal(soloNotas(ds).length, 2)
})

test('ND sigue soportada aunque hoy tenga cero filas', () => {
  // El estado real de producción: 7 NC, 0 ND.
  const ds = [d({ tipo: 'NC A' }), d({ tipo: 'NC B' })]
  const c = contarPorClase(ds)
  assert.equal(c.NC, 2)
  assert.equal(c.ND, 0)
  assert.deepEqual(porClase(ds, 'ND'), [], 'la clase existe y devuelve vacío, no rompe')
  assert.ok(CLASES.includes('ND'))
  assert.equal(CLASE_LABEL.ND, 'Notas de débito')
  assert.equal(CLASE_SINGULAR.ND, 'Nota de débito')
})

test('cuando aparezca la primera ND, la clasificación ya la ubica', () => {
  const ds = [d({ tipo: 'NC A' }), d({ tipo: 'ND A', id: 'ND-A-1', numero: 1 })]
  const c = contarPorClase(ds)
  assert.equal(c.NC, 1)
  assert.equal(c.ND, 1)
  assert.equal(porClase(ds, 'ND')[0].id, 'ND-A-1')
  assert.equal(c.NC + c.ND, ds.length)
})

// ── Factura asociada ────────────────────────────────────────────────────────

test('la relación con la factura se muestra si existe', () => {
  const conFactura = d({ factura_asociada_id: 'FC-A-4200' })
  assert.match(situacionDe(conFactura), /Anula la factura FC-A-4200/)
})

test('sin vínculo lo dice, en vez de fingir que el circuito está completo', () => {
  // Las 7 NC de producción están así: la relación existe en el modelo y en la
  // lógica de borrado, pero no en los datos.
  assert.match(situacionDe(d({ factura_asociada_id: null })), /Sin factura vinculada/)
  assert.equal(resumen([d(), d()]).conFactura, 0)
  assert.equal(resumen([d({ factura_asociada_id: 'FC-A-1' }), d()]).conFactura, 1)
})

test('una ND ajusta, no anula', () => {
  assert.match(situacionDe(d({ tipo: 'ND A', factura_asociada_id: 'FC-A-9' })), /Ajusta la factura/)
  assert.equal(signoDe(d({ tipo: 'NC A' })), -1, 'la NC resta facturación')
  assert.equal(signoDe(d({ tipo: 'ND A' })), 1, 'la ND suma')
})

test('los tipos B no discriminan IVA: no se ofrece el desglose', () => {
  assert.equal(muestraDesagregado(d({ tipo: 'NC A' })), true)
  assert.equal(muestraDesagregado(d({ tipo: 'NC B' })), false)
})

// ── Búsqueda y filtros ──────────────────────────────────────────────────────

test('la búsqueda encuentra por número, cliente, concepto y factura asociada', () => {
  const x = d({ numero: 425, cliente: 'SADELSA SA', concepto: 'Bonificación',
                factura_asociada_id: 'FC-A-4200' })
  assert.equal(coincideBusqueda(x, '425'), true)
  assert.equal(coincideBusqueda(x, 'sadelsa'), true)
  assert.equal(coincideBusqueda(x, 'bonificacion'), true, 'sin acento tiene que encontrar')
  // El caso que importa: "¿esta factura tiene una nota?"
  assert.equal(coincideBusqueda(x, 'FC-A-4200'), true)
  assert.equal(coincideBusqueda(x, '9999'), false)
})

test('filtra por año, mes, unidad y punto de venta, y todo se combina', () => {
  const ds = [
    d({ fecha: '2026-08-01', persona: 'COMERCIAL', punto_venta: '0002' }),
    d({ fecha: '2026-08-02', persona: 'CONSULTORIA', punto_venta: '0004' }),
    d({ fecha: '2025-03-02', persona: 'COMERCIAL', punto_venta: '0002' }),
  ]
  assert.equal(aplicarFiltros(ds, f({ anio: '2026' })).length, 2)
  assert.equal(aplicarFiltros(ds, f({ mes: '08' })).length, 2)
  assert.equal(aplicarFiltros(ds, f({ unidad: 'CONSULTORIA' })).length, 1)
  assert.equal(aplicarFiltros(ds, f({ puntoVenta: '0004' })).length, 1)
  assert.equal(aplicarFiltros(ds, f({ anio: '2026', unidad: 'COMERCIAL' })).length, 1)
})

test('el punto de venta vacío cae en 0002, como en Facturación', () => {
  assert.equal(puntoVentaDe(d({ punto_venta: '' })), '0002')
  assert.equal(puntoVentaDe(d({ punto_venta: '0004' })), '0004')
})

test('los chips reflejan sólo lo que está puesto', () => {
  assert.equal(contarFiltros(f()), 0)
  assert.equal(hayFiltros(f()), false)
  const puestos = f({ anio: '2026', puntoVenta: '0004' })
  assert.equal(contarFiltros(puestos), 2)
  assert.deepEqual(chipsActivos(puestos, m => m).map(c => c.label), ['2026', 'PV 0004'])
})

test('ordena por fecha descendente, desempatando por número, sin mutar', () => {
  const ds = [
    d({ fecha: '2026-01-01', numero: 1 }),
    d({ fecha: '2026-08-01', numero: 10 }),
    d({ fecha: '2026-08-01', numero: 11 }),
  ]
  assert.deepEqual(ordenar(ds).map(x => x.numero), [11, 10, 1])
  assert.equal(ds[0].numero, 1)
})

test('las opciones salen de los datos', () => {
  const ds = [
    d({ fecha: '2024-01-01', persona: 'B', punto_venta: '0004' }),
    d({ fecha: '2026-01-01', persona: 'A', punto_venta: '0002' }),
  ]
  assert.deepEqual(opcionesAnio(ds), ['2026', '2024'])
  assert.deepEqual(opcionesUnidad(ds), ['A', 'B'])
  assert.deepEqual(opcionesPuntoVenta(ds), ['0002', '0004'])
})

// ── Contexto ────────────────────────────────────────────────────────────────

test('el resumen suma por moneda y se apaga cuando no hay nada', () => {
  const r = resumen([
    d({ monto_ars: 100, monto_usd: null }),
    d({ monto_ars: null, monto_usd: 50 }),
  ])
  assert.equal(r.cantidad, 2)
  assert.equal(r.ars, 100)
  assert.equal(r.usd, 50)
  assert.equal(r.hayAlgo, true)

  const vacio = resumen([])
  assert.equal(vacio.cantidad, 0)
  assert.equal(vacio.hayAlgo, false, 'con cero documentos la línea de contexto se apaga')
})

test('ninguna situación queda vacía ni filtra snake_case', () => {
  for (const x of [d(), d({ tipo: 'ND A' }), d({ factura_asociada_id: 'FC-A-1' }),
                   d({ tipo: 'NC B' })]) {
    assert.ok(situacionDe(x).length > 0)
    assert.doesNotMatch(situacionDe(x), /_/)
  }
})
