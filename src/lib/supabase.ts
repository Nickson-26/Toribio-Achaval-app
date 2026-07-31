import { createClient } from '@supabase/supabase-js'

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
export type ComprobanteEstado = 'pendiente' | 'cobrada' | 'anulada' | 'emitida' | 'faltan_retenciones'

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

  async deleteComprobante(id: string) {
    const { error } = await supabase
      .from('comprobantes')
      .update({ estado: 'anulada' as ComprobanteEstado, cliente: 'ANULADO' })
      .eq('id', id)
    if (error) throw new Error(`Error al anular comprobante: ${error.message}`)
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
      .select('id,numero,tipo,persona,cliente,fecha,fecha_cobro,monto_ars,monto_usd,tipo_cambio,neto_ars,estado,punto_venta')
      .neq('estado', 'anulada')
    if (error) throw new Error(`Error al cargar dashboard: ${error.message}`)
    return { comprobantes: comps || [] }
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

  /** Recalcula y persiste el estado de un comprobante a partir de sus retenciones actuales. */
  async recalcEstado(comprobanteId: string): Promise<ComprobanteEstado> {
    const comp = await this.getComprobante(comprobanteId)
    const rets = await this.getRetenciones(comprobanteId)
    const nuevoEstado = calcEstadoComprobante(!!comp.pago_recibido, rets)
    await this.updateComprobante(comprobanteId, { estado: nuevoEstado })
    return nuevoEstado
  },
}
