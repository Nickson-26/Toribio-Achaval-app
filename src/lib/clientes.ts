import type { Comprobante, Recibo } from './supabase.ts'

/**
 * CLIENTES — agregación pura.
 *
 * No hay entidad cliente. La tabla `clientes` existe en el schema pero está
 * VACÍA, y el nombre vive como texto libre en `comprobantes.cliente` y
 * `recibos.cliente`. Este módulo deriva la vista de clientes de esas dos
 * fuentes, sin escribir nada y sin normalizar nombres.
 *
 * Medido sobre producción:
 *
 *   139 nombres distintos en comprobantes
 *   148 nombres distintos en recibos
 *   184 en la unión  <- 45 clientes existen SÓLO en recibos
 *
 * Por eso la agregación cruza las dos tablas: mirar sólo comprobantes dejaba
 * 45 clientes invisibles.
 *
 * ── Lo que NO hace, a propósito ──────────────────────────────────────────
 *
 * No normaliza, no deduplica y no hace backfill. En los datos hay pares como
 * "COMPAÑÍA INVERSORA RIO NEGRO" y "COMPAÑÍA INVERSORA RIO NEGRO S.A.", que
 * casi con seguridad son el mismo cliente escrito distinto. Unificarlos es
 * una decisión de negocio con consecuencias sobre datos históricos, no una
 * mejora de pantalla: se reporta, no se arregla acá.
 */

/** Un cliente, tal como se lo puede reconstruir de los documentos que tiene. */
export type Cliente = {
  /** El nombre tal cual está escrito. Es la clave: no hay id. */
  nombre: string
  facturas: number
  notas: number
  recibos: number
  /** Total de documentos, sin contar recibos. */
  documentos: number
  /** Facturas en estado `pendiente`. La señal operativa real. */
  pendientes: number
  /** Facturas con el pago recibido y el circuito sin cerrar. */
  porCerrar: number

  /* ── Importes ──────────────────────────────────────────────────────────
     Todos en la MISMA base: `monto_ars` / `monto_usd`, que son los totales
     con IVA. No se mezclan con `neto_ars`, y las dos monedas no se suman
     nunca entre sí: no hay tipo de cambio guardado y estimarlo sería
     inventar una cifra. */

  /** Facturas no anuladas. Es el bruto, antes de las notas. */
  facturadoArs: number
  facturadoUsd: number
  /** Notas de débito: aumentan lo facturado. */
  ndArs: number
  ndUsd: number
  /** Notas de crédito que descuentan de verdad (ver `descuenta()`). */
  ncArs: number
  ncUsd: number
  /** facturas − NC + ND. Puede dar negativo, y si da, es un dato real. */
  ars: number
  usd: number
  /** Fecha del movimiento más reciente, de cualquier tipo. */
  ultimo: string
  /** Unidades de negocio que le facturaron. */
  unidades: string[]
}

const esFactura = (c: Comprobante) => (c.tipo ?? '').startsWith('FACT')
const esNC = (c: Comprobante) => (c.tipo ?? '').startsWith('NC')
const esND = (c: Comprobante) => (c.tipo ?? '').startsWith('ND')
const esNota = (c: Comprobante) => esNC(c) || esND(c)

/**
 * ¿Esta nota de crédito tiene que restar?
 *
 * Casi siempre sí. La excepción es el caso que produciría un doble descuento:
 * cuando la NC canceló una factura que además quedó ANULADA. En ese caso la
 * cancelación ya está representada por la exclusión de la factura del total,
 * y restar la nota además la contaría dos veces.
 *
 *   factura 100 anulada (no suma) + NC 100 que la cancela  ->  0
 *   restando igual la NC daría -100, que es falso.
 *
 * Para saber que la NC canceló ESA factura no se adivina por importe, fecha
 * ni parecido de cliente: se usa `factura_asociada_id`, que es la única
 * relación que el modelo declara. Si no hay vínculo, la NC resta — que es lo
 * correcto para un ajuste que no cancela nada excluido.
 *
 * En los datos de hoy esta excepción no se activa nunca: las 7 NC de
 * producción tienen `factura_asociada_id` vacío. Existe para el flujo real
 * de alta, que sí escribe el vínculo y anula la factura, y para que el
 * cálculo no se rompa cuando eso ocurra.
 *
 * Nota sobre el otro camino de anulación: `db.deleteComprobante()` anula
 * poniendo además `cliente = 'ANULADO'`, así que esas facturas salen de la
 * agregación por nombre y no por estado. Las 23 anuladas de producción son
 * todas de ese tipo.
 */
function descuenta(nc: Comprobante, porId: Map<string, Comprobante>): boolean {
  if (!nc.factura_asociada_id) return true
  const factura = porId.get(nc.factura_asociada_id)
  if (!factura) return true          // vínculo roto: la factura no está
  return factura.estado !== 'anulada'
}

/** Un nombre que no identifica a nadie. Las anuladas pierden el cliente. */
const nombreValido = (n: string | null | undefined): n is string =>
  !!n && n.trim() !== '' && n !== 'ANULADO'

/**
 * Reconstruye la lista de clientes desde los documentos.
 *
 * Ordena por último movimiento, no por facturación. Con 111 de 184 clientes
 * con un solo documento, "quién facturó más" es un ranking con una cola larga
 * de gente que no vas a buscar nunca; "quién se movió último" es lo que
 * ordena una lista que se usa para encontrar a alguien.
 */
export function agregarClientes(comprobantes: Comprobante[], recibos: Recibo[]): Cliente[] {
  const mapa = new Map<string, Cliente & { _unidades: Set<string> }>()
  // Índice por id para poder mirar la factura que una NC dice cancelar.
  const porId = new Map(comprobantes.map(d => [d.id, d]))

  const traer = (nombre: string) => {
    let c = mapa.get(nombre)
    if (!c) {
      c = {
        nombre, facturas: 0, notas: 0, recibos: 0, documentos: 0,
        pendientes: 0, porCerrar: 0,
        facturadoArs: 0, facturadoUsd: 0, ndArs: 0, ndUsd: 0, ncArs: 0, ncUsd: 0,
        ars: 0, usd: 0, ultimo: '',
        unidades: [], _unidades: new Set<string>(),
      }
      mapa.set(nombre, c)
    }
    return c
  }

  for (const d of comprobantes) {
    if (!nombreValido(d.cliente)) continue
    const c = traer(d.cliente)
    if (esFactura(d)) c.facturas++
    else if (esNota(d)) c.notas++
    c.documentos++
    if (d.estado === 'pendiente') c.pendientes++
    if (d.estado === 'faltan_retenciones' || d.estado === 'echeq_pendiente') c.porCerrar++

    const ars = d.monto_ars ?? 0
    const usd = d.monto_usd ?? 0

    // Los importes se guardan SIEMPRE en positivo, también en las notas
    // —verificado: 0 de 7 NC tiene signo negativo—. El signo lo pone esta
    // función, no el dato.
    if (esNC(d)) {
      if (descuenta(d, porId)) { c.ncArs += ars; c.ncUsd += usd }
    } else if (esND(d)) {
      c.ndArs += ars; c.ndUsd += usd
    } else if (d.estado !== 'anulada') {
      // Una factura anulada no es facturación. Cuenta como documento pero no
      // suma plata.
      c.facturadoArs += ars; c.facturadoUsd += usd
    }

    if ((d.fecha ?? '') > c.ultimo) c.ultimo = d.fecha ?? ''
    if (d.persona) c._unidades.add(d.persona)
  }

  // Un recibo documenta un COBRO, no una facturación: no toca ningún
  // importe de esta agregación. Sólo suma al conteo y puede mover la fecha
  // del último movimiento.
  for (const r of recibos) {
    if (!nombreValido(r.cliente)) continue
    const c = traer(r.cliente)
    c.recibos++
    if ((r.fecha ?? '') > c.ultimo) c.ultimo = r.fecha ?? ''
    if (r.persona) c._unidades.add(r.persona)
  }

  return [...mapa.values()]
    .map(({ _unidades, ...c }) => ({
      ...c,
      unidades: [..._unidades].sort(),
      // facturas + ND − NC, cada moneda por su cuenta.
      ars: c.facturadoArs + c.ndArs - c.ncArs,
      usd: c.facturadoUsd + c.ndUsd - c.ncUsd,
    }))
    .sort((a, b) => b.ultimo.localeCompare(a.ultimo) || a.nombre.localeCompare(b.nombre))
}

// ── Filtros ─────────────────────────────────────────────────────────────────

export type FiltrosClientes = {
  buscar: string
  /** 'all' o el valor de `persona`. */
  unidad: string
  /** Sólo los que tienen algo pendiente de cobro. */
  soloPendientes: boolean
}

export const FILTROS_INICIALES: FiltrosClientes = {
  buscar: '', unidad: 'all', soloPendientes: false,
}

export function normalizar(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function coincideBusqueda(c: Cliente, termino: string): boolean {
  const q = normalizar(termino).trim()
  if (!q) return true
  return normalizar(c.nombre).includes(q) ||
    c.unidades.some(u => normalizar(u).includes(q))
}

export function aplicarFiltros(cs: Cliente[], f: FiltrosClientes): Cliente[] {
  return cs.filter(c => {
    if (!coincideBusqueda(c, f.buscar)) return false
    if (f.unidad !== 'all' && !c.unidades.includes(f.unidad)) return false
    if (f.soloPendientes && c.pendientes === 0) return false
    return true
  })
}

export function hayFiltros(f: FiltrosClientes): boolean {
  return f.unidad !== 'all' || f.soloPendientes
}

export function contarFiltros(f: FiltrosClientes): number {
  return (f.unidad !== 'all' ? 1 : 0) + (f.soloPendientes ? 1 : 0)
}

export type ChipCliente = { clave: keyof FiltrosClientes; label: string }

export function chipsActivos(f: FiltrosClientes): ChipCliente[] {
  const out: ChipCliente[] = []
  if (f.unidad !== 'all') out.push({ clave: 'unidad', label: f.unidad })
  if (f.soloPendientes) out.push({ clave: 'soloPendientes', label: 'Con pendientes' })
  return out
}

export function opcionesUnidad(cs: Cliente[]): string[] {
  const s = new Set<string>()
  for (const c of cs) for (const u of c.unidades) s.add(u)
  return [...s].sort()
}

// ── Contexto de la pantalla ─────────────────────────────────────────────────

export type ResumenClientes = {
  total: number
  /** Clientes con al menos una factura pendiente de cobro. */
  conPendientes: number
  /** Cuántas facturas pendientes suman entre todos. */
  facturasPendientes: number
  hayAlgo: boolean
}

/**
 * El contexto de Clientes no es "cuántos clientes hay" —eso es un número que
 * no cambia nada— sino cuántos tienen algo sin cobrar. Cuando no hay ninguno,
 * la línea se apaga, igual que en el resto de la app.
 */
export function resumenClientes(cs: Cliente[]): ResumenClientes {
  const conPend = cs.filter(c => c.pendientes > 0)
  return {
    total: cs.length,
    conPendientes: conPend.length,
    facturasPendientes: conPend.reduce((s, c) => s + c.pendientes, 0),
    hayAlgo: conPend.length > 0,
  }
}

// ── Documentos de un cliente ────────────────────────────────────────────────

export type MovimientoCliente = {
  clave: string
  tipo: 'comprobante' | 'recibo'
  /** "FACT A 4262", "NC A 425", "Recibo 19303". */
  titulo: string
  fecha: string
  ars: number | null
  usd: number | null
  /** Estado del comprobante; los recibos no tienen. */
  estado?: string
}

/**
 * Todo lo que le pasó a un cliente, en una sola línea de tiempo.
 *
 * Facturas, notas y recibos mezclados y ordenados por fecha: es la pregunta
 * que se hace alguien que abre un cliente —"¿qué pasó con este?"— y no tres
 * listas separadas que hay que reconciliar mentalmente.
 */
export function movimientosDe(
  nombre: string, comprobantes: Comprobante[], recibos: Recibo[],
): MovimientoCliente[] {
  const out: MovimientoCliente[] = []

  for (const d of comprobantes) {
    if (d.cliente !== nombre) continue
    out.push({
      clave: `c:${d.id}`,
      tipo: 'comprobante',
      titulo: `${d.tipo} ${d.numero}`,
      fecha: d.fecha ?? '',
      ars: d.monto_ars ?? null,
      usd: d.monto_usd ?? null,
      estado: d.estado,
    })
  }

  for (const r of recibos) {
    if (r.cliente !== nombre) continue
    out.push({
      clave: `r:${r.id}`,
      tipo: 'recibo',
      titulo: `Recibo ${r.id}`,
      fecha: r.fecha ?? '',
      ars: r.monto_ars ?? null,
      usd: r.monto_usd ?? null,
    })
  }

  return out.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.clave.localeCompare(a.clave))
}

// ── Presentación ────────────────────────────────────────────────────────────

/**
 * Qué le está pasando a este cliente, en una línea.
 *
 * Sale del dato, como en el resto de la app: primero lo que requiere acción,
 * después lo que sólo describe.
 */
export function situacionDe(c: Cliente): string {
  if (c.pendientes > 0) {
    return `${c.pendientes} ${c.pendientes === 1 ? 'factura pendiente' : 'facturas pendientes'}`
  }
  if (c.porCerrar > 0) {
    return `${c.porCerrar} ${c.porCerrar === 1 ? 'cobro sin cerrar' : 'cobros sin cerrar'}`
  }
  if (c.documentos === 0 && c.recibos > 0) return 'Sólo recibos'
  return 'Al día'
}

/**
 * En qué moneda se lee este cliente.
 *
 * Hay clientes facturados sólo en dólares: su `ars` es 0. Mostrar "$ 0" con
 * el importe real en chiquito abajo dice exactamente lo contrario de lo que
 * pasó. Cuando no hay pesos, el dólar es el importe principal.
 */
export function montoPrincipal(c: Cliente): { valor: number; moneda: 'ars' | 'usd' } {
  if (c.ars === 0 && c.usd !== 0) return { valor: c.usd, moneda: 'usd' }
  return { valor: c.ars, moneda: 'ars' }
}

/**
 * El importe secundario, si es que hay dos monedas de verdad.
 *
 * "De verdad" es que las dos tengan movimiento, no que las dos sean
 * positivas: un cliente con pesos en negativo y dólares en positivo tiene las
 * dos cifras y las dos importan.
 */
export function montoSecundario(c: Cliente): { valor: number; moneda: 'ars' | 'usd' } | null {
  if (c.ars !== 0 && c.usd !== 0) return { valor: c.usd, moneda: 'usd' }
  return null
}

/** ¿El total lleva notas adentro? Decide si vale la pena mostrar el desglose. */
export function tieneNotas(c: Cliente): boolean {
  return c.ncArs !== 0 || c.ncUsd !== 0 || c.ndArs !== 0 || c.ndUsd !== 0
}

export type DesgloseMoneda = {
  moneda: 'ars' | 'usd'
  facturado: number
  nd: number
  nc: number
  /** facturado + nd − nc, dentro de ESA moneda. */
  total: number
}

/**
 * El desglose del total, una entrada por moneda.
 *
 * Existe porque un cliente puede tener la factura en una moneda y la nota en
 * la otra —pasa hoy, en datos reales— y entonces no hay una resta única que
 * mostrar. Devuelve sólo las monedas en las que efectivamente hubo algo: si
 * alguien opera únicamente en pesos, no aparece un bloque de dólares en cero.
 */
export function desglosePorMoneda(c: Cliente): DesgloseMoneda[] {
  const filas: DesgloseMoneda[] = [
    { moneda: 'ars', facturado: c.facturadoArs, nd: c.ndArs, nc: c.ncArs, total: c.ars },
    { moneda: 'usd', facturado: c.facturadoUsd, nd: c.ndUsd, nc: c.ncUsd, total: c.usd },
  ]
  return filas.filter(f => f.facturado !== 0 || f.nd !== 0 || f.nc !== 0)
}

/** Cuántas cosas tiene, para la segunda línea de la fila. */
export function volumenDe(c: Cliente): string {
  const partes: string[] = []
  if (c.facturas > 0) partes.push(`${c.facturas} ${c.facturas === 1 ? 'factura' : 'facturas'}`)
  if (c.notas > 0) partes.push(`${c.notas} ${c.notas === 1 ? 'nota' : 'notas'}`)
  if (c.recibos > 0) partes.push(`${c.recibos} ${c.recibos === 1 ? 'recibo' : 'recibos'}`)
  return partes.join(' · ') || 'Sin documentos'
}
