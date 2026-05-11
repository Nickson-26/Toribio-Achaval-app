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
export type ComprobanteEstado = 'pendiente' | 'cobrada' | 'anulada' | 'emitida'

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
    let q = supabase.from('recibos').select('*').order('id', { ascending: false })
    if (search) q = q.or(`cliente.ilike.%${search}%,nro_fact.ilike.%${search}%`)
    const { data, error } = await q
    if (error) throw new Error(`Error al cargar recibos: ${error.message}`)
    return data as Recibo[]
  },

  async createRecibo(payload: Omit<Recibo, 'created_at'>) {
    const { data, error } = await supabase
      .from('recibos').insert(payload).select().single()
    if (error) throw new Error(`Error al crear recibo: ${error.message}`)
    return data as Recibo
  },

  async getDashboardStats() {
    const { data: comps, error } = await supabase
      .from('comprobantes')
      .select('id,numero,tipo,persona,cliente,fecha,fecha_cobro,monto_ars,monto_usd,tipo_cambio,neto_ars,estado')
      .neq('estado', 'anulada')
    if (error) throw new Error(`Error al cargar dashboard: ${error.message}`)
    return { comprobantes: comps || [] }
  },
}
