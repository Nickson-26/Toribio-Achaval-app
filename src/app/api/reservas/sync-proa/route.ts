import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PROA_BASE = 'https://proa.toribioachaval.net'

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

function stripHtml(s: string) {
  return (s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim()
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

async function proaLogin(): Promise<string> {
  // 1. GET login page para obtener CSRF token y cookie de sesión inicial
  const loginPage = await fetch(`${PROA_BASE}/login`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    redirect: 'follow',
  })
  const html = await loginPage.text()

  // Node 18+ soporta getSetCookie() para múltiples cookies
  const initialCookies: string[] = (loginPage.headers as any).getSetCookie?.() ||
    (loginPage.headers.get('set-cookie') || '').split(/,(?=[^ ])/)

  const cookieMap = new Map<string, string>()
  initialCookies.forEach((c: string) => {
    const part = c.split(';')[0].trim()
    const [name, ...rest] = part.split('=')
    if (name && rest.length) cookieMap.set(name.trim(), `${name.trim()}=${rest.join('=')}`)
  })

  // Extraer CSRF token del HTML
  const csrfMatch = html.match(/name="_token"\s+value="([^"]+)"/) ||
                    html.match(/<meta name="csrf-token" content="([^"]+)"/)
  const csrf = csrfMatch ? csrfMatch[1] : ''
  if (!csrf) throw new Error('No CSRF token found on login page')

  const cookieString = Array.from(cookieMap.values()).join('; ')

  // 2. POST login
  const loginResp = await fetch(`${PROA_BASE}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieString,
      'User-Agent': 'Mozilla/5.0',
      'Referer': `${PROA_BASE}/login`,
      'Accept': 'text/html,application/xhtml+xml,*/*',
    },
    body: new URLSearchParams({
      _token: csrf,
      email: process.env.PROA_USERNAME!,
      password: process.env.PROA_PASSWORD!,
    }).toString(),
    redirect: 'manual',
  })

  // Capturar cookies post-login (incluye la sesión autenticada)
  const postCookies: string[] = (loginResp.headers as any).getSetCookie?.() ||
    (loginResp.headers.get('set-cookie') || '').split(/,(?=[^ ])/)

  postCookies.forEach((c: string) => {
    const part = c.split(';')[0].trim()
    const [name, ...rest] = part.split('=')
    if (name && rest.length) cookieMap.set(name.trim(), `${name.trim()}=${rest.join('=')}`)
  })

  const finalCookies = Array.from(cookieMap.values()).join('; ')

  // Verificar que tenemos sesión
  if (!finalCookies.includes('proa_session') && !finalCookies.includes('laravel_session')) {
    const status = loginResp.status
    const location = loginResp.headers.get('location') || ''
    throw new Error(`Login fallido — status: ${status}, redirect: ${location}, cookies: ${finalCookies.substring(0, 100)}`)
  }

  return finalCookies
}

async function fetchReservadas(cookies: string) {
  // Endpoint real: GET /propiedades/reservas/buscar con params de DataTables
  const params = new URLSearchParams({
    'draw': '1',
    'start': '0',
    'length': '500',
    'order[0][column]': '7',
    'order[0][dir]': 'desc',
    'tipo_propiedad_id': '0',
    'tipo_operacion_id': '0',
    'moneda': '',
    'sucursal_id': 'MISSUC',
    'codigo': '',
    'estado_reserva_id[]': '1',
    'direccion': '',
    'reserva_desde': '',
    'reserva_hasta': '',
    'ubicacion': '',
    'broker_id': '0',
    'canal_arribo_id': '0',
    'solo_indirectas': 'false',
    'productor_id': '0',
    'coordinador_id': '0',
    'anio_reserva': '',
    'contenedora_id': '',
    'salida': 'tabla',
  })

  const resp = await fetch(`${PROA_BASE}/propiedades/reservas/buscar?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Cookie': cookies,
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `${PROA_BASE}/propiedades/reservas`,
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json, text/javascript, */*',
    },
  })

  if (!resp.ok) throw new Error(`PROA fetch failed: ${resp.status}`)
  const text = await resp.text()

  let rawRows: string[][] = []
  try {
    const json = JSON.parse(text)
    if (Array.isArray(json?.data)) rawRows = json.data
    else throw new Error('No data array in response')
  } catch {
    console.warn('[sync-proa] No JSON, primeros 300 chars:', text.slice(0, 300))
    return []
  }

  return rawRows.map(row => {
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
  if (auth !== `Bearer ${process.env.RESERVAS_IMPORT_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  let cookies: string
  try {
    cookies = await proaLogin()
  } catch (e: any) {
    return NextResponse.json({ error: 'proa_login_failed', detail: e.message }, { status: 500 })
  }

  let reservas
  try {
    reservas = await fetchReservadas(cookies)
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
