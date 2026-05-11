import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// POST /api/reservas/import
//
// Inserta una reserva originada por un mail de info@toribioachaval.com.
// Idempotente por email_message_id (UNIQUE en DB).
//
// Auth: header `Authorization: Bearer ${RESERVAS_IMPORT_SECRET}`
//
// Body JSON:
// {
//   "email_message_id": "19df9c14c31b08a8",   // requerido
//   "fecha":            "2026-05-05",          // requerido (YYYY-MM-DD)
//   "direccion":        "García Lorca 280 10º 04", // requerido
//   "broker":           "Silvia Kiefer",       // opcional
//   "cliente":          "Juan Pérez",          // opcional
//   "operacion":        "VENTA"|"ALQUILER",    // requerido
//   "unidad":           "PLAT. CABALLITO",     // requerido
//   "monto_ars":        1200000,               // opcional
//   "monto_usd":        null,                  // opcional
//   "modo_pago":        "EFECTIVO",            // opcional
//   "firmo":            "PENDIENTE"            // opcional, default PENDIENTE
// }
// ─────────────────────────────────────────────────────────────

const VALID_OPERACION = new Set(['VENTA', 'ALQUILER'])
const VALID_FIRMO = new Set(['PENDIENTE', 'FIRMADO'])

export async function POST(req: NextRequest) {
  // 1. Auth
  const auth = req.headers.get('authorization') || ''
  const expected = process.env.RESERVAS_IMPORT_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: 'server_misconfigured', detail: 'RESERVAS_IMPORT_SECRET not set' },
      { status: 500 }
    )
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 2. Parse body
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  // 3. Validate
  const required = ['email_message_id', 'fecha', 'direccion', 'operacion', 'unidad']
  for (const k of required) {
    if (!body?.[k] || typeof body[k] !== 'string') {
      return NextResponse.json({ error: `missing_or_invalid:${k}` }, { status: 400 })
    }
  }
  if (!VALID_OPERACION.has(body.operacion)) {
    return NextResponse.json(
      { error: 'invalid_operacion', detail: `expected VENTA|ALQUILER, got ${body.operacion}` },
      { status: 400 }
    )
  }
  if (body.firmo && !VALID_FIRMO.has(body.firmo)) {
    return NextResponse.json(
      { error: 'invalid_firmo', detail: `expected PENDIENTE|FIRMADO, got ${body.firmo}` },
      { status: 400 }
    )
  }

  // 4. Supabase client (service role - bypassea RLS)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: 'server_misconfigured', detail: 'Supabase env vars missing' },
      { status: 500 }
    )
  }
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 5. Idempotencia: si el mail ya fue procesado, no duplicar
  const { data: existing, error: lookupErr } = await supabase
    .from('reservas')
    .select('id')
    .eq('email_message_id', body.email_message_id)
    .maybeSingle()

  if (lookupErr) {
    return NextResponse.json(
      { error: 'lookup_failed', detail: lookupErr.message },
      { status: 500 }
    )
  }
  if (existing) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'already_exists',
      id: existing.id,
    })
  }

  // 6. Insert
  const payload = {
    email_message_id: body.email_message_id,
    fecha: body.fecha,
    direccion: body.direccion,
    broker: body.broker?.trim() || null,
    cliente: body.cliente?.trim() || null,
    operacion: body.operacion,
    unidad: body.unidad,
    monto_ars:
      typeof body.monto_ars === 'number'
        ? body.monto_ars
        : body.monto_ars
        ? Number(body.monto_ars)
        : null,
    monto_usd:
      typeof body.monto_usd === 'number'
        ? body.monto_usd
        : body.monto_usd
        ? Number(body.monto_usd)
        : null,
    modo_pago: body.modo_pago || null,
    firmo: body.firmo || 'PENDIENTE',
  }

  const { data, error } = await supabase
    .from('reservas')
    .insert(payload)
    .select()
    .single()

  if (error) {
    // Race con UNIQUE: si llegó a colisionar, devolvemos skipped
    if (error.code === '23505') {
      return NextResponse.json({
        status: 'skipped',
        reason: 'unique_violation',
      })
    }
    return NextResponse.json(
      { error: 'insert_failed', detail: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ status: 'inserted', id: data.id })
}

// Health check para confirmar que el endpoint está vivo
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'reservas/import' })
}
