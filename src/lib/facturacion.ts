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

/** Etiqueta corta, para el selector de vistas en pantallas angostas. */
export const TIPO_CORTO: Record<TipoFactura, string> = {
  'FACT A': 'A',
  'FACT B': 'B',
  'FACT DE CREDITO': 'FCE',
  'FACT E': 'E',
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

/* ══════════════════════════════════════════════════════════════════════════
   SEÑALES OPERATIVAS
   ══════════════════════════════════════════════════════════════════════════
   Lo que la pantalla tiene que contarte sin que preguntes.

   Regla de admisión, y es estricta: una señal entra sólo si (a) sale de
   campos que existen y están cargados, (b) tiene una regla exacta, y (c)
   lleva a una acción concreta. Si no conduce a hacer algo, no pertenece a
   Facturación — pertenece a Reportes.

   Y si hoy tiene cero casos, no se muestra. Una tarjeta que dice "0" ocupa
   el mismo lugar que una que dice algo.

   ── Lo que se verificó contra los datos reales antes de escribir esto ──

   · fecha_cobro   187/264 facturas   · fecha_pago      36/264
   · pago_recibido 200 true / 64 false · recibo_id      195/264
   · referencia_pago, importe_pagado, observaciones_pago: 0/264, vacíos en
     TODA la base. Por eso la señal de e-cheq no promete fecha de
     acreditación: el campo donde viviría no tiene un solo dato.

   ── Una equivalencia que importa ──

   "pagó pero todavía no tiene recibo" y `faltan_retenciones` son HOY el
   mismo conjunto, y no por casualidad: registrarCobro() marca
   pago_recibido=true sin crear recibo exactamente en esa rama, y toda
   factura `cobrada` sale con recibo_id. Medido: los 6 casos coinciden, 0
   cobradas sin recibo.

   Se calcula por la condición estructural (pago recibido y sin recibo) y no
   por el estado, para que si algún día divergen la señal siga apuntando al
   circuito y no a la etiqueta. Pero se muestra como UNA sola señal: dos
   tarjetas para las mismas seis facturas es contar dos veces el mismo
   trabajo, que es el error que ya habíamos corregido en el Inicio.
   ══════════════════════════════════════════════════════════════════════════ */

/** Días a partir de los cuales una pendiente se marca como antigua. */
export const DIAS_ANTIGUEDAD = 60

export type SenalId = 'retenciones' | 'echeq' | 'pendientes'

export type Senal = {
  id: SenalId
  titulo: string
  /** Una línea. Lo que hace falta saber para decidir si abrirla. */
  detalle: string
  /** Versión de teléfono: lo mismo en la mitad de caracteres. En 390px el
   *  detalle largo se parte en tres renglones y la señal deja de leerse de un
   *  vistazo, que es lo único que tenía que hacer. */
  detalleCorto: string
  /** Aclaración cuando el estado se puede malinterpretar. */
  nota?: string
  casos: number
  montoARS: number
  /** Con qué estados se abre la lista al tocarla. */
  estados: ComprobanteEstado[]
  tono: 'warning' | 'info' | 'violet'
}

function sumar(cs: Comprobante[]): number {
  return cs.reduce((s, c) => s + (c.monto_ars ?? 0), 0)
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/**
 * Pago recibido, recibo todavía no emitido.
 *
 * El dinero YA entró. Lo que falta son las retenciones para poder cerrar el
 * circuito. No es deuda del cliente: es trabajo administrativo propio, y por
 * eso el tono no es el de una pendiente.
 */
export function esperandoRetenciones(cs: Comprobante[]): Comprobante[] {
  return cs.filter(c => c.pago_recibido === true && !c.recibo_id && c.estado !== 'anulada')
}

export function echeqsPorAcreditar(cs: Comprobante[]): Comprobante[] {
  return cs.filter(c => c.estado === 'echeq_pendiente')
}

export function pendientesDeCobro(cs: Comprobante[]): Comprobante[] {
  return cs.filter(c => c.estado === 'pendiente')
}

/** Pendientes emitidas hace más de DIAS_ANTIGUEDAD. */
export function pendientesAntiguas(cs: Comprobante[], hoy: Date = new Date()): Comprobante[] {
  const corte = new Date(hoy)
  corte.setDate(corte.getDate() - DIAS_ANTIGUEDAD)
  const limite = corte.toISOString().slice(0, 10)
  return pendientesDeCobro(cs).filter(c => (c.fecha ?? '') < limite)
}

/**
 * Las señales activas, en orden de urgencia operativa.
 *
 * Primero lo que depende de que alguien te mande algo, después lo que
 * depende de que el cliente pague. Las de cero casos no salen.
 */
export function calcularSenales(cs: Comprobante[], hoy: Date = new Date()): Senal[] {
  const out: Senal[] = []

  const ret = esperandoRetenciones(cs)
  if (ret.length) {
    out.push({
      id: 'retenciones',
      titulo: 'Esperando retenciones',
      detalle: `${plural(ret.length, 'pago recibido', 'pagos recibidos')}, sin recibo emitido`,
      detalleCorto: plural(ret.length, 'pago', 'pagos'),
      nota: 'El pago ya entró',
      casos: ret.length,
      montoARS: sumar(ret),
      estados: ['faltan_retenciones'],
      tono: 'info',
    })
  }

  const ech = echeqsPorAcreditar(cs)
  if (ech.length) {
    out.push({
      id: 'echeq',
      titulo: 'E-cheqs por acreditar',
      // Sin fecha: referencia_pago está vacío en toda la base. Prometer un
      // "próximo: hoy" que sale de la nada es peor que no decir nada.
      detalle: plural(ech.length, 'e-cheq registrado', 'e-cheqs registrados'),
      detalleCorto: plural(ech.length, 'e-cheq', 'e-cheqs'),
      casos: ech.length,
      montoARS: sumar(ech),
      estados: ['echeq_pendiente'],
      tono: 'violet',
    })
  }

  const pend = pendientesDeCobro(cs)
  if (pend.length) {
    const viejas = pendientesAntiguas(cs, hoy)
    out.push({
      id: 'pendientes',
      titulo: 'Pendientes de cobro',
      detalle: plural(pend.length, 'factura', 'facturas'),
      detalleCorto: viejas.length
        ? `${pend.length} · ${viejas.length} +${DIAS_ANTIGUEDAD}d`
        : plural(pend.length, 'factura', 'facturas'),
      nota: viejas.length
        ? `${viejas.length} ${viejas.length === 1 ? 'lleva' : 'llevan'} más de ${DIAS_ANTIGUEDAD} días`
        : undefined,
      casos: pend.length,
      montoARS: sumar(pend),
      estados: ['pendiente'],
      tono: 'warning',
    })
  }

  return out
}

/* ── Hoy ─────────────────────────────────────────────────────────────────── */

export type ResumenHoy = {
  /** Pagos que entraron hoy, con recibo o sin él. */
  pagos: number
  montoPagos: number
  /** Facturas con fecha de hoy. */
  emitidas: number
  /** Sin movimientos hoy: cuántos pagos hubo en la última semana. */
  pagosSemana: number
  hayAlgo: boolean
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Un pago cuenta como "de hoy" si su fecha de cobro o su fecha de pago es hoy.
 *
 * Son dos campos porque son dos momentos del circuito: `fecha_cobro` la
 * escribe el cobro completo, `fecha_pago` la rama en la que el dinero entró
 * pero el recibo todavía no. Mirar sólo uno deja pagos reales afuera —
 * medido: hoy hay 2 pagos y los dos están sólo en `fecha_pago`.
 */
export function pagosDelDia(cs: Comprobante[], dia: string): Comprobante[] {
  return cs.filter(c => c.estado !== 'anulada' && (c.fecha_cobro === dia || c.fecha_pago === dia))
}

export function resumenHoy(cs: Comprobante[], hoy: Date = new Date()): ResumenHoy {
  const dia = iso(hoy)
  const pagos = pagosDelDia(cs, dia)
  const emitidas = cs.filter(c => c.fecha === dia && c.estado !== 'anulada')

  const haceUnaSemana = new Date(hoy)
  haceUnaSemana.setDate(haceUnaSemana.getDate() - 7)
  const desde = iso(haceUnaSemana)
  const pagosSemana = cs.filter(c =>
    c.estado !== 'anulada' &&
    ((c.fecha_cobro ?? '') >= desde || (c.fecha_pago ?? '') >= desde),
  ).length

  return {
    pagos: pagos.length,
    montoPagos: sumar(pagos),
    emitidas: emitidas.length,
    pagosSemana,
    hayAlgo: pagos.length > 0 || emitidas.length > 0,
  }
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
  //
  // En `faltan_retenciones` lo que falta es el RECIBO, no el cobro: el dinero
  // ya entró. Que las retenciones estén pendientes es información del
  // circuito —se ve en el estado y en su aclaración— pero no desplaza la
  // acción principal, que es emitir el recibo.
  //
  // La condición es que NO tenga recibo, no que esté en cierto estado.
  // Ofrecer "Emitir recibo" sobre un comprobante que ya lo tiene sería
  // invitar a duplicarlo. Hoy los dos coinciden —los 6 casos en
  // `faltan_retenciones` están sin recibo_id— pero atarlo al dato y no a la
  // etiqueta es lo que hace que siga siendo correcto si algún día divergen.
  const sinRecibo = !c.recibo_id

  if ((e === 'pendiente' || e === 'faltan_retenciones') && sinRecibo) {
    todas.push({
      id: 'cobrar',
      label: e === 'faltan_retenciones' ? 'Emitir recibo' : 'Registrar cobro',
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
  //
  // Normalmente es una acción secundaria: emitir el recibo es lo que cierra el
  // circuito. Pero si el recibo YA está emitido y el estado sigue en
  // `faltan_retenciones`, cargarlas es lo único que queda por hacer, y ahí sí
  // pasa a ser el siguiente paso.
  if (e === 'cobrada' || e === 'faltan_retenciones') {
    todas.push({
      id: 'retenciones',
      label: 'Cargar retenciones',
      primaria: e === 'faltan_retenciones' && !sinRecibo,
      permiso: 'comprobante.cobrar',
    })
  }
  // Una `cobrada` no tiene siguiente paso: el circuito está cerrado. Falta
  // poder saltar al recibo desde acá, pero la pantalla de Recibos todavía no
  // lee parámetros de ruta y hacérselos leer es trabajo de su propia fase.
  // Mientras tanto el número de recibo se muestra en el detalle.

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

/**
 * Con qué tipo abre el formulario de alta.
 *
 * Si estoy parado en Facturas B y toco "Nueva factura", el formulario tiene
 * que abrir en B. Volver a elegir algo que la interfaz ya sabe es exactamente
 * la clase de fricción que sobra.
 *
 * El usuario puede cambiarlo dentro del formulario; esto es sólo el default.
 */
export function tipoInicialPara(vista: string): TipoFactura {
  return (TIPOS_FACTURA as readonly string[]).includes(vista)
    ? (vista as TipoFactura)
    : 'FACT A'
}

/**
 * Importe abreviado, para lugares donde la precisión no aporta.
 *
 * "$66,7 M" en una señal dice lo mismo que "$66.732.770" —la magnitud del
 * problema— en un tercio del ancho. En la lista y en el detalle el importe va
 * completo, porque ahí sí se verifica.
 */
export function arsCorto(n: number | null | undefined): string {
  if (n == null) return '—'
  const abs = Math.abs(n)
  const signo = n < 0 ? '-' : ''
  const fmt = (v: number, d: number) =>
    v.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: d })
  if (abs >= 1_000_000) return `${signo}$\u202F${fmt(abs / 1_000_000, 1)} M`
  if (abs >= 1_000)     return `${signo}$\u202F${fmt(abs / 1_000, 0)} mil`
  return `${signo}$\u202F${fmt(abs, 0)}`
}

/**
 * Días desde la emisión. Se muestra en la tarjeta mobile de una pendiente:
 * "Pendiente · 74 días" dice más que la fecha sola, porque lo que importa de
 * una factura sin cobrar es cuánto hace que espera.
 */
export function diasDesde(iso: string | null | undefined, hoy: Date = new Date()): number | null {
  if (!iso) return null
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z')
  if (isNaN(d.getTime())) return null
  const hoyUTC = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())
  return Math.max(0, Math.round((hoyUTC - d.getTime()) / 86_400_000))
}

/** "26/08/2026" -> "26/08" para la lista mobile, donde el año suele sobrar. */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [, m, d] = iso.slice(0, 10).split('-')
  return d && m ? `${d}/${m}` : '—'
}
