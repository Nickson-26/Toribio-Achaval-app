import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Columnas del Excel PROA sincronizadas:
//   A (1)  = Codigo Propiedad  -> proa_codigo
//   B (2)  = Tipo              -> tipo_inmueble
//   D (4)  = Direccion         -> direccion
//   F (6)  = Precio Publicado  -> precio_publicado
//   H (8)  = Operacion         -> operacion
//   K (11) = Estado Reserva    -> estado_reserva
//   L (12) = Fecha Reserva     -> fecha
//   M (13) = Precio Reserva    -> precio_reserva
//   P (16) = Medio de Pago     -> modo_pago
//
// UPSERT por proa_codigo: actualiza si existe, inserta si es nuevo.

function parseExcelDate(raw: any): string {
  if (!raw) return new Date().toISOString().slice(0, 10)
  if (raw instanceof Date) return raw.toISOString().slice(0, 10)
  const str = String(raw).trim()
  const parts = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (parts) {
    const y = parts[3]
    const m = parts[2].padStart(2, '0')
    const d = parts[1].padStart(2, '0')
    return y + '-' + m + '-' + d
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

    const codigo       = String(row.getCell(1).value ?? '').trim()
    const tipoInmueble = String(row.getCell(2).value ?? '').trim()
    const direccion    = String(row.getCell(4).value ?? '').trim()
    const precioPubRaw = row.getCell(6).value
    const operacionRaw = String(row.getCell(8).value ?? '').trim()
    const estadoRes    = String(row.getCell(11).value ?? '').trim()
    const fechaRaw     = row.getCell(12).value
    const precioResRaw = row.getCell(13).value
    const medioPago    = String(row.getCell(16).value ?? '').trim()

    if (!codigo || !direccion) return

    const op = operacionRaw.toLowerCase().includes('alquiler') ? 'ALQUILER' : 'VENTA'

    const precioPubStr = precioPubRaw ? String(precioPubRaw).replace(/,/g, '') : ''
    const precioPublicado = precioPubStr ? parseFloat(precioPubStr) : null

    const precioResStr = precioResRaw ? String(precioResRaw).replace(/,/g, '') : ''
    const precioReserva = precioResStr ? parseFloat(precioResStr) : null

    const fecha = parseExcelDate(fechaRaw)

    const validPub = precioPublicado !== null && !isNaN(precioPublicado) ? precioPublicado : null
    const validRes = precioReserva !== null && !isNaN(precioReserva) ? precioReserva : null

    records.push({
      proa_codigo:      codigo,
      tipo_inmueble:    tipoInmueble || null,
      direccion:        direccion,
      precio_publicado: validPub,
      operacion:        op,
      estado_reserva:   estadoRes || null,
      precio_reserva:   validRes,
      modo_pago:        medioPago || null,
      fecha:            fecha,
      firmo:            'PENDIENTE',
      broker:           null,
      cliente:          null,
      unidad:           null,
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
