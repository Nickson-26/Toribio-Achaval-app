import { netoARS } from './fiscal.ts'
import type { ComprobanteEstado } from './supabase.ts'

/**
 * LÓGICA DEL INICIO — módulo puro y testeable.
 *
 * Sin React, sin Supabase: recibe filas y devuelve lo que la pantalla muestra.
 * Todo se calcula desde los datos reales del momento y de los filtros activos;
 * no hay ninguna cifra fijada en código.
 *
 * El Inicio responde, en este orden:
 *   1. ¿Qué necesita mi atención?
 *   2. ¿Qué quiero hacer?
 *   3. ¿Cómo está la situación?
 *   4. ¿Qué pasó recientemente?
 */

/**
 * Umbral de antigüedad de un comprobante pendiente.
 *
 * NO es una fecha de vencimiento: no existe un dato de vencimiento confiable en
 * el schema. Es sólo el tiempo que el comprobante lleva en estado `pendiente`.
 * Por eso el copy nunca dice "vencida", "atrasada" ni "morosa": dice
 * "llevan más de 60 días".
 */
export const DIAS_ANTIGUEDAD = 60

// ── Formas mínimas que necesita este módulo ─────────────────────────────────

export type ComprobanteHome = {
  id: string
  tipo?: string | null
  numero?: number | null
  fecha?: string | null
  cliente?: string | null
  persona?: string | null
  estado?: string | null
  monto_ars?: number | null
  monto_usd?: number | null
  tipo_cambio?: number | null
  neto_ars?: number | null
  neto_usd?: number | null
  created_at?: string | null
  referencia_pago?: string | null
}

export type ReciboHome = {
  id: number
  fecha?: string | null
  cliente?: string | null
  monto_ars?: number | null
  monto_usd?: number | null
  nro_fact?: string | null
  created_at?: string | null
}

export type FiltrosHome = {
  /** 'all' o 'MM' */
  mes: string
  /** 'all' o el valor de `persona` */
  unidad: string
  /** 'all' o 'YYYY'. Sólo se ofrece cuando hay más de un año en los datos. */
  anio: string
}

export const FILTROS_INICIALES: FiltrosHome = { mes: 'all', unidad: 'all', anio: 'all' }

// ── Utilidades ──────────────────────────────────────────────────────────────

const esFactura = (c: ComprobanteHome) => (c.tipo ?? '').startsWith('FACT')
const activo = (c: ComprobanteHome) => c.estado !== 'anulada'

/** Días transcurridos desde `fecha` (YYYY-MM-DD) hasta `hoy`. */
export function diasDesde(fecha: string | null | undefined, hoy: Date = new Date()): number | null {
  if (!fecha) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha)
  if (!m) return null
  const d = Date.UTC(+m[1], +m[2] - 1, +m[3])
  const h = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return Math.floor((h - d) / 86400000)
}

/** Años presentes en los datos, de mayor a menor. */
export function aniosDisponibles(comprobantes: ComprobanteHome[]): string[] {
  const s = new Set<string>()
  for (const c of comprobantes) if (c.fecha) s.add(c.fecha.slice(0, 4))
  return [...s].sort().reverse()
}

/**
 * ¿Corresponde ofrecer el selector de año?
 *
 * Con un solo año en la base, un selector de una sola opción es ruido. Aparece
 * solo cuando hay más de uno. La regla es dinámica: no está atada a 2026.
 */
export function mostrarFiltroAnio(comprobantes: ComprobanteHome[]): boolean {
  return aniosDisponibles(comprobantes).length > 1
}

/** Unidades de negocio con actividad, para el selector. */
export function unidadesDisponibles(comprobantes: ComprobanteHome[]): string[] {
  const s = new Set<string>()
  for (const c of comprobantes) if (c.persona) s.add(c.persona)
  return [...s].sort()
}

export function aplicarFiltros(comprobantes: ComprobanteHome[], f: FiltrosHome): ComprobanteHome[] {
  return comprobantes.filter(c => {
    if (f.anio !== 'all' && !(c.fecha ?? '').startsWith(f.anio)) return false
    if (f.mes !== 'all' && (c.fecha ?? '').slice(5, 7) !== f.mes) return false
    if (f.unidad !== 'all' && c.persona !== f.unidad) return false
    return true
  })
}

// ── 1. Para revisar ─────────────────────────────────────────────────────────

export type AttentionId = 'pendientes' | 'retenciones' | 'echeq' | 'solicitudes'

export type AttentionItem = {
  id: AttentionId
  titulo: string
  /** Línea de contexto principal. */
  detalle: string
  /** Importe en ARS, si aplica. `null` = el item no muestra monto. */
  monto: number | null
  cantidad: number
  /** Señal secundaria destacada, hoy sólo la usa `pendientes`. */
  destacado?: { texto: string; monto: number | null }
  tono: 'warning' | 'info' | 'brand'
  icono: string
  cta: string
  /** Destino de navegación. `null` = lo resuelve el componente. */
  estados?: ComprobanteEstado[]
}

const plural = (n: number, sing: string, plu: string) => `${n} ${n === 1 ? sing : plu}`

/**
 * Construye la cola de atención a partir de datos reales.
 *
 * Regla central: **un item con cantidad 0 no se devuelve.** La sección es
 * dinámica; no hay grilla fija ni cards vacías para mantener simetría.
 */
export function calcularAtencion(
  comprobantes: ComprobanteHome[],
  opts: { solicitudesPendientes?: number; puedeVerUsuarios?: boolean; hoy?: Date } = {}
): AttentionItem[] {
  const hoy = opts.hoy ?? new Date()
  const facturas = comprobantes.filter(c => esFactura(c) && activo(c))
  const items: AttentionItem[] = []

  // ── Pendientes de cobro, con la antigüedad DENTRO del mismo item ──
  // Pendientes y "pendientes hace más de N días" son el mismo universo: dos
  // cards separadas contarían dos veces las mismas facturas.
  const pendientes = facturas.filter(c => c.estado === 'pendiente')
  if (pendientes.length) {
    const viejas = pendientes.filter(c => {
      const d = diasDesde(c.fecha, hoy)
      return d !== null && d > DIAS_ANTIGUEDAD
    })
    items.push({
      id: 'pendientes',
      titulo: 'Facturas pendientes',
      detalle: plural(pendientes.length, 'factura pendiente', 'facturas pendientes'),
      monto: pendientes.reduce((s, c) => s + netoARS(c), 0),
      cantidad: pendientes.length,
      destacado: viejas.length
        ? {
            // Hecho objetivo, no juicio: no existe fecha de vencimiento en el
            // schema, así que no se dice "vencidas" ni "atrasadas".
            texto: `${viejas.length} ${viejas.length === 1 ? 'lleva' : 'llevan'} más de ${DIAS_ANTIGUEDAD} días`,
            monto: viejas.reduce((s, c) => s + netoARS(c), 0),
          }
        : undefined,
      tono: 'warning',
      icono: 'FileClock',
      cta: 'Ver pendientes',
      estados: ['pendiente'],
    })
  }

  // ── Faltan retenciones ──
  // El cliente YA PAGÓ. No es deuda: falta la información de retenciones para
  // poder cerrar el circuito y emitir el recibo. Por eso tono `info` y no el
  // warning de pendientes.
  const retenciones = facturas.filter(c => c.estado === 'faltan_retenciones')
  if (retenciones.length) {
    items.push({
      id: 'retenciones',
      titulo: 'Faltan retenciones',
      detalle: `Pago recibido · ${plural(retenciones.length, 'comprobante', 'comprobantes')}`,
      monto: retenciones.reduce((s, c) => s + netoARS(c), 0),
      cantidad: retenciones.length,
      tono: 'info',
      icono: 'FileCheck2',
      cta: 'Revisar',
      estados: ['faltan_retenciones'],
    })
  }

  // ── E-cheqs sin acreditar ──
  const echeq = facturas.filter(c => c.estado === 'echeq_pendiente')
  if (echeq.length) {
    const proxima = echeq
      .map(c => c.referencia_pago)
      .filter((f): f is string => !!f && /^\d{4}-\d{2}-\d{2}/.test(f))
      .sort()[0]
    items.push({
      id: 'echeq',
      titulo: 'E-cheqs pendientes',
      detalle: proxima
        ? `Próximo acredita el ${proxima.slice(8, 10)}/${proxima.slice(5, 7)}`
        : `${plural(echeq.length, 'e-cheq registrado', 'e-cheqs registrados')} sin acreditar`,
      monto: echeq.reduce((s, c) => s + netoARS(c), 0),
      cantidad: echeq.length,
      tono: 'brand',
      icono: 'CalendarClock',
      cta: 'Ver e-cheqs',
      estados: ['echeq_pendiente'],
    })
  }

  // ── Solicitudes de acceso — sólo admin ──
  const sol = opts.solicitudesPendientes ?? 0
  if (sol > 0 && opts.puedeVerUsuarios) {
    items.push({
      id: 'solicitudes',
      titulo: 'Solicitudes de acceso',
      detalle: `${plural(sol, 'usuario espera', 'usuarios esperan')} aprobación`,
      monto: null,
      cantidad: sol,
      tono: 'info',
      icono: 'UserPlus',
      cta: 'Revisar',
    })
  }

  return items
}

// ── 2. Resumen ──────────────────────────────────────────────────────────────

export type ResumenHome = {
  facturado: number
  cobrado: number
  /** Porcentaje del facturado que ya se cobró. Redondeado. */
  pctCobrado: number
  usd: number
  cantidadFacturas: number
  cantidadUSD: number
}

/**
 * Tres métricas, no cuatro.
 *
 * "Pendiente" NO está acá a propósito: ya aparece en la cola de atención con
 * cantidad, monto y antigüedad. Repetirlo sería el mismo número dos veces en la
 * misma pantalla, con menos contexto.
 * El % de cobranza tampoco es una métrica propia: es el subtexto de Cobrado.
 */
export function calcularResumen(comprobantes: ComprobanteHome[]): ResumenHome {
  const facturas = comprobantes.filter(c => esFactura(c) && activo(c))
  const cobradas = facturas.filter(c => c.estado === 'cobrada')
  const facturado = facturas.reduce((s, c) => s + netoARS(c), 0)
  const cobrado = cobradas.reduce((s, c) => s + netoARS(c), 0)
  const enUSD = facturas.filter(c => c.monto_usd)
  return {
    facturado,
    cobrado,
    pctCobrado: facturado > 0 ? Math.round((cobrado / facturado) * 100) : 0,
    usd: enUSD.reduce((s, c) => s + (c.monto_usd ?? 0), 0),
    cantidadFacturas: facturas.length,
    cantidadUSD: enUSD.length,
  }
}

// ── 3. Actividad reciente ───────────────────────────────────────────────────

export type Evento = {
  clave: string
  tipo: 'comprobante' | 'recibo'
  titulo: string
  cliente: string
  monto: number | null
  /** ISO completo si hay hora; si no, la fecha. */
  cuando: string
  /** Referencia para navegar. */
  ref: string
}

/**
 * Mezcla comprobantes y recibos por `created_at`.
 *
 * Verificado contra producción: los 263 comprobantes y los recibos tienen
 * `created_at` con hora real (concentrada en horario laboral), así que el
 * tiempo relativo es honesto y no inventa precisión.
 *
 * No se usa `audit_log`: es admin-only por RLS y mezclaría dos modelos de
 * permiso en una misma lista.
 */
export function construirActividad(
  comprobantes: ComprobanteHome[],
  recibos: ReciboHome[],
  limite = 6
): Evento[] {
  const eventos: Evento[] = []

  for (const c of comprobantes) {
    if (!c.created_at) continue
    const esNota = (c.tipo ?? '').startsWith('NC') || (c.tipo ?? '').startsWith('ND')
    eventos.push({
      clave: `c-${c.id}`,
      tipo: 'comprobante',
      titulo: `${esNota ? 'Nota' : 'Factura'} ${c.id} creada`,
      cliente: c.cliente ?? '—',
      monto: c.monto_ars ?? null,
      cuando: c.created_at,
      ref: c.id,
    })
  }

  for (const r of recibos) {
    if (!r.created_at) continue
    eventos.push({
      clave: `r-${r.id}`,
      tipo: 'recibo',
      titulo: `Recibo ${r.id} registrado`,
      cliente: r.cliente ?? '—',
      monto: r.monto_ars ?? null,
      cuando: r.created_at,
      ref: String(r.id),
    })
  }

  return eventos.sort((a, b) => b.cuando.localeCompare(a.cuando)).slice(0, limite)
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * Tiempo relativo, sin inventar precisión.
 *
 * Con hora disponible y menos de 24 h -> "hace N h" / "hace N min".
 * Ayer -> "ayer". Más atrás -> "18 ago".
 * Si el dato sólo trae fecha, nunca se muestran minutos ni horas.
 */
export function tiempoRelativo(iso: string | null | undefined, ahora: Date = new Date()): string {
  if (!iso) return ''
  const tieneHora = iso.length > 10 && iso.includes('T')
  const d = new Date(tieneHora ? iso : `${iso}T12:00:00`)
  if (isNaN(d.getTime())) return ''

  const dias = diasDesde(iso.slice(0, 10), ahora)

  if (tieneHora && dias === 0) {
    const min = Math.floor((ahora.getTime() - d.getTime()) / 60000)
    if (min < 1) return 'recién'
    if (min < 60) return `hace ${min} min`
    return `hace ${Math.floor(min / 60)} h`
  }
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias !== null && dias < 7) return `hace ${dias} días`
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`
}

// ── 4. Últimas facturas ─────────────────────────────────────────────────────

/**
 * Acceso rápido a los últimos comprobantes, no una réplica de la tabla de
 * Facturación: sólo comprobante, cliente, fecha, importe y estado.
 */
export function ultimasFacturas(comprobantes: ComprobanteHome[], limite = 6): ComprobanteHome[] {
  return comprobantes
    .filter(esFactura)
    .sort((a, b) => {
      const n = (b.numero ?? 0) - (a.numero ?? 0)
      if (n !== 0) return n
      return (b.fecha ?? '').localeCompare(a.fecha ?? '')
    })
    .slice(0, limite)
}

// ── Saludo ──────────────────────────────────────────────────────────────────

export function saludo(nombre: string | null | undefined, ahora: Date = new Date()): string {
  const h = ahora.getHours()
  const base = h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
  const primer = (nombre ?? '').trim().split(/\s+/)[0]
  return primer ? `${base}, ${primer}` : base
}
