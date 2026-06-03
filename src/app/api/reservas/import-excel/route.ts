import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Columnas del Excel PROA que se usan:
//   A = Código Propiedad  → proa_codigo
//   B = Tipo              → tipo_inmueble
//   D = Dirección         → direccion
//   F = Precio Publicado  → precio_publicado
//   H = Operación         → operacion (VENTA / ALQUILER)
//   K = Estado Reserva    → estado_reserva
//   M = Precio Reserva    → precio_reserva
//   P = Medio de Pago     → modo_pago

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

  const rows: { codigo: string; patch: any }[] = []

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return

    const codigo        = String(row.getCell(1).value ?? '').trim()
    const tipoInmueble  = String(row.getCell(2).value ?? '').trim()
    const direccion     = String(row.getCell(4).value ?? '').trim()
    const precioPubRaw  = row.getCell(6).value
    const operacionRaw  = String(row.getCell(8).value ?? '').trim()
    const estadoRes     = String(row.getCell(11).value ?? '').trim()
    const precioResRaw  = row.getCell(13).value
    const medioPago     = String(row.getCell(16).value ?? '').trim()

    if (!codigo) return

    const op = operacionRaw.toLowerCase().includes('alquiler') ? 'ALQUILER' : 'VENTA'
    const precioPublicado = precioPubRaw ? parseFloat(String(precioPubRaw)) : null
    const precioReserva   = precioResRaw ? parseFloat(String(precioResRaw)) : null

    rows.push({
      codigo,
      patch: {
        tipo_inmueble:    tipoInmueble || null,
        direccion:        direccion    || null,
        precio_publicado: precioPublicado && !isNaN(precioPublicado) ? precioPublicado : null,
        operacion:        op,
        estado_reserva:   estadoRes   || null,
        precio_reserva:   precioReserva && !isNaN(precioReserva) ? precioReserva : null,
        modo_pago:        medioPago   || null,
      },
    })
  })

  let updated = 0, errors = 0
  for (const { codigo, patch } of rows) {
    const { error } = await sb.from('reservas').update(patch).eq('proa_codigo', codigo)
    if (error) errors++
    else updated++
  }

  return NextResponse.json({ ok: true, updated, skipped: 0, errors })
}
