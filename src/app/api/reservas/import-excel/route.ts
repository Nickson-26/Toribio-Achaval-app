import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Lee un archivo .xlsx de PROA y actualiza/inserta reservas en Supabase.
// Columnas usadas: A=Código, B=Tipo, D=Dirección, F=PrecioPub, H=Operación, M=PrecioReserva
//
// Regla de moneda:
//   - Venta        → monto_usd
//   - Alquiler >= 100000 → monto_ars (residencial ARS)
//   - Alquiler <  100000 → monto_usd (comercial USD)

const UNIDAD_MAP: Record<string, string> = {
  TCD: 'PLAT. PALERMO',
  TJU: 'PLAT. RECOLETA',
  TNP: 'PLAT. BELGRANO',
  TRO: 'PLAT. CABALLITO',
  TBA: 'PLAT. BARILOCHE',
  TPI: 'PLAT. PILAR',
  TPA: 'PLAT. ANGOSTURA',
  TCN: 'PLAT. CANNING',
  TMO: 'PLAT. BELGRANO',
  TAR: 'PLAT. PALERMO',
  TRS: 'DPTO DE BÚSQUEDA',
  TAE: 'EMPRENDIMIENTOS',
  TES: 'EMPRENDIMIENTOS',
  TUN: 'EMPRENDIMIENTOS',
  TUC: 'EMPRENDIMIENTOS',
  TII: 'INDUSTRIA',
  TOE: 'OFICINAS Y EDIFICIOS',
  TLT: 'LOCALES Y TERRENOS',
  TAP: 'TAP',
}

function getUnidad(codigo: string): string {
  const prefix = codigo?.slice(0, 3).toUpperCase()
  return UNIDAD_MAP[prefix] || 'EMPRENDIMIENTOS'
}

function parsePrecio(precio: number, operacion: string) {
  if (!precio) return { monto_ars: null, monto_usd: null }
  const op = operacion?.toUpperCase() || ''
  if (op.includes('ALQUILER') && precio >= 100000) {
    return { monto_ars: precio, monto_usd: null }
  }
  return { monto_ars: null, monto_usd: precio }
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

  // Parsear xlsx con ExcelJS (disponible en entorno Node)
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.default.Workbook()
  await wb.xlsx.load(buffer)
  const ws = wb.worksheets[0]

  let updated = 0, inserted = 0, skipped = 0, errors = 0

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // skip header

    const codigo    = String(row.getCell(1).value || '').trim()  // A
    const direccion = String(row.getCell(4).value || '').trim()  // D
    const operacion = String(row.getCell(8).value || '').trim()  // H
    const precioRaw = row.getCell(13).value                      // M

    if (!codigo || !precioRaw) { skipped++; return }

    const precio = typeof precioRaw === 'number' ? precioRaw : parseFloat(String(precioRaw))
    if (isNaN(precio)) { skipped++; return }

    const op = operacion.toUpperCase().includes('ALQUILER') ? 'ALQUILER' : 'VENTA'
    const { monto_ars, monto_usd } = parsePrecio(precio, op)
    const unidad = getUnidad(codigo)

    // Intentar actualizar primero; si no existe, insertar
    sb.from('reservas')
      .update({ monto_ars, monto_usd })
      .eq('proa_codigo', codigo)
      .then(({ error: e }) => {
        if (e) errors++
        else updated++
      })
  })

  // Dar tiempo a que terminen las promesas
  await new Promise(r => setTimeout(r, 3000))

  return NextResponse.json({ ok: true, updated, inserted, skipped, errors })
}
