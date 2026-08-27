import type { Comprobante, ComprobanteEstado } from './supabase.ts'
import type { Accion } from '@/design/permissions'

/**
 * FACTURACIÓN — cálculo puro.
 *
 * Todo lo que decide QUÉ se ve y QUÉ se puede hacer vive acá, sin React y sin
 * Supabase, para que sea testeable sin navegador.
 *
 * Dos decisiones de la Fase 3 que este archivo materializa:
 *
 * 1. BÚSQUEDA Y FILTROS SOBRE EL MISMO UNIVERSO.
 *    Antes la búsqueda iba al servidor con `ilike` y los otros cinco filtros
 *    se aplicaban en memoria. Dos universos distintos: escribir en el buscador
 *    recargaba desde la base y los conteos bailaban. Como la pantalla ya
 *    cargaba la tabla entera igual, ahora todo se resuelve local sobre ese
 *    mismo dataset y los números siempre cierran entre sí.
 *
 *    Si el volumen crece materialmente —digamos, más de unos pocos miles de
 *    comprobantes— esto se migra a paginación + agregados server-side. Ese
 *    cambio implica que los totales dejen de calcularse sobre lo cargado y
 *    pasen a consultarse, así que es una decisión de backend, no de UI.
 *
 * 2. LAS ACCIONES SE CALCULAN, NO SE ESCRIBEN EN EL JSX.
 *    `accionesPara()` es la única fuente de verdad de qué puede hacerse con un
 *    comprobante, combinando su estado con el rol. Antes eran seis `hidden:`
 *    sueltos en el markup y ninguna referencia a permisos: un viewer veía
 *    "Eliminar".
 */

export const TIPOS_FACTURA = ['FACT A', 'FACT B', 'FACT DE CREDITO', 'FACT E'] as const
export type TipoFactura = typeof TIPOS_FACTURA[number]

export const TIPO_LABEL: Record<TipoFactura, string> = {
  'FACT A': 'Facturas A',
  'FACT B': 'Facturas B',
  'FACT DE CREDITO': 'FCE',
  'FACT E': 'Facturas E',
}

export type Moneda = 'all' | 'ars' | 'usd'

export type FiltrosFacturacion = {
  buscar: string
  estados: ComprobanteEstado[]
  anio: string
  unidad: string
  puntoVenta: string
  moneda: Moneda
}

export const FILTROS_INICIALES: FiltrosFacturacion = {
  buscar: '', estados: [], anio: 'all', unidad: 'all', puntoVenta: 'all', moneda: 'all',
}

/** El punto de venta viejo no siempre está cargado; la app asume 0002. */
export const PV_DEFECTO = '0002'

// ── Filtrado ────────────────────────────────────────────────────────────────

/**
 * Normaliza para buscar: sin acentos, sin mayúsculas.
 * "MAGNASCO" tiene que encontrarse escribiendo "magnasco", y "Consultoría"
 * escribiendo "consultoria".
 */
export function normalizar(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * ¿Este comprobante coincide con el texto buscado?
 *
 * Busca en número, cliente, unidad y concepto. El número se compara como
 * texto para que "426" encuentre 4260..4269, que es cómo la gente busca una
 * factura que recuerda a medias.
 */
export function coincideBusqueda(c: Comprobante, termino: string): boolean {
  const q = normalizar(termino).trim()
  if (!q) return true
  const campos = [
    String(c.numero ?? ''),
    c.id,
    c.cliente,
    c.persona,
    c.concepto,
  ]
  return campos.some(v => normalizar(v).includes(q))
}

export function esARS(c: Comprobante): boolean {
  return !!c.monto_ars && !c.monto_usd
}
export function esUSD(c: Comprobante): boolean {
  return !!c.monto_usd
}

export function puntoVentaDe(c: Comprobante): string {
  return c.punto_venta || PV_DEFECTO
}

/**
 * Aplica TODOS los filtros excepto el tipo de comprobante.
 *
 * El tipo se aplica aparte porque los tabs necesitan contar cada tipo con el
 * resto de los filtros ya puestos: si filtro por "pendiente", el tab de
 * Facturas B tiene que decir cuántas B pendientes hay, no cuántas B hay.
 */
export function aplicarFiltros(
  comprobantes: Comprobante[],
  f: FiltrosFacturacion,
): Comprobante[] {
  return comprobantes.filter(c => {
    if (!coincideBusqueda(c, f.buscar)) return false
    if (f.anio !== 'all' && !(c.fecha ?? '').startsWith(f.anio)) return false
    if (f.unidad !== 'all' && c.persona !== f.unidad) return false
    if (f.puntoVenta !== 'all' && puntoVentaDe(c) !== f.puntoVenta) return false
    if (f.moneda === 'ars' && !esARS(c)) return false
    if (f.moneda === 'usd' && !esUSD(c)) return false
    if (f.estados.length > 0 && !f.estados.includes(c.estado)) return false
    return true
  })
}

/** Sólo facturas. Las NC y ND viven en sus propias pantallas. */
export function soloFacturas(comprobantes: Comprobante[]): Comprobante[] {
  return comprobantes.filter(c => (c.tipo ?? '').startsWith('FACT'))
}

/** Más reciente primero, que es como se mira una lista de facturación. */
export function ordenar(comprobantes: Comprobante[]): Comprobante[] {
  return [...comprobantes].sort((a, b) => (b.numero ?? 0) - (a.numero ?? 0))
}

// ── Conteos y totales ───────────────────────────────────────────────────────

export function contarPorTipo(filtrados: Comprobante[]): Record<TipoFactura, number> {
  const out = { 'FACT A': 0, 'FACT B': 0, 'FACT DE CREDITO': 0, 'FACT E': 0 } as Record<TipoFactura, number>
  for (const c of filtrados) {
    if (c.tipo in out) out[c.tipo as TipoFactura]++
  }
  return out
}

export type TotalesFacturacion = {
  cantidad: number
  ars: number
  usd: number
  cantidadUSD: number
  pendientes: number
  faltanRetenciones: number
}

/**
 * Totales de lo que está a la vista.
 *
 * Deliberadamente se calculan sobre las filas filtradas y no sobre el
 * universo: si el usuario filtró, los números tienen que hablar de lo que
 * está mirando. Las anuladas se excluyen de los importes —no son facturación
 * real— pero siguen contándose como comprobantes.
 */
export function calcularTotales(filtrados: Comprobante[]): TotalesFacturacion {
  const vivas = filtrados.filter(c => c.estado !== 'anulada')
  return {
    cantidad: filtrados.length,
    ars: vivas.reduce((s, c) => s + (c.monto_ars ?? 0), 0),
    usd: vivas.filter(esUSD).reduce((s, c) => s + (c.monto_usd ?? 0), 0),
    cantidadUSD: vivas.filter(esUSD).length,
    pendientes: filtrados.filter(c => c.estado === 'pendiente').length,
    faltanRetenciones: filtrados.filter(c => c.estado === 'faltan_retenciones').length,
  }
}

// ── Opciones de filtro derivadas de los datos ───────────────────────────────

/** Años presentes, descendente. Antes estaba hardcodeado a 2024/2025/2026. */
export function opcionesAnio(comprobantes: Comprobante[]): string[] {
  const s = new Set<string>()
  for (const c of comprobantes) {
    const a = (c.fecha ?? '').slice(0, 4)
    if (a.length === 4) s.add(a)
  }
  return [...s].sort().reverse()
}

export function opcionesUnidad(comprobantes: Comprobante[]): string[] {
  return [...new Set(comprobantes.map(c => c.persona).filter(Boolean))].sort()
}

export function opcionesPuntoVenta(comprobantes: Comprobante[]): string[] {
  return [...new Set(comprobantes.map(puntoVentaDe))].sort()
}

/**
 * Estados que existen de verdad en los datos.
 *
 * `emitida` no estaba entre los chips y sus comprobantes eran invisibles salvo
 * que no filtraras por estado. En vez de agregarlo a mano y arriesgar el mismo
 * olvido con el próximo estado, la lista se deriva.
 */
export function estadosPresentes(
  comprobantes: Comprobante[],
  orden: ComprobanteEstado[],
): ComprobanteEstado[] {
  const s = new Set(comprobantes.map(c => c.estado))
  return orden.filter(e => s.has(e))
}

// ── Filtros activos, para poder mostrarlos y sacarlos ───────────────────────

export type ChipFiltro = {
  /** Qué campo limpiar al tocar la X. Los estados se quitan de a uno. */
  clave: keyof FiltrosFacturacion
  /** Sólo para estados: cuál sacar. */
  valor?: string
  label: string
}

/**
 * Los filtros activos como chips removibles.
 *
 * Sin esto, una lista corta es indistinguible de una lista vacía: el usuario
 * no ve por qué faltan filas. `etiquetaEstado` se inyecta para que este
 * módulo no dependa de la capa de diseño.
 */
export function chipsActivos(
  f: FiltrosFacturacion,
  etiquetaEstado: (e: string) => string,
): ChipFiltro[] {
  const out: ChipFiltro[] = []
  if (f.anio !== 'all')       out.push({ clave: 'anio', label: f.anio })
  if (f.unidad !== 'all')     out.push({ clave: 'unidad', label: f.unidad })
  if (f.puntoVenta !== 'all') out.push({ clave: 'puntoVenta', label: `PV ${f.puntoVenta}` })
  if (f.moneda !== 'all')     out.push({ clave: 'moneda', label: f.moneda === 'ars' ? 'Solo pesos' : 'Solo dólares' })
  for (const e of f.estados)  out.push({ clave: 'estados', valor: e, label: etiquetaEstado(e) })
  return out
}

export function hayFiltros(f: FiltrosFacturacion): boolean {
  return f.estados.length > 0 || f.anio !== 'all' || f.unidad !== 'all' ||
         f.puntoVenta !== 'all' || f.moneda !== 'all' || f.buscar.trim() !== ''
}

/** Cuántos filtros hay puestos, para el badge del botón. La búsqueda no cuenta:
 *  ya se ve escrita en su campo. */
export function contarFiltros(f: FiltrosFacturacion): number {
  return f.estados.length +
    (f.anio !== 'all' ? 1 : 0) +
    (f.unidad !== 'all' ? 1 : 0) +
    (f.puntoVenta !== 'all' ? 1 : 0) +
    (f.moneda !== 'all' ? 1 : 0)
}

// ── Acciones ────────────────────────────────────────────────────────────────

export type AccionId =
  | 'ver' | 'editar' | 'cobrar' | 'acreditacion' | 'retenciones' | 'anular' | 'eliminar'

export type AccionFactura = {
  id: AccionId
  label: string
  /** La que se ofrece primero: el siguiente paso natural del comprobante. */
  primaria?: boolean
  peligrosa?: boolean
  /** Permiso requerido. `undefined` = sólo lectura, cualquiera puede. */
  permiso?: Accion
}

/**
 * Qué se puede hacer con este comprobante, según su estado Y el rol.
 *
 * Un viewer recibe únicamente `ver`. La decisión de producto es que no vea
 * botones deshabilitados: un botón gris igual promete algo que no va a pasar.
 *
 * Recordatorio de siempre: esto es UX. La autoridad real es RLS.
 */
export function accionesPara(
  c: Comprobante,
  puedeHacer: (a: Accion) => boolean,
): AccionFactura[] {
  const todas: AccionFactura[] = []
  const e = c.estado

  // El siguiente paso operativo depende de dónde está parado el comprobante.
  if (e === 'pendiente' || e === 'faltan_retenciones') {
    todas.push({
      id: 'cobrar',
      label: e === 'faltan_retenciones' ? 'Completar cobro' : 'Registrar cobro',
      primaria: true,
      permiso: 'comprobante.cobrar',
    })
  }
  if (e === 'echeq_pendiente') {
    todas.push({
      id: 'acreditacion', label: 'Confirmar acreditación',
      primaria: true, permiso: 'comprobante.cobrar',
    })
  }
  // Las retenciones se gestionan cuando el dinero ya entró.
  if (e === 'cobrada' || e === 'faltan_retenciones') {
    todas.push({ id: 'retenciones', label: 'Retenciones', permiso: 'comprobante.cobrar' })
  }

  if (e !== 'anulada') {
    todas.push({ id: 'editar', label: 'Editar', permiso: 'comprobante.editar' })
    todas.push({ id: 'anular', label: 'Anular', permiso: 'comprobante.anular' })
  }
  todas.push({ id: 'eliminar', label: 'Eliminar', peligrosa: true, permiso: 'comprobante.eliminar' })

  return todas.filter(a => !a.permiso || puedeHacer(a.permiso))
}

/** La acción que la tarjeta mobile ofrece directamente, si hay alguna. */
export function accionPrimaria(
  c: Comprobante,
  puedeHacer: (a: Accion) => boolean,
): AccionFactura | null {
  return accionesPara(c, puedeHacer).find(a => a.primaria) ?? null
}

// ── Presentación ────────────────────────────────────────────────────────────

/**
 * Las FACT B no discriminan IVA: mostrar columnas de neto e IVA vacías para
 * cincuenta filas es ruido.
 */
export function muestraDesagregado(tipo: string): boolean {
  return tipo !== 'FACT B'
}

/** "26/08/2026" -> "26/08" para la lista mobile, donde el año suele sobrar. */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [, m, d] = iso.slice(0, 10).split('-')
  return d && m ? `${d}/${m}` : '—'
}
