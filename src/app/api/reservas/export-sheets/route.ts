import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getAccessToken() {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  })
  const json = await resp.json()
  if (!json.access_token) throw new Error('No se pudo obtener access token: ' + JSON.stringify(json))
  return json.access_token as string
}

function formatPrecio(ars: number | null, usd: number | null) {
  if (usd) return `u$s ${usd.toLocaleString('es-AR')}`
  if (ars) return `$ ${ars.toLocaleString('es-AR')}`
  return ''
}

export async function POST(req: NextRequest) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  // 1. Traer reservas de Supabase
  const { data: reservas, error } = await sb
    .from('reservas')
    .select('*')
    .order('unidad', { ascending: true })
    .order('fecha', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 2. Obtener access token
  let token: string
  try {
    token = await getAccessToken()
  } catch (e: any) {
    return NextResponse.json({ error: 'google_auth_failed', detail: e.message }, { status: 500 })
  }

  const gHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  const now = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })

  // 3. Crear Google Sheet
  const createResp = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: gHeaders,
    body: JSON.stringify({
      properties: { title: `Reservas Toribio Achával — ${now}` },
      sheets: [
        { properties: { title: 'Reservas', sheetId: 0 } },
        { properties: { title: 'Emprendimientos', sheetId: 1 } },
        { properties: { title: 'Residencial', sheetId: 2 } },
        { properties: { title: 'Comercial', sheetId: 3 } },
      ],
    }),
  })
  const sheet = await createResp.json()
  if (!sheet.spreadsheetId) return NextResponse.json({ error: 'sheet_create_failed', detail: sheet }, { status: 500 })

  const spreadsheetId = sheet.spreadsheetId
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`

  // 4. Preparar datos
  const HEADER = ['Código', 'Dirección', 'Unidad', 'Broker', 'Operación', 'Precio Reserva', 'Modo Pago', 'Fecha Reserva', 'Firmó']

  function toRows(list: any[]) {
    return list.map(r => [
      r.proa_codigo || '',
      r.direccion || '',
      r.unidad || '',
      r.broker || '',
      r.operacion || '',
      formatPrecio(r.monto_ars, r.monto_usd),
      r.modo_pago || '',
      r.fecha || '',
      r.firmo || '',
    ])
  }

  const EMP_UNIDADES = ['EMPRENDIMIENTOS']
  const RES_UNIDADES = ['PLAT. PALERMO','PLAT. BELGRANO','PLAT. CABALLITO','PLAT. RECOLETA','PLAT. BARILOCHE','PLAT. ANGOSTURA','PLAT. PILAR','PLAT. CANNING','DPTO DE BÚSQUEDA']
  const COM_UNIDADES = ['OFICINAS Y EDIFICIOS','LOCALES Y TERRENOS','CONSULTORIA','INDUSTRIA','TAP']

  const empRows = toRows(reservas!.filter(r => EMP_UNIDADES.includes(r.unidad)))
  const resRows = toRows(reservas!.filter(r => RES_UNIDADES.includes(r.unidad)))
  const comRows = toRows(reservas!.filter(r => COM_UNIDADES.includes(r.unidad)))
  const allRows = toRows(reservas!)

  // 5. Escribir datos en el sheet
  const valueData = [
    { range: 'Reservas!A1', values: [HEADER, ...allRows] },
    { range: 'Emprendimientos!A1', values: [HEADER, ...empRows] },
    { range: 'Residencial!A1', values: [HEADER, ...resRows] },
    { range: 'Comercial!A1', values: [HEADER, ...comRows] },
  ]

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: gHeaders,
    body: JSON.stringify({ valueInputOption: 'RAW', data: valueData }),
  })

  // 6. Formatear headers (bold + color de fondo)
  const formatRequests = [0, 1, 2, 3].map(sheetId => ({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.1, green: 0.1, blue: 0.1 },
          textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  }))

  // Auto-resize columnas
  const resizeRequests = [0, 1, 2, 3].map(sheetId => ({
    autoResizeDimensions: {
      dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 9 },
    },
  }))

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: gHeaders,
    body: JSON.stringify({ requests: [...formatRequests, ...resizeRequests] }),
  })

  return NextResponse.json({
    ok: true,
    url: spreadsheetUrl,
    total: reservas!.length,
  })
}
