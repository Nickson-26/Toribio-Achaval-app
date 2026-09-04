/**
 * Tests de `lib/reservas.ts`.
 *
 * El bloque que importa es el de Canning: había tres tablas de prefijos PROA
 * distintas en el repo y no coincidían, así que la categoría de una reserva
 * dependía de por dónde hubiera entrado el dato. Estos tests fijan la regla
 * corregida —TCN -> PLAT. CANNING -> EMPRENDIMIENTOS— en las dos direcciones:
 * que aparezca donde tiene que aparecer, y que NO aparezca donde no.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  UNIDAD_POR_PREFIJO, UNIDADES_EMPRENDIMIENTOS, UNIDADES_COMERCIAL,
  prefijoProa, unidadDesdeProa, categoriaDe, porCategoria, contarPorCategoria,
  aplicarFiltros, coincideBusqueda, chipsActivos, contarFiltros, hayFiltros,
  ordenar, opcionesAnio, opcionesUnidad, resumenDelMes,
  codigoCorto, operacionLabel, situacionDe,
  FILTROS_INICIALES, CATEGORIAS,
  type FiltrosReservas,
} from '../src/lib/reservas.ts'

let n = 2000
function r(over: Partial<any> = {}): any {
  n++
  return {
    id: n, fecha: '2026-08-10', direccion: `Calle ${n}`, broker: 'Broker Uno',
    cliente: null, operacion: 'VENTA', unidad: 'RESIDENCIAL',
    monto_ars: null, monto_usd: 100_000, modo_pago: null, firmo: 'PENDIENTE',
    created_at: '2026-08-10T00:00:00Z', proa_codigo: null, tipo_inmueble: 'Departamento',
    precio_publicado: 120_000, precio_reserva: 100_000, estado_reserva: 'Reservada',
    ...over,
  }
}
const f = (over: Partial<FiltrosReservas> = {}): FiltrosReservas => ({ ...FILTROS_INICIALES, ...over })

// ══ CANNING ═════════════════════════════════════════════════════════════════

test('TCN mapea a PLAT. CANNING', () => {
  assert.equal(UNIDAD_POR_PREFIJO.TCN, 'PLAT. CANNING')
  assert.equal(unidadDesdeProa('TCN 65443'), 'PLAT. CANNING')
  assert.equal(unidadDesdeProa('TCN|Ruta 16, Lote 121'), 'PLAT. CANNING')
  assert.equal(unidadDesdeProa('tcn 60967'), 'PLAT. CANNING')
})

test('PLAT. CANNING es EMPRENDIMIENTOS', () => {
  assert.ok(UNIDADES_EMPRENDIMIENTOS.includes('PLAT. CANNING'))
  assert.equal(categoriaDe(r({ unidad: 'PLAT. CANNING' })), 'EMPRENDIMIENTOS')
})

test('TCN no pertenece a Residencial bajo ninguna forma', () => {
  const casos = [
    r({ unidad: 'PLAT. CANNING' }),
    r({ unidad: 'PLAT. CANNING', proa_codigo: 'TCN 65443' }),
    // El caso real de la base: unidad quedó en RESIDENCIAL porque el
    // importador viejo pisaba la plataforma con un genérico.
    r({ unidad: 'RESIDENCIAL', proa_codigo: 'TCN 65443' }),
    r({ unidad: 'RESIDENCIAL', proa_codigo: 'TCN|VOLARE CANNING, Coronel Vicent' }),
  ]
  for (const c of casos) {
    assert.equal(categoriaDe(c), 'EMPRENDIMIENTOS',
      `"${c.unidad}" / "${c.proa_codigo}" no cayó en Emprendimientos`)
    assert.notEqual(categoriaDe(c), 'RESIDENCIAL')
  }
})

test('una reserva TCN aparece en Emprendimientos y no en Residencial', () => {
  const rs = [
    r({ unidad: 'RESIDENCIAL', proa_codigo: 'TCN 65443' }),
    r({ unidad: 'RESIDENCIAL', proa_codigo: 'TCD 68927' }),
    r({ unidad: 'PLAT. PALERMO' }),
  ]
  const emp = porCategoria(rs, 'EMPRENDIMIENTOS')
  const res = porCategoria(rs, 'RESIDENCIAL')
  assert.equal(emp.length, 1)
  assert.equal(emp[0].proa_codigo, 'TCN 65443')
  assert.equal(res.length, 2)
  assert.ok(!res.some(x => /^TCN/i.test(x.proa_codigo ?? '')))
})

test('los conteos de las tres categorías suman el total y no se pisan', () => {
  const rs = [
    r({ unidad: 'RESIDENCIAL', proa_codigo: 'TCN 1' }),
    r({ unidad: 'PLAT. CANNING' }),
    r({ unidad: 'EMPRENDIMIENTOS' }),
    r({ unidad: 'PLAT. PALERMO' }),
    r({ unidad: 'RESIDENCIAL' }),
    r({ unidad: 'INDUSTRIA' }),
    r({ unidad: 'CONSULTORIA' }),
  ]
  const c = contarPorCategoria(rs)
  assert.equal(c.EMPRENDIMIENTOS, 3)
  assert.equal(c.RESIDENCIAL, 2)
  assert.equal(c.COMERCIAL, 2)
  assert.equal(c.EMPRENDIMIENTOS + c.RESIDENCIAL + c.COMERCIAL, rs.length)
  // Ninguna reserva puede estar en dos categorías a la vez.
  for (const x of rs) {
    const dentro = CATEGORIAS.filter(cat => porCategoria([x], cat).length > 0)
    assert.equal(dentro.length, 1, `${x.unidad}/${x.proa_codigo} cayó en ${dentro.join(' y ')}`)
  }
})

test('el código PROA sólo puede sumar a Emprendimientos, nunca sacar de Comercial', () => {
  // Deliberado: corregir el caso conocido sin reacomodar en silencio filas
  // que hoy están bien clasificadas por su unidad.
  assert.equal(categoriaDe(r({ unidad: 'INDUSTRIA', proa_codigo: 'TAR 1' })), 'COMERCIAL')
  assert.equal(categoriaDe(r({ unidad: 'CONSULTORIA', proa_codigo: 'TCD 1' })), 'COMERCIAL')
})

test('todos los prefijos de emprendimientos caen en Emprendimientos', () => {
  for (const [prefijo, unidad] of Object.entries(UNIDAD_POR_PREFIJO)) {
    if (!UNIDADES_EMPRENDIMIENTOS.includes(unidad)) continue
    assert.equal(categoriaDe(r({ unidad: 'RESIDENCIAL', proa_codigo: `${prefijo} 123` })),
      'EMPRENDIMIENTOS', `${prefijo} -> ${unidad} no cayó en Emprendimientos`)
  }
})

test('ninguna unidad está declarada en dos listas a la vez', () => {
  for (const u of UNIDADES_EMPRENDIMIENTOS) {
    assert.ok(!UNIDADES_COMERCIAL.includes(u), `${u} está en Emprendimientos y en Comercial`)
  }
})

test('prefijoProa tolera nulos y espacios', () => {
  assert.equal(prefijoProa(null), '')
  assert.equal(prefijoProa('  tcn 123 '), 'TCN')
  assert.equal(unidadDesdeProa('ZZZ 999'), null)
  assert.equal(categoriaDe(r({ unidad: 'RESIDENCIAL', proa_codigo: null })), 'RESIDENCIAL')
})

// ══ Filtros ═════════════════════════════════════════════════════════════════

test('la búsqueda encuentra por dirección, broker y código', () => {
  const x = r({ direccion: 'Esmeralda 1365', broker: 'Aguilar Belén', proa_codigo: 'TCD 68927' })
  assert.equal(coincideBusqueda(x, 'esmeralda'), true)
  assert.equal(coincideBusqueda(x, 'BELEN'), true)   // sin acento y en mayúsculas
  assert.equal(coincideBusqueda(x, '68927'), true)
  assert.equal(coincideBusqueda(x, 'zzz'), false)
  assert.equal(coincideBusqueda(x, ''), true)
})

test('filtra por año, mes, unidad y operación, y todo se combina', () => {
  const rs = [
    r({ fecha: '2026-08-10', unidad: 'PLAT. PALERMO', operacion: 'VENTA' }),
    r({ fecha: '2026-08-11', unidad: 'PLAT. PALERMO', operacion: 'ALQUILER' }),
    r({ fecha: '2025-08-10', unidad: 'PLAT. PALERMO', operacion: 'VENTA' }),
    r({ fecha: '2026-03-10', unidad: 'INDUSTRIA', operacion: 'VENTA' }),
  ]
  assert.equal(aplicarFiltros(rs, f({ anio: '2026' })).length, 3)
  assert.equal(aplicarFiltros(rs, f({ mes: '08' })).length, 3)
  assert.equal(aplicarFiltros(rs, f({ unidad: 'INDUSTRIA' })).length, 1)
  assert.equal(aplicarFiltros(rs, f({ operacion: 'ALQUILER' })).length, 1)
  assert.equal(aplicarFiltros(rs, f({ anio: '2026', mes: '08', operacion: 'VENTA' })).length, 1)
})

test('los chips reflejan sólo los filtros puestos', () => {
  assert.equal(chipsActivos(f(), m => m).length, 0)
  assert.equal(contarFiltros(f()), 0)
  assert.equal(hayFiltros(f()), false)
  const puestos = f({ anio: '2026', operacion: 'VENTA' })
  assert.equal(contarFiltros(puestos), 2)
  assert.equal(chipsActivos(puestos, m => m).map(c => c.label).join(','), '2026,Venta')
})

test('ordena por fecha descendente sin mutar', () => {
  const rs = [r({ fecha: '2026-01-01' }), r({ fecha: '2026-08-01' }), r({ fecha: '2026-05-01' })]
  assert.deepEqual(ordenar(rs).map(x => x.fecha), ['2026-08-01', '2026-05-01', '2026-01-01'])
  assert.equal(rs[0].fecha, '2026-01-01')
})

test('las opciones salen de los datos', () => {
  const rs = [r({ fecha: '2024-01-01', unidad: 'B' }), r({ fecha: '2026-01-01', unidad: 'A' })]
  assert.deepEqual(opcionesAnio(rs), ['2026', '2024'])
  assert.deepEqual(opcionesUnidad(rs), ['A', 'B'])
})

// ══ Contexto ════════════════════════════════════════════════════════════════

test('el resumen mide el mes en curso y suma en dólares', () => {
  const hoy = new Date('2026-08-15T12:00:00Z')
  const rs = [
    r({ fecha: '2026-08-01', monto_usd: 100_000, operacion: 'VENTA' }),
    r({ fecha: '2026-08-20', monto_usd: 50_000, operacion: 'ALQUILER' }),
    r({ fecha: '2026-07-30', monto_usd: 999_999, operacion: 'VENTA' }),
  ]
  const s = resumenDelMes(rs, hoy)
  assert.equal(s.mes, 2)
  assert.equal(s.montoUSD, 150_000)
  assert.equal(s.ventas, 1)
  assert.equal(s.hayAlgo, true)
})

test('un mes sin reservas lo dice en vez de mostrar ceros', () => {
  const s = resumenDelMes([r({ fecha: '2026-01-01' })], new Date('2026-08-15T12:00:00Z'))
  assert.equal(s.mes, 0)
  assert.equal(s.hayAlgo, false)
})

// ══ Presentación ════════════════════════════════════════════════════════════

test('el código PROA se muestra sin el relleno de unicidad', () => {
  assert.equal(codigoCorto('TCN|Ruta 16, Lote 121'), 'TCN')
  assert.equal(codigoCorto('TCD 68927'), 'TCD 68927')
  assert.equal(codigoCorto(null), '—')
})

test('operación y situación se leen en castellano, no como enum', () => {
  assert.equal(operacionLabel('VENTA'), 'Venta')
  assert.equal(operacionLabel('ALQUILER'), 'Alquiler')
  assert.match(situacionDe(r({ firmo: 'PENDIENTE' })), /Sin firmar/)
  assert.match(situacionDe(r({ firmo: 'FIRMADO' })), /Firmada/)
  assert.doesNotMatch(situacionDe(r()), /PENDIENTE/)
})
