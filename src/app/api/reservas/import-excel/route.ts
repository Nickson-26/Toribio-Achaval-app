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

    const tipoInmueble = String(row.getCell(2).value ?? '').trim()
    const precioPubRaw = row.getCell(6).value
    const operacionRaw = String(row.getCell(8).value ?? '').trim()
    const estadoRes    = String(row.getCell(11).value ?? '').trim()
    const fechaRaw     = row.getCell(12).value
    const precioResRaw = row.getCell(13).value

    const proaCodigo = hasNumber(codigoStr)
      ? codigoStr
      : codigoStr + '|' + direccionStr

    const op = operacionRaw.toLowerCase().includes('alquiler') ? 'ALQUILER' : 'VENTA'

    const precioPubStr    = precioPubRaw ? String(precioPubRaw).replace(/,/g, '') : ''
    const precioPublicado = precioPubStr ? parseFloat(precioPubStr) : null

    const precioResStr  = precioResRaw ? String(precioResRaw).replace(/,/g, '') : ''
    const precioReserva = precioResStr ? parseFloat(precioResStr) : null

    const fecha    = parseExcelDate(fechaRaw)
    const validPub = precioPublicado !== null && !isNaN(precioPublicado) ? precioPublicado : null
    const validRes = precioReserva !== null && !isNaN(precioReserva) ? precioReserva : null

    records.push({
      proa_codigo:      proaCodigo,
      tipo_inmueble:    tipoInmueble || null,
      direccion:        direccionStr,
      precio_publicado: validPub,
      operacion:        op,
      estado_reserva:   estadoRes || null,
      precio_reserva:   validRes,
      fecha:            fecha,
      unidad:           getUnidad(codigoStr),
      firmo:            'PENDIENTE',
      broker:           null,
      cliente:          null,
      monto_ars:        null,
      monto_usd:        validRes,
    })
  })

  if (!records.length) {
    return NextResponse.json({ ok: true, upserted: 0, errors: 0 })
  }

  const { error, data } = await sb
    .from('reservas')
    .upsert(records, { onConflict: 'proa_codigo', ignoreDuplicates: false })
    .select('id')

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, upserted: data?.length ?? records.length, errors: 0 })
}
