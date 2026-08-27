import { createClient } from '@supabase/supabase-js'
import {
  verificarReciboCompatible,
  resolverColision,
  MAX_INTENTOS_RECIBO,
  type ReciboMinimo,
} from './cobro'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: { 'x-app-version': '2.0.0' },
  },
})

// ── Types ─────────────────────────────────────────────────────
export type ComprobanteEstado = 'pendiente' | 'cobrada' | 'anulada' | 'emitida' | 'faltan_retenciones' | 'echeq_pendiente'

export type Comprobante = {
  id: string
  tipo: string
  numero: number | null
  fecha: string
  cliente: string
  persona: string
  concepto: string | null
  monto_ars: number | null
  monto_usd: number | null
  tipo_cambio: number | null
  neto_ars: number | null
  neto_usd: number | null
  iva: number | null
  arba_ars: number | null
  arba_usd: number | null
  estado: ComprobanteEstado
  recibo_id: number | null
  fecha_cobro: string | null
  punto_venta: string  // '0002' | '0004' — default '0002'
  pdf_url?: string | null  // path en Supabase Storage (bucket comprobantes-pdfs)
  factura_asociada_id?: string | null
  // Payment tracking (populated when pago is registered)
  pago_recibido?:       boolean | null
  fecha_pago?:          string | null
  medio_pago?:          string | null
  importe_pagado?:      number | null
  referencia_pago?:     string | null
  observaciones_pago?:  string | null
  created_at: string
}

export type Recibo = {
  id: number
  fecha: string
  cliente: string
  nro_fact: string | null
  persona: string
  monto_ars: number | null
  monto_usd: number | null
  forma_pago: string | null
  retencion: number | null
  nro_echeq: string | null
  created_at: string
  // join from recibo_comprobantes (populated when queried with select join)
  recibo_comprobantes?: { comprobante_id: string }[]
}

// ── Retenciones ────────────────────────────────────────────────
export type TipoRetencion = 'ganancias' | 'iva' | 'iibb' | 'suss'

export type Retencion = {
  id: string
  comprobante_id: string
  tipo: TipoRetencion
  aplica: boolean
  recibida: boolean
  importe: number | null
  documento_ref: string | null
  fecha_recepcion: string | null
  created_at: string
}

/** Calcula el estado automáticamente en base a pago y retenciones. */
export function calcEstadoComprobante(
  pagoRecibido: boolean,
  retenciones: Pick<Retencion, 'aplica' | 'recibida'>[]
): ComprobanteEstado {
  if (!pagoRecibido) return 'pendiente'
  const faltantes = retenciones.filter(r => r.aplica && !r.recibida)
  return faltantes.length > 0 ? 'faltan_retenciones' : 'cobrada'
}

// ── API helpers ───────────────────────────────────────────────
export const db = {
  async getComprobantes(filters?: {
    tipo?: string; persona?: string; estado?: string; search?: string
  }) {
    let q = supabase
      .from('comprobantes')
      .select('*')
      .order('numero', { ascending: false })
      .order('fecha', { ascending: false })

    if (filters?.tipo && filters.tipo !== 'all') q = q.eq('tipo', filters.tipo)
    if (filters?.persona && filters.persona !== 'all') q = q.eq('persona', filters.persona)
    if (filters?.estado && filters.estado !== 'all') q = q.eq('estado', filters.estado)
    if (filters?.search) q = q.or(
      `cliente.ilike.%${filters.search}%,concepto.ilike.%${filters.search}%,id.ilike.%${filters.search}%`
    )

    const { data, error } = await q
    if (error) throw new Error(`Error al cargar comprobantes: ${error.message}`)
    return data as Comprobante[]
  },

  async getComprobante(id: string) {
    const { data, error } = await supabase
      .from('comprobantes').select('*').eq('id', id).single()
    if (error) throw new Error(`Comprobante ${id} no encontrado: ${error.message}`)
    return data as Comprobante
  },

  async createComprobante(payload: Omit<Comprobante, 'created_at'>) {
    const { data, error } = await supabase
      .from('comprobantes').insert(payload).select().single()
    if (error) throw new Error(`Error al crear comprobante: ${error.message}`)
    return data as Comprobante
  },

  async updateComprobante(id: string, patch: Partial<Comprobante>) {
    const { data, error } = await supabase
      .from('comprobantes').update(patch).eq('id', id).select().single()
    if (error) throw new Error(`Error al actualizar comprobante: ${error.message}`)
    return data as Comprobante
  },

  /**
   * ANULAR: el comprobante sigue existiendo, marcado como anulado.
   * Es lo que se usa en el 99% de los casos.
   *
   * Ojo con el nombre: `deleteComprobante` no borra. Se conserva porque lo
   * llaman varias pantallas y renombrarlo es un cambio aparte.
   */
  async deleteComprobante(id: string) {
    const { error } = await supabase
      .from('comprobantes')
      .update({ estado: 'anulada' as ComprobanteEstado, cliente: 'ANULADO' })
      .eq('id', id)
    if (error) throw new Error(`Error al anular comprobante: ${error.message}`)
  },

  /**
   * ELIMINAR de verdad: borra la fila. Permanente.
   *
   * Vivía como `supabase.from('comprobantes').delete()` suelto dentro de
   * Facturas.tsx — la única escritura de esa pantalla que esquivaba esta capa.
   * Mover no cambia nada: misma tabla, misma condición, mismos permisos
   * (RLS sigue siendo la autoridad), mismo texto de error.
   */
  async eliminarComprobante(id: string) {
    const { error } = await supabase.from('comprobantes').delete().eq('id', id)
    if (error) throw new Error(`Error al eliminar: ${error.message}`)
  },

  async getRecibos(search?: string) {
    let q = supabase.from('recibos').select('*, recibo_comprobantes(comprobante_id)').order('id', { ascending: false })
    if (search) q = q.or(`cliente.ilike.%${search}%,nro_fact.ilike.%${search}%`)
    const { data, error } = await q
    if (error) throw new Error(`Error al cargar recibos: ${error.message}`)
    return data as Recibo[]
  },

  async createRecibo(payload: Omit<Recibo, 'created_at'>) {
    const { data, error } = await supabase
      .from('recibos').insert(payload).select().single()
    if (error) throw new Error(`Error al crear recibo: ${error.message}`)
    const recibo = data as Recibo

    // Auto-cobrar la factura asociada (si el recibo tiene nro_fact).
    // nro_fact es el id del comprobante (ej. "FC-A-4086").
    if (recibo.nro_fact) {
      const { error: updErr } = await supabase
        .from('comprobantes')
        .update({
          estado: 'cobrada' as ComprobanteEstado,
          recibo_id: recibo.id,
          fecha_cobro: recibo.fecha,
        })
        .eq('id', recibo.nro_fact)
      if (updErr) {
        // No revertimos el recibo: avisamos al caller para que muestre warning.
        console.warn(`Recibo ${recibo.id} creado, pero no se pudo marcar la factura ${recibo.nro_fact} como cobrada:`, updErr.message)
        throw new Error(
          `Recibo ${recibo.id} guardado, pero no se pudo actualizar la factura ${recibo.nro_fact}: ${updErr.message}`
        )
      }
      // Mark pago_recibido on the comprobante
      await supabase.from('comprobantes')
        .update({ pago_recibido: true, fecha_pago: recibo.fecha, medio_pago: recibo.forma_pago })
        .eq('id', recibo.nro_fact)
    }
    return recibo
  },

  async getDashboardStats() {
    const { data: comps, error } = await supabase
      .from('comprobantes')
      // `neto_usd` faltaba: sin él, la rama de netoARS() que usa el neto real
      // de las facturas en USD era código muerto y el neto se derivaba
      // dividiendo el total por 1,21.
      .select('id,numero,tipo,persona,cliente,fecha,fecha_cobro,monto_ars,monto_usd,tipo_cambio,neto_ars,neto_usd,estado,punto_venta')
      .neq('estado', 'anulada')
    if (error) throw new Error(`Error al cargar dashboard: ${error.message}`)
    return { comprobantes: comps || [] }
  },

  /**
   * Datos del Inicio.
   *
   * Query propia, separada de `getDashboardStats()`, por dos razones:
   *   · el Inicio necesita `created_at` (para la actividad reciente) y
   *     `referencia_pago` (fecha de acreditación de e-cheq), que el dashboard
   *     no traía;
   *   · el Inicio ya no renderiza gráficos, así que pide menos columnas y no
   *     arrastra el costo de los cálculos analíticos.
   *
   * Trae también las anuladas: la lista de últimos comprobantes las muestra con
   * su badge. El filtrado por estado lo hace `lib/home.ts` según cada sección.
   */
  async getInicioData(): Promise<{ comprobantes: any[]; recibos: any[] }> {
    const [comps, recs] = await Promise.all([
      supabase
        .from('comprobantes')
        .select('id,numero,tipo,persona,cliente,fecha,estado,monto_ars,monto_usd,tipo_cambio,neto_ars,neto_usd,created_at,referencia_pago')
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('recibos')
        .select('id,fecha,cliente,monto_ars,monto_usd,nro_fact,created_at')
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    if (comps.error) throw new Error(`Error al cargar el inicio: ${comps.error.message}`)
    // Los recibos son sólo para la actividad reciente: si fallan, el resto de
    // la pantalla sigue siendo útil.
    return { comprobantes: comps.data ?? [], recibos: recs.error ? [] : (recs.data ?? []) }
  },

  // ── Recibo vinculado a múltiples facturas ──────────────────────
  async createReciboConFacturas(
    payload: Omit<Recibo, 'created_at' | 'recibo_comprobantes'>,
    comprobanteIds: string[]
  ): Promise<Recibo> {
    // 1. Insertar recibo (sin auto-cobrar — lo hacemos debajo para todos)
    const { data, error } = await supabase
      .from('recibos')
      .insert(payload)
      .select()
      .single()
    if (error) throw new Error(`Error al crear recibo: ${error.message}`)
    const recibo = data as Recibo

    if (comprobanteIds.length === 0) return recibo

    // 2. Insertar filas en recibo_comprobantes
    const { error: rcError } = await supabase
      .from('recibo_comprobantes')
      .insert(comprobanteIds.map(cid => ({ recibo_id: recibo.id, comprobante_id: cid })))
    if (rcError) {
      console.warn(`Recibo ${recibo.id} creado, error al vincular facturas:`, rcError.message)
    }

    // 3. Marcar todas las facturas vinculadas como cobradas
    const { error: updErr } = await supabase
      .from('comprobantes')
      .update({
        estado: 'cobrada' as ComprobanteEstado,
        recibo_id: recibo.id,
        fecha_cobro: payload.fecha,
        pago_recibido: true,
        fecha_pago: payload.fecha,
        medio_pago: payload.forma_pago,
      })
      .in('id', comprobanteIds)
    if (updErr) {
      console.warn(`Error marcando comprobantes como cobradas:`, updErr.message)
    }

    return recibo
  },

  // ── Supabase Storage: subir PDF de comprobante ─────────────────
  async uploadComprobantePDF(comprobanteId: string, file: File): Promise<string> {
    const path = `${comprobanteId}.pdf`
    const { error: uploadError } = await supabase.storage
      .from('comprobantes-pdfs')
      .upload(path, file, { upsert: true, contentType: 'application/pdf' })
    if (uploadError) throw new Error(`Error al subir PDF: ${uploadError.message}`)

    // Guardar el path en comprobantes.pdf_url
    const { error: updErr } = await supabase
      .from('comprobantes')
      .update({ pdf_url: path })
      .eq('id', comprobanteId)
    if (updErr) throw new Error(`PDF subido pero error al actualizar registro: ${updErr.message}`)

    return path
  },

  // ── Generar URL firmada para ver un PDF (1 hora de validez) ───
  async getPDFSignedUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from('comprobantes-pdfs')
      .createSignedUrl(path, 3600)
    if (error) throw new Error(`Error al generar URL del PDF: ${error.message}`)
    return data.signedUrl
  },

  // ── Retenciones ────────────────────────────────────────────────
  async getRetenciones(comprobanteId: string): Promise<Retencion[]> {
    const { data, error } = await supabase
      .from('retenciones')
      .select('*')
      .eq('comprobante_id', comprobanteId)
      .order('tipo')
    if (error) throw new Error(`Error al cargar retenciones: ${error.message}`)
    return (data || []) as Retencion[]
  },

  async upsertRetenciones(
    comprobanteId: string,
    items: Array<{
      tipo: TipoRetencion
      aplica: boolean
      recibida: boolean
      importe?: number | null
      documento_ref?: string | null
      fecha_recepcion?: string | null
    }>
  ): Promise<void> {
    const rows = items.map(item => ({ comprobante_id: comprobanteId, ...item }))
    const { error } = await supabase
      .from('retenciones')
      .upsert(rows, { onConflict: 'comprobante_id,tipo' })
    if (error) throw new Error(`Error al guardar retenciones: ${error.message}`)
  },

  // ── Registro de cobro (atómico) ────────────────────────────────
  /**
   * Vincula un comprobante a un recibo y lo marca como cobrado.
   *
   * Reemplaza al flujo anterior, que ante una colisión de ID (23505) se la
   * tragaba y vinculaba igual — pudiendo asociar la factura a un recibo de
   * OTRO CLIENTE mientras mostraba un toast de éxito.
   *
   * Garantías:
   *  1. Nunca vincula a un recibo cuyo cliente no coincida con el del
   *     comprobante (`verificarReciboCompatible`).
   *  2. Ante colisión de número, distingue reintento idempotente del mismo
   *     cobro de una carrera con otro usuario, y en ese caso renumera.
   *  3. Si falla la actualización del comprobante después de haber creado el
   *     recibo, elimina el recibo creado. No deja la operación a medias.
   *  4. Si algo falla, lanza. El llamador NO debe informar éxito.
   */
  async registrarCobro(input: {
    comprobante: Comprobante
    fecha: string
    formaPago: string
    reciboId: number
    /** true = el usuario eligió vincular a un recibo que ya existe */
    vincularAExistente: boolean
    nroEcheq?: string | null
  }): Promise<{ reciboId: number; creado: boolean; renumerado: boolean }> {
    const { comprobante: comp, fecha, formaPago, vincularAExistente, nroEcheq } = input

    const leerRecibo = async (id: number): Promise<ReciboMinimo | null> => {
      const { data } = await supabase
        .from('recibos')
        .select('id,cliente,nro_fact')
        .eq('id', id)
        .maybeSingle()
      return (data as ReciboMinimo) ?? null
    }

    let reciboId = input.reciboId
    let creado = false
    let renumerado = false

    if (vincularAExistente) {
      // ── Vincular a un recibo preexistente ───────────────────────
      const recibo = await leerRecibo(reciboId)
      const check = verificarReciboCompatible(recibo, comp)
      if (!check.ok) throw new Error(check.motivo)
    } else {
      // ── Crear recibo nuevo, tolerando carreras de numeración ────
      let asignado = false
      for (let intento = 0; intento < MAX_INTENTOS_RECIBO; intento++) {
        const { error } = await supabase.from('recibos').insert({
          id: reciboId,
          fecha,
          cliente: comp.cliente,
          nro_fact: comp.id,
          persona: comp.persona,
          monto_ars: comp.monto_ars,
          monto_usd: comp.monto_usd,
          forma_pago: formaPago,
          retencion: null,
          nro_echeq: nroEcheq || null,
        })

        if (!error) { creado = true; asignado = true; break }
        if (error.code !== '23505') {
          throw new Error('Error al crear recibo: ' + error.message)
        }

        // El número ya estaba ocupado. ¿Es este mismo cobro repetido, o es otro?
        const ocupante = await leerRecibo(reciboId)
        if (resolverColision(ocupante, comp) === 'reusar') {
          // Idempotencia: el recibo ya existía por un intento previo del
          // mismo cobro. Se reutiliza sin crear nada.
          asignado = true
          break
        }

        // Es un recibo de otra operación: tomar el siguiente número libre.
        const { data: ultimo } = await supabase
          .from('recibos').select('id').order('id', { ascending: false }).limit(1)
        const siguiente = ultimo && ultimo[0] ? ultimo[0].id + 1 : reciboId + 1
        reciboId = Math.max(siguiente, reciboId + 1)
        renumerado = true
      }

      if (!asignado) {
        throw new Error(
          `No se pudo asignar un número de recibo libre después de ${MAX_INTENTOS_RECIBO} intentos. ` +
          'Probablemente haya varias personas cobrando al mismo tiempo. Reintentá en unos segundos.'
        )
      }
    }

    // ── Aplicar el cobro al comprobante ──────────────────────────
    try {
      await this.updateComprobante(comp.id, {
        estado: 'cobrada',
        recibo_id: reciboId,
        fecha_cobro: fecha,
        pago_recibido: true,
        fecha_pago: fecha,
        medio_pago: formaPago,
      })
    } catch (e: any) {
      // Compensación: si creamos el recibo en este mismo flujo, lo deshacemos
      // para no dejar un recibo huérfano sin factura asociada.
      if (creado) {
        await supabase.from('recibos').delete().eq('id', reciboId)
      }
      throw new Error(
        `No se pudo marcar la factura como cobrada: ${e.message ?? e}. ` +
        'No se aplicó ningún cambio.'
      )
    }

    return { reciboId, creado, renumerado }
  },

  /** Recalcula y persiste el estado de un comprobante a partir de sus retenciones actuales. */
  async recalcEstado(comprobanteId: string): Promise<ComprobanteEstado> {
    const comp = await this.getComprobante(comprobanteId)
    const rets = await this.getRetenciones(comprobanteId)
    const nuevoEstado = calcEstadoComprobante(!!comp.pago_recibido, rets)
    await this.updateComprobante(comprobanteId, { estado: nuevoEstado })
    return nuevoEstado
  },
}
