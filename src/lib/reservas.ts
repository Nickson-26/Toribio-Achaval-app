import type { Reserva } from './supabase.ts'

/**
 * RESERVAS — cálculo puro.
 *
 * Acá vive la única definición de cómo se clasifica una reserva. Antes había
 * TRES tablas de prefijos PROA distintas y no coincidían entre sí:
 *
 *   sync-proa/route.ts     TCN -> 'PLAT. CANNING'      (correcta)
 *   import-excel/route.ts  TCN -> 'RESIDENCIAL'        (perdía la plataforma)
 *   Reservas.tsx           'PLAT. CANNING' en RESIDENCIAL_UNIDADES
 *   export-sheets/route.ts idem
 *
 * Resultado: Canning terminaba contado como Residencial, y según por dónde
 * hubiera entrado el dato la reserva quedaba con una unidad u otra. Se
 * unifica: un solo mapa de prefijos, una sola función de categoría, y las
 * cuatro rutas la importan.
 *
 * La regla de negocio corregida es:
 *
 *   TCN  ->  PLAT. CANNING  ->  EMPRENDIMIENTOS
 *
 * Nada de esto toca el schema ni reescribe datos.
 */

// ── Categorías de negocio ───────────────────────────────────────────────────

export const CATEGORIAS = ['EMPRENDIMIENTOS', 'RESIDENCIAL', 'COMERCIAL'] as const
export type Categoria = typeof CATEGORIAS[number]

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  EMPRENDIMIENTOS: 'Emprendimientos',
  RESIDENCIAL: 'Residencial',
  COMERCIAL: 'Comercial',
}

/**
 * Prefijo del código PROA -> unidad operativa.
 *
 * Es el mapa de `sync-proa`, que era el único que conservaba la plataforma,
 * más los prefijos que sólo conocía el importador de Excel. Cuando los dos
 * discrepaban gana el que preserva más información: TCN es PLAT. CANNING, no
 * un 'RESIDENCIAL' genérico.
 */
export const UNIDAD_POR_PREFIJO: Record<string, string> = {
  TAR: 'PLAT. PALERMO',    TCD: 'PLAT. PALERMO',
  TMO: 'PLAT. CABALLITO',  TRO: 'PLAT. CABALLITO',
  TJU: 'PLAT. RECOLETA',   TCR: 'PLAT. RECOLETA',
  TBB: 'PLAT. BELGRANO',   TNP: 'PLAT. BELGRANO',
  TBA: 'PLAT. BARILOCHE',
  TPA: 'PLAT. ANGOSTURA',
  TPI: 'PLAT. PILAR',
  TRS: 'DPTO DE BÚSQUEDA',
  // Canning es una plataforma de emprendimientos, no una residencial.
  TCN: 'PLAT. CANNING',
  // Prefijos que sólo estaban en el importador de Excel.
  TSI: 'RESIDENCIAL', TPM: 'RESIDENCIAL', TAC: 'RESIDENCIAL', TCL: 'RESIDENCIAL',
  TAE: 'EMPRENDIMIENTOS',  TES: 'EMPRENDIMIENTOS',
  TUC: 'EMPRENDIMIENTOS',  TMC: 'EMPRENDIMIENTOS',
  TUN: 'EMPRENDIMIENTOS',  TEG: 'EMPRENDIMIENTOS',
  TOE: 'OFICINAS Y EDIFICIOS',
  TLT: 'LOCALES Y TERRENOS',
  TLL: 'LOCALES Y TERRENOS',
  TCO: 'CONSULTORIA',
  TII: 'INDUSTRIA',
  TAP: 'TAP',
}

/** Unidades que son Emprendimientos. PLAT. CANNING entra acá, no en Residencial. */
export const UNIDADES_EMPRENDIMIENTOS = ['EMPRENDIMIENTOS', 'PLAT. CANNING']

export const UNIDADES_COMERCIAL = [
  'OFICINAS Y EDIFICIOS', 'LOCALES Y TERRENOS', 'CONSULTORIA', 'INDUSTRIA', 'TAP',
]

/** Prefijos PROA cuya categoría es Emprendimientos, mirando sólo el código. */
const PREFIJOS_EMPRENDIMIENTOS = Object.entries(UNIDAD_POR_PREFIJO)
  .filter(([, u]) => UNIDADES_EMPRENDIMIENTOS.includes(u))
  .map(([p]) => p)

/** Los tres primeros caracteres del código PROA, en mayúsculas. */
export function prefijoProa(codigo: string | null | undefined): string {
  return (codigo ?? '').trim().slice(0, 3).toUpperCase()
}

/** Unidad que corresponde a un código PROA. Sin código no hay respuesta. */
export function unidadDesdeProa(codigo: string | null | undefined): string | null {
  return UNIDAD_POR_PREFIJO[prefijoProa(codigo)] ?? null
}

/**
 * Categoría de negocio de una reserva.
 *
 * Mira la unidad guardada y, además, el código PROA. Ese segundo criterio
 * existe por un caso real: en la base hay reservas con `proa_codigo` "TCN …"
 * cuya `unidad` quedó como 'RESIDENCIAL', porque el importador de Excel viejo
 * pisaba la plataforma con un genérico. Son cuatro filas (ids 2216, 2228,
 * 2271, 2283) y están documentadas en RESERVAS_CANNING.md.
 *
 * El código PROA sólo puede SUMAR a Emprendimientos, nunca sacar una reserva
 * de la categoría que le da su unidad. Es deliberado: corrige el caso conocido
 * sin reacomodar en silencio filas que hoy están bien.
 *
 * Residencial es el complemento —lo que no es Emprendimientos ni Comercial—,
 * así que arreglar Emprendimientos arregla Residencial por construcción: una
 * reserva no puede quedar en las dos.
 */
export function categoriaDe(r: Pick<Reserva, 'unidad' | 'proa_codigo'>): Categoria {
  const unidad = (r.unidad ?? '').toUpperCase().trim()
  if (UNIDADES_EMPRENDIMIENTOS.includes(unidad)) return 'EMPRENDIMIENTOS'
  if (PREFIJOS_EMPRENDIMIENTOS.includes(prefijoProa(r.proa_codigo))) return 'EMPRENDIMIENTOS'
  if (UNIDADES_COMERCIAL.includes(unidad)) return 'COMERCIAL'
  return 'RESIDENCIAL'
}

export function porCategoria(rs: Reserva[], c: Categoria): Reserva[] {
  return rs.filter(r => categoriaDe(r) === c)
}

export function contarPorCategoria(rs: Reserva[]): Record<Categoria, number> {
  const out = { EMPRENDIMIENTOS: 0, RESIDENCIAL: 0, COMERCIAL: 0 } as Record<Categoria, number>
  for (const r of rs) out[categoriaDe(r)]++
  return out
}

// ── Filtros ─────────────────────────────────────────────────────────────────

export type Operacion = 'all' | 'VENTA' | 'ALQUILER'

export type FiltrosReservas = {
  buscar: string
  anio: string
  mes: string
  unidad: string
  operacion: Operacion
}

export const FILTROS_INICIALES: FiltrosReservas = {
  buscar: '', anio: 'all', mes: 'all', unidad: 'all', operacion: 'all',
}

export function normalizar(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Búsqueda por dirección, broker y código PROA.
 *
 * `cliente` NO se busca: está vacío en las 147 reservas de la base. Buscar en
 * una columna que nunca tiene nada no encuentra nada, y prometerlo en el
 * placeholder es peor que no ofrecerlo.
 */
export function coincideBusqueda(r: Reserva, termino: string): boolean {
  const q = normalizar(termino).trim()
  if (!q) return true
  return [r.direccion, r.broker, r.proa_codigo, r.unidad]
    .some(v => normalizar(v).includes(q))
}

export function aplicarFiltros(rs: Reserva[], f: FiltrosReservas): Reserva[] {
  return rs.filter(r => {
    if (!coincideBusqueda(r, f.buscar)) return false
    if (f.anio !== 'all' && !(r.fecha ?? '').startsWith(f.anio)) return false
    if (f.mes !== 'all' && (r.fecha ?? '').slice(5, 7) !== f.mes) return false
    if (f.unidad !== 'all' && r.unidad !== f.unidad) return false
    if (f.operacion !== 'all' && r.operacion !== f.operacion) return false
    return true
  })
}

export function hayFiltros(f: FiltrosReservas): boolean {
  return f.anio !== 'all' || f.mes !== 'all' || f.unidad !== 'all' || f.operacion !== 'all'
}

export function contarFiltros(f: FiltrosReservas): number {
  return [f.anio, f.mes, f.unidad].filter(v => v !== 'all').length +
    (f.operacion !== 'all' ? 1 : 0)
}

export type ChipReserva = { clave: keyof FiltrosReservas; label: string }

export function chipsActivos(f: FiltrosReservas, mesLabel: (mm: string) => string): ChipReserva[] {
  const out: ChipReserva[] = []
  if (f.anio !== 'all') out.push({ clave: 'anio', label: f.anio })
  if (f.mes !== 'all') out.push({ clave: 'mes', label: mesLabel(f.mes) })
  if (f.unidad !== 'all') out.push({ clave: 'unidad', label: f.unidad })
  if (f.operacion !== 'all') out.push({ clave: 'operacion', label: f.operacion === 'VENTA' ? 'Venta' : 'Alquiler' })
  return out
}

/** Más reciente primero. */
export function ordenar(rs: Reserva[]): Reserva[] {
  return [...rs].sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))
}

export function opcionesAnio(rs: Reserva[]): string[] {
  const s = new Set<string>()
  for (const r of rs) { const a = (r.fecha ?? '').slice(0, 4); if (a.length === 4) s.add(a) }
  return [...s].sort().reverse()
}

export function opcionesUnidad(rs: Reserva[]): string[] {
  return [...new Set(rs.map(r => r.unidad).filter(Boolean) as string[])].sort()
}

// ── Contexto de la pantalla ─────────────────────────────────────────────────

export type ResumenReservas = {
  /** Reservas del mes en curso. */
  mes: number
  montoUSD: number
  /** Cuántas de esas son ventas. */
  ventas: number
  hayAlgo: boolean
}

/**
 * Dos señales, no diez KPIs: cuántas reservas van este mes y por cuánto.
 *
 * El importe se mide en dólares porque es la moneda real del negocio: 120 de
 * las 147 reservas tienen monto en USD y sólo 27 en pesos. Sumar las dos en
 * un mismo número sería inventar un total que no existe.
 */
export function resumenDelMes(rs: Reserva[], hoy: Date = new Date()): ResumenReservas {
  const mm = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  const delMes = rs.filter(r => (r.fecha ?? '').startsWith(mm))
  return {
    mes: delMes.length,
    montoUSD: delMes.reduce((s, r) => s + (r.monto_usd ?? 0), 0),
    ventas: delMes.filter(r => r.operacion === 'VENTA').length,
    hayAlgo: delMes.length > 0,
  }
}

// ── Presentación ────────────────────────────────────────────────────────────

/**
 * El código PROA sin el relleno.
 *
 * Los códigos sin número traen la dirección pegada con "|" para poder cumplir
 * la restricción de unicidad ("TCN|Ruta 16, Lote 121"). Eso es plomería de la
 * importación y no tiene por qué llegar a la pantalla.
 */
export function codigoCorto(codigo: string | null | undefined): string {
  const c = (codigo ?? '').split('|')[0].trim()
  return c || '—'
}

/** Venta / Alquiler en lenguaje de persona, no el enum en mayúsculas. */
export function operacionLabel(op: string | null | undefined): string {
  const v = (op ?? '').toUpperCase()
  if (v === 'VENTA') return 'Venta'
  if (v === 'ALQUILER') return 'Alquiler'
  return op ?? '—'
}

/**
 * Qué se sabe de esta reserva, en una línea.
 *
 * `firmo` vale 'PENDIENTE' en las 147 filas de la base y `estado_reserva` vale
 * 'Reservada' o nada. Ninguno de los dos distingue una reserva de otra, así
 * que ninguno merece una columna; sí sirven adentro del detalle.
 */
export function situacionDe(r: Reserva): string {
  const partes: string[] = []
  if (r.estado_reserva) partes.push(r.estado_reserva)
  partes.push(r.firmo === 'FIRMADO' ? 'Firmada' : 'Sin firmar')
  return partes.join(' · ')
}
