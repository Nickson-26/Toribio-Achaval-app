import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Mapeo prefijo PROA → unidad en DB ────────────────────────
const CODE_TO_UNIDAD: Record<string, string> = {
  TAR: 'PLAT. PALERMO',    TCD: 'PLAT. PALERMO',
  TMO: 'PLAT. CABALLITO',  TRO: 'PLAT. CABALLITO',
  TJU: 'PLAT. RECOLETA',   TCR: 'PLAT. RECOLETA',
  TBB: 'PLAT. BELGRANO',   TNP: 'PLAT. BELGRANO',
  TBA: 'PLAT. BARILOCHE',
  TPA: 'PLAT. ANGOSTURA',
  TPI: 'PLAT. PILAR',
  TRS: 'DPTO DE BÚSQUEDA',
  TCN: 'PLAT. CANNING',
  TAE: 'EMPRENDIMIENTOS',  TES: 'EMPRENDIMIENTOS',
  TUC: 'EMPRENDIMIENTOS',  TMC: 'EMPRENDIMIENTOS',
  TOE: 'OFICINAS Y EDIFICIOS',
  TLT: 'LOCALES Y TERRENOS',
  TCO: 'CONSULTORIA',
  TII: 'INDUSTRIA',
  TAP: 'TAP',
}

function parsePrecio(raw: string) {
  if (!raw) return { monto_ars: null, monto_usd: null }
  const clean = raw.replace(/\./g, '').replace(/,/g, '.').replace(/[^\d.]/g, '')
  const num = parseFloat(clean)
  if (isNaN(num) || num === 0) return { monto_ars: null, monto_usd: null }
  if (raw.toLowerCase().includes('u$s') || raw.toLowerCase().includes('usd')) {
    return { monto_ars: null, monto_usd: num }
  }
  return { monto_ars: num, monto_usd: null }
}

function parseDate(raw: string): string | null {
  const m = raw?.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim()
}

async function fetchProaReservadas(sessionCookie: string) {
  // PROA usa DataTables con AJAX — intentamos el endpoint de datos
  const baseUrl = 'https://proa.toribioachaval.net/propiedades/reservas'
  const headers: Record<string, string> = {
    'Cookie': sessionCookie,
    'Accept': 'application/json, text/javascript, */*',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': baseUrl,
  }

  // DataTables suele postear a la misma URL con parámetros
  const params = new URLSearchParams({
    'f_estado_reserva_id[]': '1',  // 1 = Reservada
    'f_anio_reserva': '',
    'f_sucursal_id': 'MISSUC',
    'draw': '1',
    'start': '0',
    'length': '500',
    'order[0][column]': '7',
    'order[0][dir]': 'desc',
  })

  const resp = await fetch(baseUrl, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!resp.ok) throw new Error(`PROA HTTP ${resp.status}`)
  const text = await resp.text()

  // Si PROA devuelve JSON de DataTables
  let rawRows: string[][] = []
  try {
    const json = JSON.parse(text)
    if (Array.isArray(json?.data)) {
      rawRows = json.data
    }
  } catch {
    // No es JSON — PROA puede requerir que visitemos la página primero
    // Devolvemos vacío para no romper el cron, se loggea
    console.warn('[sync-proa] PROA no devolvió JSON. Primeros 300 chars:', text.slice(0, 300))
    return []
  }

  return rawRows.map((row) => {
    const codigoRaw = stripHtml(row[1] || '').split('\n')[0].trim()
    const prefijo = codigoRaw.split(' ')[0]?.toUpperCase().slice(0, 3)
    const unidad = CODE_TO_UNIDAD[prefijo] || 'SIN CLASIFICAR'

    const dirRaw = stripHtml(row[3] || '').split('\n')[0].trim()
    const opText = stripHtml(row[5] || '')
    const opMatch = opText.match(/Venta|Alquiler/i)
    const operacion = opMatch ? opMatch[0].toUpperCase() : 'VENTA'

    const precioRaw = stripHtml(row[8] || '').split('\n')
    const { monto_ars, monto_usd } = parsePrecio(precioRaw[0] || '')
    const modo_pago = precioRaw[1]?.trim().toUpperCase() || null

    const fechaRaw = stripHtml(row[7] || '').trim()
    const fechaFirmaRaw = stripHtml(row[9] || '').trim()

    return {
      proa_codigo: codigoRaw,
      direccion: dirRaw,
      operacion,
      unidad,
      monto_ars,
      monto_usd,
      modo_pago,
      fecha: parseDate(fechaRaw) || new Date().toISOString().slice(0, 10),
      fecha_firma: parseDate(fechaFirmaRaw) || null,
    }
  }).filter(r => r.direccion && r.proa_codigo && r.unidad !== 'SIN CLASIFICAR')
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const secret = process.env.RESERVAS_IMPORT_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const sessionCookie = process.env.PROA_SESSION_COOKIE
  if (!sessionCookie) {
    return NextResponse.json({ error: 'PROA_SESSION_COOKIE not set' }, { status: 500 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  let reservas
  try {
    reservas = await fetchProaReservadas(sessionCookie)
  } catch (e: any) {
    return NextResponse.json({ error: 'proa_fetch_failed', detail: e.message }, { status: 500 })
  }

  if (reservas.length === 0) {
    return NextResponse.json({ status: 'ok', inserted: 0, updated: 0, total: 0, note: 'no_data' })
  }

  let inserted = 0, updated = 0, errors = 0

  for (const r of reservas) {
    try {
      const { data: existing } = await sb
        .from('reservas').select('id, monto_ars, monto_usd, direccion')
        .eq('proa_codigo', r.proa_codigo).maybeSingle()

      if (existing) {
        if (existing.monto_ars !== r.monto_ars || existing.monto_usd !== r.monto_usd || existing.direccion !== r.direccion) {
          await sb.from('reservas').update({
            monto_ars: r.monto_ars, monto_usd: r.monto_usd,
            modo_pago: r.modo_pago, direccion: r.direccion, unidad: r.unidad,
          }).eq('id', existing.id)
          updated++
        }
      } else {
        await sb.from('reservas').insert({
          proa_codigo: r.proa_codigo,
          fecha: r.fecha,
          direccion: r.direccion,
          operacion: r.operacion,
          unidad: r.unidad,
          monto_ars: r.monto_ars,
          monto_usd: r.monto_usd,
          modo_pago: r.modo_pago,
          firmo: r.fecha_firma ? 'FIRMADO' : 'PENDIENTE',
          broker: null,
          cliente: null,
        })
        inserted++
      }
    } catch (e: any) {
      console.error(`[sync-proa] Error ${r.proa_codigo}:`, e.message)
      errors++
    }
  }

  return NextResponse.json({
    status: 'ok', total: reservas.length,
    inserted, updated, errors,
    timestamp: new Date().toISOString(),
  })
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'reservas/sync-proa' })
}
