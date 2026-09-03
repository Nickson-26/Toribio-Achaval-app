import type { Recibo } from './supabase.ts'

/**
 * RECIBOS — cálculo puro.
 *
 * Misma forma que `lib/facturacion.ts`: filtros, opciones, contexto y
 * presentación, sin React y sin Supabase, para poder probarlo sin navegador.
 *
 * Lo que decidió la jerarquía de esta pantalla fue medir la base, no elegir
 * columnas bonitas. Sobre los 209 recibos de producción:
 *
 *   cliente        209/209    forma_pago  209/209  (transferencia 153 ·
 *   fecha          209/209                          efectivo 31 · e-cheq 25)
 *   persona        209/209    nro_fact    199/209
 *   monto_ars      180/209    nro_echeq    18/209
 *   monto_usd       32/209    retencion     0/209  <- vacío en toda la base
 *
 * Y el dato que más cambió el diseño: la tabla `recibo_comprobantes` tiene
 * CERO filas. La versión anterior mostraba "4128 +2" para recibos con varias
 * facturas — un caso que no ocurre nunca. El vínculo real con la factura es
 * `nro_fact`, uno solo. El soporte para la relación se conserva en el tipo y
 * en las lecturas, porque los recibos nuevos sí la escriben, pero no se le da
 * peso visual a algo que hoy no existe.
 */

// ── Filtros ─────────────────────────────────────────────────────────────────

export type FormaPago = 'all' | 'transferencia' | 'efectivo' | 'e-cheq'
export type Moneda = 'all' | 'ars' | 'usd'

export type FiltrosRecibos = {
  buscar: string
  anio: string
  mes: string
  persona: string
  formaPago: FormaPago
  moneda: Moneda
}

export const FILTROS_INICIALES: FiltrosRecibos = {
  buscar: '', anio: 'all', mes: 'all', persona: 'all', formaPago: 'all', moneda: 'all',
}

export function normalizar(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Facturas vinculadas a un recibo: por la relación si existe, si no por `nro_fact`. */
export function facturasDe(r: Recibo): string[] {
  const rel = (r.recibo_comprobantes ?? []).map(x => x.comprobante_id).filter(Boolean)
  if (rel.length) return rel
  return r.nro_fact ? [String(r.nro_fact)] : []
}

/** Busca por cliente, número de recibo y número de factura. */
export function coincideBusqueda(r: Recibo, termino: string): boolean {
  const q = normalizar(termino).trim()
  if (!q) return true
  const campos = [String(r.id), r.cliente, r.persona, r.nro_fact, ...facturasDe(r)]
  return campos.some(v => normalizar(v).includes(q))
}

export function esUSD(r: Recibo): boolean { return !!r.monto_usd }
export function esARS(r: Recibo): boolean { return !!r.monto_ars && !r.monto_usd }

export function aplicarFiltros(rs: Recibo[], f: FiltrosRecibos): Recibo[] {
  return rs.filter(r => {
    if (!coincideBusqueda(r, f.buscar)) return false
    if (f.anio !== 'all' && !(r.fecha ?? '').startsWith(f.anio)) return false
    if (f.mes !== 'all' && (r.fecha ?? '').slice(5, 7) !== f.mes) return false
    if (f.persona !== 'all' && r.persona !== f.persona) return false
    if (f.formaPago !== 'all' && r.forma_pago !== f.formaPago) return false
    if (f.moneda === 'ars' && !esARS(r)) return false
    if (f.moneda === 'usd' && !esUSD(r)) return false
    return true
  })
}

export function hayFiltros(f: FiltrosRecibos): boolean {
  return f.anio !== 'all' || f.mes !== 'all' || f.persona !== 'all' ||
    f.formaPago !== 'all' || f.moneda !== 'all'
}

export function contarFiltros(f: FiltrosRecibos): number {
  return [f.anio, f.mes, f.persona, f.formaPago, f.moneda].filter(v => v !== 'all').length
}

export type ChipRecibo = { clave: keyof FiltrosRecibos; label: string }

export function chipsActivos(f: FiltrosRecibos, mesLabel: (mm: string) => string): ChipRecibo[] {
  const out: ChipRecibo[] = []
  if (f.anio !== 'all') out.push({ clave: 'anio', label: f.anio })
  if (f.mes !== 'all') out.push({ clave: 'mes', label: mesLabel(f.mes) })
  if (f.persona !== 'all') out.push({ clave: 'persona', label: f.persona })
  if (f.formaPago !== 'all') out.push({ clave: 'formaPago', label: formaPagoLabel(f.formaPago) })
  if (f.moneda !== 'all') out.push({ clave: 'moneda', label: f.moneda === 'ars' ? 'Pesos' : 'Dólares' })
  return out
}

/** Más reciente primero: el número de recibo es correlativo. */
export function ordenar(rs: Recibo[]): Recibo[] {
  return [...rs].sort((a, b) => b.id - a.id)
}

export function opcionesAnio(rs: Recibo[]): string[] {
  const s = new Set<string>()
  for (const r of rs) { const a = (r.fecha ?? '').slice(0, 4); if (a.length === 4) s.add(a) }
  return [...s].sort().reverse()
}

export function opcionesPersona(rs: Recibo[]): string[] {
  return [...new Set(rs.map(r => r.persona).filter(Boolean))].sort()
}

/**
 * La forma de pago más común del conjunto.
 *
 * Sirve para no repetirla: 153 de los 209 recibos son por transferencia, así
 * que un badge "Transferencia" en casi todas las filas ocupa lugar para decir
 * lo mismo que la fila de arriba. Lo que informa es la EXCEPCIÓN —un efectivo,
 * un e-cheq que todavía tiene que acreditar— y esa sí se muestra.
 *
 * Se calcula sobre los datos y no está fijada a 'transferencia': si mañana la
 * mayoría pasa a ser otra, la regla se acomoda sola.
 */
export function formaPagoHabitual(rs: Recibo[]): string | null {
  if (rs.length < 5) return null   // con pocos recibos no hay "habitual"
  const cuenta = new Map<string, number>()
  for (const r of rs) {
    const v = r.forma_pago ?? ''
    if (v) cuenta.set(v, (cuenta.get(v) ?? 0) + 1)
  }
  const [top] = [...cuenta.entries()].sort((a, b) => b[1] - a[1])
  if (!top) return null
  // "Habitual" pide mayoría CLARA, no simple: con 6 contra 5 las dos formas
  // informan y esconder una sería esconder la mitad de los casos. Dos tercios
  // es el umbral; hoy transferencia está en 153 de 209 (73%).
  return top[1] / rs.length >= 0.66 ? top[0] : null
}

/** Formas de pago que existen de verdad en los datos, no una lista fija. */
export function formasPagoPresentes(rs: Recibo[]): string[] {
  return [...new Set(rs.map(r => r.forma_pago).filter(Boolean) as string[])].sort()
}

// ── Contexto de la pantalla ─────────────────────────────────────────────────

export type ResumenRecibos = {
  /** Recibos emitidos hoy. */
  hoy: number
  montoHoyARS: number
  /** Cuando hoy no pasó nada, el contexto de la semana. */
  semana: number
  hayAlgo: boolean
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Una línea de contexto, con el mismo criterio que "Hoy" en Facturación:
 * cuando no se emitió nada, la línea baja de presencia en vez de mostrar un
 * cero grande.
 */
export function resumenHoy(rs: Recibo[], hoy: Date = new Date()): ResumenRecibos {
  const dia = iso(hoy)
  const delDia = rs.filter(r => r.fecha === dia)

  const hace7 = new Date(hoy)
  hace7.setDate(hace7.getDate() - 7)
  const desde = iso(hace7)

  return {
    hoy: delDia.length,
    montoHoyARS: delDia.reduce((s, r) => s + (r.monto_ars ?? 0), 0),
    semana: rs.filter(r => (r.fecha ?? '') >= desde).length,
    hayAlgo: delDia.length > 0,
  }
}

export type TotalesRecibos = {
  cantidad: number
  ars: number
  usd: number
  cantidadUSD: number
}

export function calcularTotales(rs: Recibo[]): TotalesRecibos {
  return {
    cantidad: rs.length,
    ars: rs.reduce((s, r) => s + (r.monto_ars ?? 0), 0),
    usd: rs.reduce((s, r) => s + (r.monto_usd ?? 0), 0),
    cantidadUSD: rs.filter(esUSD).length,
  }
}

// ── Presentación ────────────────────────────────────────────────────────────

export function formaPagoLabel(fp: string | null | undefined): string {
  const v = (fp ?? '').toLowerCase()
  if (v === 'transferencia') return 'Transferencia'
  if (v === 'efectivo') return 'Efectivo'
  if (v === 'e-cheq') return 'E-cheq'
  return fp || '—'
}

/**
 * Qué cuenta este recibo, en una línea.
 *
 * Un e-cheq no es lo mismo que una transferencia —queda algo en tránsito— y
 * ese matiz es lo único de la forma de pago que cambia el trabajo del día.
 */
export function situacionDe(r: Recibo): string {
  const facturas = facturasDe(r)
  const porQue = facturas.length === 0
    ? 'Sin factura asociada'
    : facturas.length === 1
      ? `Factura ${facturas[0]}`
      : `${facturas.length} facturas`
  const como = (r.forma_pago ?? '').toLowerCase() === 'e-cheq' && r.nro_echeq
    ? `E-cheq ${r.nro_echeq}`
    : formaPagoLabel(r.forma_pago)
  return `${porQue} · ${como}`
}

/** Etiqueta corta de la factura para la fila. Vacío se dice, no se deja en blanco. */
export function facturaCorta(r: Recibo): string {
  const fs = facturasDe(r)
  if (!fs.length) return '—'
  return fs.length === 1 ? fs[0] : `${fs[0]} +${fs.length - 1}`
}
