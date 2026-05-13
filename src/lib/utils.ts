export const PERSONAS = [
  'TORIBIO ACHAVAL', 'COMERCIAL', 'CONSULTORIA',
  'EMPRENDIMIENTOS',
  'PLAT. BELGRANO', 'PLAT. PALERMO', 'PLAT. RECOLETA',
  'PLAT. CABALLITO', 'PLAT. PILAR', 'PLAT. BARILOCHE',
]

export const TIPOS_FACT = ['FACT A', 'FACT B', 'FACT DE CREDITO', 'FACT E']
export const TIPOS_NC   = ['NC A', 'NC B', 'NC FACT DE CREDITO']
export const TIPOS_ND   = ['ND A', 'ND B', 'ND FACT DE CREDITO']
export const TODOS_TIPOS = [...TIPOS_FACT, ...TIPOS_NC, ...TIPOS_ND]

// Puntos de venta AFIP — definir acá nuevos PV si la empresa los habilita
export const PUNTOS_VENTA = ['0002', '0004'] as const
export type PuntoVenta = typeof PUNTOS_VENTA[number]
export const PUNTO_VENTA_DEFAULT: PuntoVenta = '0002'

export const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export function ars(n: number | null | undefined): string {
  if (n == null) return '—'
  return '$\u202F' + Math.round(n).toLocaleString('es-AR')
}

export function usd(n: number | null | undefined): string {
  if (n == null) return '—'
  return 'U$S\u202F' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function fdate(d: string | null | undefined): string {
  if (!d) return '—'
  try { return d.slice(8,10) + '/' + d.slice(5,7) + '/' + d.slice(0,4) } catch { return d }
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function montoARS(f: { monto_ars?: number|null; monto_usd?: number|null; tipo_cambio?: number|null }): number {
  // Factura en USD → siempre se convierte usando el TC de la factura
  if (f.monto_usd) return f.tipo_cambio ? f.monto_usd * f.tipo_cambio : 0
  // Factura nativa en ARS
  return f.monto_ars || 0
}

export function tipoColor(t: string): string {
  if (!t) return 'badge-gray'
  if (t.startsWith('FACT A'))      return 'badge-blue'
  if (t.startsWith('FACT B'))      return 'badge-purple'
  if (t.startsWith('FACT DE'))     return 'badge-amber'
  if (t.startsWith('FACT E'))      return 'badge-teal'
  if (t.startsWith('NC'))          return 'badge-red'
  if (t.startsWith('ND'))          return 'badge-amber'
  return 'badge-gray'
}

export function estadoColor(e: string): string {
  if (e === 'cobrada')  return 'badge-green'
  if (e === 'pendiente') return 'badge-amber'
  if (e === 'anulada')   return 'badge-gray'
  return 'badge-gray'
}

export function buildComprobanteId(tipo: string, numero: number, pv: string = PUNTO_VENTA_DEFAULT): string {
  const prefix =
    tipo === 'FACT A' ? 'FC-A' :
    tipo === 'FACT B' ? 'FC-B' :
    tipo === 'FACT DE CREDITO' ? 'FC-FC' :
    tipo === 'FACT E' ? 'FC-E' :
    tipo.replace(/\s/g, '-')
  // PV 0002 mantiene el formato histórico para preservar los IDs viejos
  if (pv === PUNTO_VENTA_DEFAULT) return `${prefix}-${numero}`
  return `${prefix}-${pv}-${numero}`
}

export function downloadCSV(rows: (string | number | null)[][], filename: string) {
  const BOM = '\uFEFF'
  const csv = BOM + rows
    .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
