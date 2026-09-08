import type { Comprobante } from './supabase.ts'

/**
 * DOCUMENTOS — Notas de Crédito y Notas de Débito.
 *
 * Las dos viven en `comprobantes`, separadas por el prefijo del `tipo`. No son
 * dos sistemas: son dos clases del mismo documento, así que comparten pantalla
 * y se separan con el mismo control segmentado que usa Facturación para
 * A/B/FCE/E.
 *
 * Este módulo NO toca nada fiscal. `discriminaIVA`, `desdeNeto`, la
 * numeración, el punto de venta, la anulación de la factura al emitir una NC y
 * su restauración al eliminarla siguen exactamente donde estaban. Acá sólo se
 * decide qué se muestra y cómo se lee.
 *
 * Medido sobre producción:
 *
 *   NC   7 filas — todas `estado='emitida'`, todas PV 0002, todas ARS o USD
 *   ND   0 filas
 *
 * Y el dato que decidió el diseño del detalle: `factura_asociada_id` está
 * VACÍO en las 7 NC. La relación existe en el modelo y la usa la lógica de
 * borrado —restaura la factura a `emitida`—, pero no hay datos. Igual que con
 * `recibo_comprobantes`: el soporte se conserva entero y se muestra cuando
 * haya algo; no se inventa ni se rellena.
 */

export const CLASES = ['NC', 'ND'] as const
export type Clase = typeof CLASES[number]

export const CLASE_LABEL: Record<Clase, string> = {
  NC: 'Notas de crédito',
  ND: 'Notas de débito',
}

export const CLASE_CORTO: Record<Clase, string> = {
  NC: 'Crédito',
  ND: 'Débito',
}

/** Singular, para títulos y microcopy. */
export const CLASE_SINGULAR: Record<Clase, string> = {
  NC: 'Nota de crédito',
  ND: 'Nota de débito',
}

export function claseDe(d: Comprobante): Clase | null {
  const t = (d.tipo ?? '').toUpperCase()
  if (t.startsWith('NC')) return 'NC'
  if (t.startsWith('ND')) return 'ND'
  return null
}

/** Sólo notas: las facturas viven en Facturación. */
export function soloNotas(comprobantes: Comprobante[]): Comprobante[] {
  return comprobantes.filter(d => claseDe(d) !== null)
}

export function porClase(ds: Comprobante[], c: Clase): Comprobante[] {
  return ds.filter(d => claseDe(d) === c)
}

export function contarPorClase(ds: Comprobante[]): Record<Clase, number> {
  const out = { NC: 0, ND: 0 } as Record<Clase, number>
  for (const d of ds) { const c = claseDe(d); if (c) out[c]++ }
  return out
}

// ── Filtros ─────────────────────────────────────────────────────────────────

export type FiltrosDocumentos = {
  buscar: string
  anio: string
  mes: string
  unidad: string
  puntoVenta: string
}

export const FILTROS_INICIALES: FiltrosDocumentos = {
  buscar: '', anio: 'all', mes: 'all', unidad: 'all', puntoVenta: 'all',
}

export const PV_DEFECTO = '0002'

export function puntoVentaDe(d: Comprobante): string {
  return d.punto_venta || PV_DEFECTO
}

export function normalizar(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Busca por número, cliente, concepto y por la factura asociada.
 *
 * Lo último importa: la pregunta típica no es "¿dónde está la NC 425?" sino
 * "¿esta factura tiene una nota de crédito?".
 */
export function coincideBusqueda(d: Comprobante, termino: string): boolean {
  const q = normalizar(termino).trim()
  if (!q) return true
  const campos = [
    String(d.numero ?? ''), d.id, d.cliente, d.persona, d.concepto,
    d.factura_asociada_id,
  ]
  return campos.some(v => normalizar(v).includes(q))
}

export function aplicarFiltros(ds: Comprobante[], f: FiltrosDocumentos): Comprobante[] {
  return ds.filter(d => {
    if (!coincideBusqueda(d, f.buscar)) return false
    if (f.anio !== 'all' && !(d.fecha ?? '').startsWith(f.anio)) return false
    if (f.mes !== 'all' && (d.fecha ?? '').slice(5, 7) !== f.mes) return false
    if (f.unidad !== 'all' && d.persona !== f.unidad) return false
    if (f.puntoVenta !== 'all' && puntoVentaDe(d) !== f.puntoVenta) return false
    return true
  })
}

export function hayFiltros(f: FiltrosDocumentos): boolean {
  return f.anio !== 'all' || f.mes !== 'all' || f.unidad !== 'all' || f.puntoVenta !== 'all'
}

export function contarFiltros(f: FiltrosDocumentos): number {
  return [f.anio, f.mes, f.unidad, f.puntoVenta].filter(v => v !== 'all').length
}

export type ChipDocumento = { clave: keyof FiltrosDocumentos; label: string }

export function chipsActivos(
  f: FiltrosDocumentos, mesLabel: (mm: string) => string,
): ChipDocumento[] {
  const out: ChipDocumento[] = []
  if (f.anio !== 'all') out.push({ clave: 'anio', label: f.anio })
  if (f.mes !== 'all') out.push({ clave: 'mes', label: mesLabel(f.mes) })
  if (f.unidad !== 'all') out.push({ clave: 'unidad', label: f.unidad })
  if (f.puntoVenta !== 'all') out.push({ clave: 'puntoVenta', label: `PV ${f.puntoVenta}` })
  return out
}

/** Más reciente primero. */
export function ordenar(ds: Comprobante[]): Comprobante[] {
  return [...ds].sort((a, b) =>
    (b.fecha ?? '').localeCompare(a.fecha ?? '') || (b.numero ?? 0) - (a.numero ?? 0))
}

export function opcionesAnio(ds: Comprobante[]): string[] {
  const s = new Set<string>()
  for (const d of ds) { const a = (d.fecha ?? '').slice(0, 4); if (a.length === 4) s.add(a) }
  return [...s].sort().reverse()
}

export function opcionesUnidad(ds: Comprobante[]): string[] {
  return [...new Set(ds.map(d => d.persona).filter(Boolean))].sort()
}

export function opcionesPuntoVenta(ds: Comprobante[]): string[] {
  return [...new Set(ds.map(puntoVentaDe))].sort()
}

// ── Contexto de la pantalla ─────────────────────────────────────────────────

export type ResumenDocumentos = {
  cantidad: number
  /** Las NC restan facturación: el total se muestra en negativo. */
  ars: number
  usd: number
  /** Cuántas tienen una factura vinculada. */
  conFactura: number
  hayAlgo: boolean
}

export function resumen(ds: Comprobante[]): ResumenDocumentos {
  return {
    cantidad: ds.length,
    ars: ds.reduce((s, d) => s + (d.monto_ars ?? 0), 0),
    usd: ds.reduce((s, d) => s + (d.monto_usd ?? 0), 0),
    conFactura: ds.filter(d => !!d.factura_asociada_id).length,
    hayAlgo: ds.length > 0,
  }
}

// ── Presentación ────────────────────────────────────────────────────────────

/**
 * Qué representa este documento, en una línea.
 *
 * Una nota de crédito con factura vinculada dice cuál: es el dato que explica
 * por qué existe. Sin vínculo lo dice también, porque es una diferencia real
 * —hoy las 7 de producción están así— y esconderla sería fingir que el
 * circuito está completo.
 */
export function situacionDe(d: Comprobante): string {
  const clase = claseDe(d)
  const que = clase === 'NC' ? 'Anula' : 'Ajusta'
  if (d.factura_asociada_id) return `${que} la factura ${d.factura_asociada_id}`
  return 'Sin factura vinculada'
}

/** El efecto sobre la facturación: una NC resta, una ND suma. */
export function signoDe(d: Comprobante): -1 | 1 {
  return claseDe(d) === 'NC' ? -1 : 1
}

/**
 * Las FACT B y las NC B no discriminan IVA.
 *
 * Se replica el criterio de `muestraDesagregado()` en Facturación para que el
 * detalle no ofrezca un desglose de neto e IVA que en esos tipos está vacío.
 */
export function muestraDesagregado(d: Comprobante): boolean {
  return !(d.tipo ?? '').toUpperCase().includes(' B')
}
