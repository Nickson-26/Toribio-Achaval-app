import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UNIDAD_BY_PREFIX: Record<string, string> = {
  TAR: 'RESIDENCIAL', TCD: 'RESIDENCIAL', TMO: 'RESIDENCIAL', TRO: 'RESIDENCIAL',
  TJU: 'RESIDENCIAL', TCR: 'RESIDENCIAL', TBB: 'RESIDENCIAL', TNP: 'RESIDENCIAL',
  TSI: 'RESIDENCIAL', TPM: 'RESIDENCIAL', TAC: 'RESIDENCIAL', TBA: 'RESIDENCIAL',
  TPA: 'RESIDENCIAL', TPI: 'RESIDENCIAL', TCN: 'RESIDENCIAL', TRS: 'RESIDENCIAL',
  TCL: 'RESIDENCIAL',
  TOE: 'OFICINAS Y EDIFICIOS',
  TLT: 'LOCALES Y TERRENOS',
  TLL: 'LOCALES Y TERRENOS',
  TCO: 'CONSULTORIA',
  TII: 'INDUSTRIA',
  TAP: 'TAP',
  TAE: 'EMPRENDIMIENTOS',
  TES: 'EMPRENDIMIENTOS',
  TUC: 'EMPRENDIMIENTOS',
  TUN: 'EMPRENDIMIENTOS',
  TMC: 'EMPRENDIMIENTOS',
  TEG: 'EMPRENDIMIENTOS',
}

function getUnidad(codigo: string): string {
  const prefix = codigo.slice(0, 3).toUpperCase()
  return UNIDAD_BY_PREFIX[prefix] ?? 'RESIDENCIAL'
}

// Detecta si el monto de entrega es en USD ("u$s ...") o ARS ("$ ...")
function detectCurrency(montoEntregaRaw: any): 'usd' | 'ars' | null {
  if (!montoEntregaRaw) return null
  const s = String(montoEntregaRaw).toLowerCase().trim()
  if (s.startsWith('u$s') || s.startsWith('u$') || s.startsWith('usd')) return 'usd'
  if (s.startsWith('$')) return 'ars'
  return null
}

function parseExcelDate(raw: any): string {
  if (!raw) return new Date().toISOString().slice(0, 10)
  if (raw instanceof Date) return raw.toISOString().slice(0, 10)
  const str = String(raw).trim()
  const parts = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (parts) {
    return parts[3] + '-' + parts[2].padStart(2, '0') + '-' + parts[1].padStart(2, '0')
  }
  const dt = new Date(str)
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10)
  return new Date().toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  const buffer = await file.arrayBuffer()

  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.default.Workbook()
  await wb.xlsx.load(buffer)
  const ws = wb.worksheets[0]

  const records: any[] = []

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return

    const rawCodigo    = row.getCell(1).value
    const rawDireccion = row.getCell(4).value

    // Saltar filas vacias o de totales
    if (!rawCodigo || !rawDireccion) return
    const codigoStr    = String(rawCodigo).trim()
    const direccionStr = String(rawDireccion).trim()
    if (!codigoStr || !direccionStr) return
    if (codigoStr.toLowerCase().startsWith('total')) return

    const tipoInmueble    = String(row.getCell(2).value ?? '').trim()
    const precioPubRaw    = row.getCell(6).value
    const operacionRaw    = String(row.getCell(8).value ?? '').trim()
    const estadoRes       = String(row.getCell(11).value ?? '').trim()
    const fechaRaw        = row.getCell(12).value
    const precioResRaw    = row.getCell(13).value
    const montoEntregaRaw = row.getCell(17).value   // col 17: "Monto Entrega" — indica moneda
    const brokerRaw       = row.getCell(20).value   // col 20: "Broker 1"

    // Usar el código tal cual (nunca agregar pipe + dirección)
    const proaCodigo = codigoStr

    const op = operacionRaw.toLowerCase().includes('alquiler') ? 'ALQUILER' : 'VENTA'

    const precioPubStr    = precioPubRaw ? String(precioPubRaw).replace(/,/g, '') : ''
    const precioPublicado = precioPubStr ? parseFloat(precioPubStr) : null

    const precioResStr  = precioResRaw ? String(precioResRaw).replace(/,/g, '') : ''
    const precioReserva = precioResStr ? parseFloat(precioResStr) : null

    const fecha    = parseExcelDate(fechaRaw)
    const validPub = precioPublicado !== null && !isNaN(precioPublicado) ? precioPublicado : null
    const validRes = precioReserva !== null && !isNaN(precioReserva) ? precioReserva : null
    const broker   = brokerRaw ? String(brokerRaw).trim() || null : null

    // Detectar moneda: si Monto Entrega dice "u$s" → USD, si dice "$" → ARS
    // Por defecto: ventas en USD, alquileres según indicador (o USD si no hay indicador)
    const currency = detectCurrency(montoEntregaRaw) ?? (op === 'ALQUILER' ? null : 'usd')

    records.push({
      proa_codigo:      proaCodigo,
      tipo_inmueble:    tipoInmueble || null,
      direccion:        direccionStr,
      