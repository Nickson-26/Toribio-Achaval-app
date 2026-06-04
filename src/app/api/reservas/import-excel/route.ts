import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Columnas del Excel PROA sincronizadas (A,B,D,F,K,M + H,L para la DB):
//   A (1)  = Codigo Propiedad -> proa_codigo
//   B (2)  = Tipo             -> tipo_inmueble
//   D (4)  = Direccion        -> direccion
//   F (6)  = Precio Publicado -> precio_publicado
//   H (8)  = Operacion        -> operacion
//   K (11) = Estado Reserva   -> estado_reserva
//   L (12) = Fecha Reserva    -> fecha
//   M (13) = Precio Reserva   -> precio_reserva
//
// UPSERT por proa_codigo si el codigo tiene numero (ej: TRS 65556).
// Si el codigo es solo prefijo sin numero (ej: TRS), se inserta sin proa_codigo.

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

function hasNumber(s: string): boolean {
  return /\d/.test(s)
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

function buildRecord(codigo: string, tipoInmueble: string, direccion: string,
  precioPubRaw: any, operacionRaw: string, estadoRes: string,
  fechaRaw: any, precioResRaw: any): any {

  const op = operacionRaw.toLowerCase().includes('alquiler') ? 'ALQUILER' : 'VENTA'

  const precioPubStr    = precioPubRaw ? String(precioPubRaw).replace(/,/g, '') : ''
  const precioPublicado = precioPubStr ? parseFloat(precioPubStr) : null

  const precioResStr  = precioResRaw ? String(precioResRaw).replace(/,/g, '') : ''
  const precioReserva = precioResStr ? parseFloat(precioResStr) : null

  const fecha    = parseExcelDate(fechaRaw)
  const validPub = precioPublicado !== null && !isNaN(precioPublicado) ? precioPublicado : null
  const validRes = precioReserva !== null && !isNaN(precioReserva) ? precioReserva : null

  return {
    tipo_inmueble:    tipoInmueble || null,
    direccion:        direccion,
    precio_publicado: validPub,
    operacion:        op,
    estado_reserva:   estadoRes || null,
    precio_reserva:   validRes,
    fecha:            fecha,
    unidad:           getUnidad(codigo),
    firmo:            'PENDIENTE',
    broker:           null,
    cliente:          null,
    monto_ars:        null,
    monto_usd:        validRes,
  }
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

  // Batch 1: codigos con numero -> upsert por proa_codigo
  const upsertRecords: any[] = []
  // Batch 2: codigos solo prefijo sin numero -> insert sin proa_codigo
  const insertRecords: any[] = []

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return

    const codigo       = String(row.getCell(1).value ?? '').trim()
    const tipoInmueble = String(row.getCell(2).value ?? '').trim()
    const direccion    = String(row.getCell(4).value ?? '').trim()
    const precioPubRaw = row.getCell(6).value
    const operacionRaw = String(row.getCell(8).value ?? '').trim()
    const estadoRes    = String(row.getCell(11).value ?? '').trim()
    const fechaRaw     = row.getCell(12).value
    const precioResRaw = row.getCell(13).value

    if (!codigo || !direccion) return

    const base = buildRecord(codigo, tipoInmueble, direccion,
      precioPubRaw, operacionRaw, estadoRes, fechaRaw, precioResRaw)

    if (hasNumber(codigo)) {
      upsertRecords.push({ ...base, proa_codigo: codigo })
    } else {
      insertRecords.push(base)
    }
  })

  let upserted = 0
  let inserted = 0
  let errors   = 0

  // Upsert registros con codigo unico
  if (upsertRecords.length) {
    const { error, data } = await sb
      .from('reservas')
      .upsert(upsertRecords, { onConflict: 'proa_codigo', ignoreDuplicates: false })
      .select('id')
    if (error) errors++
    else upserted = data?.length ?? upsertRecords.length
  }

  // Insert registros sin codigo unico (TRS sin numero, etc.)
  if (insertRecords.length) {
    const { error, data } = await sb
      .from('reservas')
      .insert(insertRecords)
      .select('id')
    if (error) errors++
    else inserted = data?.length ?? insertRecords.length
  }

  return NextResponse.json({ ok: true, upserted, inserted, errors })
}
