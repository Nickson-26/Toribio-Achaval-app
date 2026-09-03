import { NextRequest, NextResponse } from 'next/server'
import { UNIDAD_POR_PREFIJO } from '@/lib/reservas'
import { createClient } from '@supabase/supabase-js'
import { requireUser, isDenied, actorLabel } from '@/lib/apiAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Tamaño máximo del .xlsx aceptado (10 MB).
const MAX_FILE_BYTES = 10 * 1024 * 1024

// Esta operación REEMPLAZA la tabla `reservas` completa. Para que no pueda
// dispararse por accidente ni por una request suelta, exige que el llamador
// mande explícitamente este valor en el form-data.
const CONFIRM_TOKEN = 'REEMPLAZAR'

/**
 * Mismo mapa que usa el sync de PROA. Esta ruta tenía el suyo propio y
 * aplanaba todas las plataformas a 'RESIDENCIAL' —incluida `TCN`, que es
 * PLAT. CANNING y pertenece a Emprendimientos—. Las cuatro reservas TCN que
 * hoy están guardadas como 'RESIDENCIAL' entraron por acá.
 */
const UNIDAD_BY_PREFIX = UNIDAD_POR_PREFIJO

function getUnidad(codigo: string): string {
  const prefix = codigo.slice(0, 3).toUpperCase()
  return UNIDAD_BY_PREFIX[prefix] ?? 'RESIDENCIAL'
}

// Codes without a numeric suffix (bare "TRS", "TJU", etc.) must be unique.
// We append the first 30 chars of the address so the UNIQUE constraint passes.
// The UI can strip everything from "|" onward for display.
function buildProaCodigo(codigoStr: string, direccionStr: string): string {
  if (/\d/.test(codigoStr)) return codigoStr
  return codigoStr + '|' + direccionStr.slice(0, 30).trim()
}

function detectCurrency(raw: any): 'usd' | 'ars' | null {
  if (!raw) return null
  const s = String(raw).toLowerCase().trim()
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
  // ── AUTORIZACIÓN ─────────────────────────────────────────────
  // Operación destructiva (reemplaza la tabla `reservas` entera).
  // Solo admin, o el job interno con RESERVAS_IMPORT_SECRET.
  const actor = await requireUser(req, {
    roles: ['admin'],
    allowSecrets: ['RESERVAS_IMPORT_SECRET'],
  })
  if (isDenied(actor)) return actor

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: 'file_too_large', detail: `El archivo supera los ${MAX_FILE_BYTES / 1024 / 1024} MB` },
      { status: 413 }
    )
  }

  // Confirmación explícita: sin esto no se borra nada.
  const confirm = String(formData.get('confirm') ?? '')
  if (confirm !== CONFIRM_TOKEN) {
    return NextResponse.json(
      {
        error: 'confirmation_required',
        detail: 'Esta operación reemplaza TODAS las reservas. Falta el campo de confirmación.',
      },
      { status: 400 }
    )
  }

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
    const montoEntregaRaw = row.getCell(17).value
    const brokerRaw       = row.getCell(20).value

    const op = operacionRaw.toLowerCase().includes('alquiler') ? 'ALQUILER' : 'VENTA'

    const precioPubStr    = precioPubRaw ? String(precioPubRaw).replace(/,/g, '') : ''
    const precioPublicado = precioPubStr ? parseFloat(precioPubStr) : null
    const precioResStr    = precioResRaw ? String(precioResRaw).replace(/,/g, '') : ''
    const precioReserva   = precioResStr ? parseFloat(precioResStr) : null

    const fecha    = parseExcelDate(fechaRaw)
    const validPub = precioPublicado !== null && !isNaN(precioPublicado) ? precioPublicado : null
    const validRes = precioReserva   !== null && !isNaN(precioReserva)   ? precioReserva   : null
    const broker   = brokerRaw ? String(brokerRaw).trim() || null : null

    const currency = detectCurrency(montoEntregaRaw) ?? (op === 'VENTA' ? 'usd' : 'ars')

    records.push({
      proa_codigo:      buildProaCodigo(codigoStr, direccionStr),
      tipo_inmueble:    tipoInmueble || null,
      direccion:        direccionStr,
      precio_publicado: validPub,
      operacion:        op,
      estado_reserva:   estadoRes || null,
      precio_reserva:   validRes,
      fecha:            fecha,
      unidad:           getUnidad(codigoStr),
      firmo:            'PENDIENTE',
      broker:           broker,
      cliente:          null,
      monto_ars:        currency === 'ars' ? validRes : null,
      monto_usd:        currency === 'usd' ? validRes : null,
    })
  })

  if (!records.length) {
    return NextResponse.json({ ok: true, inserted: 0, errors: 0 })
  }

  // ── RESGUARDO ANTES DE BORRAR ────────────────────────────────
  // El flujo es "reemplazar la base". Si el insert fallara después del delete
  // se perderían todas las reservas, así que primero las traemos a memoria
  // para poder restaurarlas.
  const { data: backup, error: backupError } = await sb.from('reservas').select('*')
  if (backupError) {
    return NextResponse.json(
      { ok: false, error: 'No se pudo resguardar la tabla antes de reemplazarla: ' + backupError.message },
      { status: 500 }
    )
  }

  const { error: delError } = await sb
    .from('reservas')
    .delete()
    .neq('id', 0)

  if (delError) {
    return NextResponse.json(
      { ok: false, error: 'Error al limpiar tabla: ' + delError.message },
      { status: 500 }
    )
  }

  const { error, data } = await sb
    .from('reservas')
    .insert(records)
    .select('id')

  if (error) {
    // Restaurar el estado previo. Sin esto, un insert fallido deja la tabla vacía.
    let restored = 0
    let restoreError: string | null = null
    if (backup && backup.length) {
      const { error: restErr, data: restData } = await sb
        .from('reservas')
        .insert(backup)
        .select('id')
      if (restErr) restoreError = restErr.message
      else restored = restData?.length ?? 0
    }
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        restored,
        restoreError,
        detail: restoreError
          ? `LA IMPORTACIÓN FALLÓ Y LA RESTAURACIÓN TAMBIÉN. Se perdieron ${backup?.length ?? 0} reservas. Restaurar desde backup manualmente.`
          : `La importación falló. Se restauraron ${restored} reservas al estado previo.`,
      },
      { status: 500 }
    )
  }

  console.info(
    `[import-excel] ${actorLabel(actor)} reemplazó ${backup?.length ?? 0} reservas por ${data?.length ?? records.length}`
  )

  return NextResponse.json({
    ok: true,
    inserted: data?.length ?? records.length,
    replaced: backup?.length ?? 0,
    errors: 0,
  })
}
