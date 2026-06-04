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

// ── Colores ──────────────────────────────────────────────────
const C = {
  titleBg:    { red: 0.118, green: 0.227, blue: 0.369 }, // #1E3A5F
  headerBg:   { red: 0.161, green: 0.318, blue: 0.639 }, // #2952A3
  white:      { red: 1, green: 1, blue: 1 },
  ventaBg:    { red: 0.992, green: 0.914, blue: 0.914 }, // #FDE9E9
  ventaFg:    { red: 0.690, green: 0.000, blue: 0.125 }, // #B00020
  alqBg:      { red: 0.890, green: 0.945, blue: 0.992 }, // #E3F2FD
  alqFg:      { red: 0.082, green: 0.396, blue: 0.753 }, // #1565C0
  firmadoBg:  { red: 0.910, green: 0.961, blue: 0.914 }, // #E8F5E9
  firmadoFg:  { red: 0.106, green: 0.369, blue: 0.125 }, // #1B5E20
  pendBg:     { red: 1.000, green: 0.976, blue: 0.769 }, // #FFF9C4
  pendFg:     { red: 0.961, green: 0.498, blue: 0.090 }, // #F57F17
  priceBg:    { red: 0.996, green: 0.992, blue: 0.878 }, // #FEFDE0
  altRow:     { red: 0.973, green: 0.976, blue: 0.980 }, // #F8F9FA
  border:     { red: 0.820, green: 0.839, blue: 0.859 }, // #D1D6DB
  summaryBg:  { red: 0.937, green: 0.945, blue: 0.969 }, // #EFF1F7
  summaryFg:  { red: 0.118, green: 0.227, blue: 0.369 }, // #1E3A5F
}

function rgb(c: { red: number; green: number; blue: number }) {
  return c
}

// ── Helpers de formato ────────────────────────────────────────
function cell(
  bg?: typeof C.titleBg,
  fg?: typeof C.white,
  bold = false,
  fontSize = 10,
  hAlign: 'LEFT'|'CENTER'|'RIGHT' = 'LEFT',
  numberFormat?: { type: string; pattern: string }
) {
  return {
    userEnteredFormat: {
      ...(bg ? { backgroundColor: rgb(bg) } : {}),
      textFormat: {
        ...(fg ? { foregroundColor: rgb(fg) } : {}),
        bold,
        fontSize,
      },
      horizontalAlignment: hAlign,
      ...(numberFormat ? { numberFormat } : {}),
    },
  }
}

function borderLine() {
  return { style: 'SOLID', width: 1, color: rgb(C.border) }
}

function repeatCell(sheetId: number, r1: number, r2: number, c1: number, c2: number, cellObj: any) {
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: r1, endRowIndex: r2, startColumnIndex: c1, endColumnIndex: c2 },
      cell: cellObj,
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,numberFormat)',
    },
  }
}

function mergeReq(sheetId: number, r1: number, r2: number, c1: number, c2: number) {
  return { mergeCells: { range: { sheetId, startRowIndex: r1, endRowIndex: r2, startColumnIndex: c1, endColumnIndex: c2 }, mergeType: 'MERGE_ALL' } }
}

function setColWidth(sheetId: number, col: number, px: number) {
  return {
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: col, endIndex: col + 1 },
      properties: { pixelSize: px },
      fields: 'pixelSize',
    },
  }
}

function freezeReq(sheetId: number, rows: number) {
  return {
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: rows } },
      fields: 'gridProperties.frozenRowCount',
    },
  }
}

function updateBorders(sheetId: number, r1: number, r2: number, c1: number, c2: number) {
  return {
    updateBorders: {
      range: { sheetId, startRowIndex: r1, endRowIndex: r2, startColumnIndex: c1, endColumnIndex: c2 },
      top: borderLine(), bottom: borderLine(), left: borderLine(), right: borderLine(),
      innerHorizontal: borderLine(), innerVertical: borderLine(),
    },
  }
}

// ── Datos ─────────────────────────────────────────────────────
// Columnas: Código(0) Tipo(1) Dirección(2) PrecioPub(3) Operación(4) PrecioRes(5) Estado(6) MedioPago(7)
const NCOLS = 8
const HEADER_ROW = ['Código PROA', 'Tipo', 'Dirección', 'Precio Publicado', 'Operación', 'Precio Reserva', 'Estado Reserva', 'Medio de Pago']

function toRows(list: any[]) {
  return list.map(r => [
    r.proa_codigo       || '',
    r.tipo_inmueble     || '',
    r.direccion         || '',
    r.precio_publicado  || '',
    r.operacion         || '',
    r.precio_reserva    || r.monto_usd || r.monto_ars || '',
    r.estado_reserva    || r.firmo     || '',
    r.modo_pago         || '',
  ])
}

function fmtNumber(n: number) {
  return n.toLocaleString('es-AR')
}

// TITLE row, SUMMARY row, empty row, HEADER row → data starts at row index 4
const DATA_START = 4

function buildFormatRequests(sheetId: number, dataRows: any[][], totalARS: number, totalUSD: number): any[] {
  const totalDataRows = dataRows.length
  const lastDataRow = DATA_START + totalDataRows
  const reqs: any[] = []

  // ── Merge title row (A1:J1)
  reqs.push(mergeReq(sheetId, 0, 1, 0, NCOLS))
  // ── Merge summary row cols A-C, D-F, G-J
  reqs.push(mergeReq(sheetId, 1, 2, 0, 4))
  reqs.push(mergeReq(sheetId, 1, 2, 4, 7))
  reqs.push(mergeReq(sheetId, 1, 2, 7, NCOLS))

  // ── Title row style
  reqs.push(repeatCell(sheetId, 0, 1, 0, NCOLS, {
    userEnteredFormat: {
      backgroundColor: rgb(C.titleBg),
      textFormat: { foregroundColor: rgb(C.white), bold: true, fontSize: 13 },
      horizontalAlignment: 'LEFT',
    },
  }))

  // ── Summary row style
  reqs.push(repeatCell(sheetId, 1, 2, 0, NCOLS, {
    userEnteredFormat: {
      backgroundColor: rgb(C.summaryBg),
      textFormat: { foregroundColor: rgb(C.summaryFg), bold: true, fontSize: 10 },
      horizontalAlignment: 'LEFT',
    },
  }))

  // ── Row 3 (index 2): separator — light bg
  reqs.push(repeatCell(sheetId, 2, 3, 0, NCOLS, {
    userEnteredFormat: { backgroundColor: rgb(C.titleBg) },
  }))

  // ── Header row (index 3)
  reqs.push(repeatCell(sheetId, 3, 4, 0, NCOLS, {
    userEnteredFormat: {
      backgroundColor: rgb(C.headerBg),
      textFormat: { foregroundColor: rgb(C.white), bold: true, fontSize: 10 },
      horizontalAlignment: 'CENTER',
    },
  }))

  // ── Price columns header: PrecioPub(3), PrecioRes(5) — slightly brighter
  reqs.push(repeatCell(sheetId, 3, 4, 3, 4, {
    userEnteredFormat: {
      backgroundColor: { red: 0.200, green: 0.400, blue: 0.800 },
      textFormat: { foregroundColor: rgb(C.white), bold: true, fontSize: 10 },
      horizontalAlignment: 'RIGHT',
    },
  }))
  reqs.push(repeatCell(sheetId, 3, 4, 5, 6, {
    userEnteredFormat: {
      backgroundColor: { red: 0.200, green: 0.400, blue: 0.800 },
      textFormat: { foregroundColor: rgb(C.white), bold: true, fontSize: 10 },
      horizontalAlignment: 'RIGHT',
    },
  }))

  // ── Data rows: alternating bg, price col highlight
  for (let i = 0; i < totalDataRows; i++) {
    const rowIdx = DATA_START + i
    const isAlt = i % 2 === 1
    const rowBg = isAlt ? rgb(C.altRow) : rgb(C.white)

    // Base row style
    reqs.push(repeatCell(sheetId, rowIdx, rowIdx + 1, 0, NCOLS, {
      userEnteredFormat: {
        backgroundColor: rowBg,
        textFormat: { fontSize: 10 },
        horizontalAlignment: 'LEFT',
      },
    }))

    // Precio Publicado (col 3) y Precio Reserva (col 5)
    reqs.push(repeatCell(sheetId, rowIdx, rowIdx + 1, 3, 4, {
      userEnteredFormat: {
        backgroundColor: isAlt ? rgb(C.altRow) : rgb(C.white),
        textFormat: { fontSize: 10 },
        horizontalAlignment: 'RIGHT',
        numberFormat: { type: 'NUMBER', pattern: '#,##0' },
      },
    }))
    reqs.push(repeatCell(sheetId, rowIdx, rowIdx + 1, 5, 6, {
      userEnteredFormat: {
        backgroundColor: rgb(C.priceBg),
        textFormat: { bold: true, fontSize: 10 },
        horizontalAlignment: 'RIGHT',
        numberFormat: { type: 'NUMBER', pattern: '#,##0' },
      },
    }))

    // Operación cell (col 4)
    const op = dataRows[i][4]
    if (op === 'VENTA') {
      reqs.push(repeatCell(sheetId, rowIdx, rowIdx + 1, 4, 5, {
        userEnteredFormat: {
          backgroundColor: rgb(C.ventaBg),
          textFormat: { foregroundColor: rgb(C.ventaFg), bold: true, fontSize: 10 },
          horizontalAlignment: 'CENTER',
        },
      }))
    } else if (op === 'ALQUILER') {
      reqs.push(repeatCell(sheetId, rowIdx, rowIdx + 1, 4, 5, {
        userEnteredFormat: {
          backgroundColor: rgb(C.alqBg),
          textFormat: { foregroundColor: rgb(C.alqFg), bold: true, fontSize: 10 },
          horizontalAlignment: 'CENTER',
        },
      }))
    }

    // Estado cell (col 6)
    const estado = dataRows[i][6]
    if (estado === 'Reservada' || estado === 'FIRMADO') {
      reqs.push(repeatCell(sheetId, rowIdx, rowIdx + 1, 6, 7, {
        userEnteredFormat: {
          backgroundColor: rgb(C.firmadoBg),
          textFormat: { foregroundColor: rgb(C.firmadoFg), bold: true, fontSize: 10 },
          horizontalAlignment: 'CENTER',
        },
      }))
    } else if (estado === 'PENDIENTE') {
      reqs.push(repeatCell(sheetId, rowIdx, rowIdx + 1, 6, 7, {
        userEnteredFormat: {
          backgroundColor: rgb(C.pendBg),
          textFormat: { foregroundColor: rgb(C.pendFg), bold: true, fontSize: 10 },
          horizontalAlignment: 'CENTER',
        },
      }))
    }
  }

  // ── Borders around data + header
  if (totalDataRows > 0) {
    reqs.push(updateBorders(sheetId, 3, lastDataRow, 0, NCOLS))
  }

  // ── Column widths (px): Código, Tipo, Dirección, PrecioPub, Operación, PrecioRes, Estado, MedioPago
  const widths = [110, 120, 260, 130, 90, 130, 110, 110]
  widths.forEach((w, c) => reqs.push(setColWidth(sheetId, c, w)))

  // ── Freeze title + summary + separator + header (4 rows)
  reqs.push(freezeReq(sheetId, 4))

  // ── Row heights: title=36, summary=28, separator=6, header=28
  reqs.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 36 }, fields: 'pixelSize',
    },
  })
  reqs.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 2 },
      properties: { pixelSize: 28 }, fields: 'pixelSize',
    },
  })
  reqs.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 2, endIndex: 3 },
      properties: { pixelSize: 6 }, fields: 'pixelSize',
    },
  })
  reqs.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 3, endIndex: 4 },
      properties: { pixelSize: 28 }, fields: 'pixelSize',
    },
  })

  return reqs
}

// GET: llamado desde el cron semanal (requiere CRON_SECRET)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return POST(req)
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
    .not('proa_codigo', 'is', null)
    .not('tipo_inmueble', 'is', null)
    .not('precio_reserva', 'is', null)
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

  const SHEET_TITLE = 'Reservas Toribio Achával'
  const updatedAt = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })

  // 3. Obtener o crear el Google Sheet
  // Si SHEETS_RESERVAS_ID está configurado, actualiza ese archivo directamente.
  // Si no, crea uno nuevo y devuelve el ID para configurar en Vercel.
  let spreadsheetId: string
  const savedId = process.env.SHEETS_RESERVAS_ID

  if (savedId) {
    spreadsheetId = savedId
  } else {
    const createResp = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: gHeaders,
      body: JSON.stringify({
        properties: { title: SHEET_TITLE },
        sheets: [
          { properties: { title: 'Todas', sheetId: 0 } },
          { properties: { title: 'Emprendimientos', sheetId: 1 } },
          { properties: { title: 'Residencial', sheetId: 2 } },
          { properties: { title: 'Comercial', sheetId: 3 } },
        ],
      }),
    })
    const createJson = await createResp.json()
    if (!createJson.spreadsheetId) return NextResponse.json({ error: 'sheet_create_failed', detail: createJson }, { status: 500 })
    spreadsheetId = createJson.spreadsheetId
  }

  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`

  // 4. Verificar pestañas y limpiar
  const metaResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, { headers: gHeaders })
  const metaJson = await metaResp.json()
  const existingSheets: { title: string; sheetId: number }[] = (metaJson.sheets || []).map((s: any) => s.properties)

  const wantedSheets = [
    { title: 'Todas', sheetId: 0 },
    { title: 'Emprendimientos', sheetId: 1 },
    { title: 'Residencial', sheetId: 2 },
    { title: 'Comercial', sheetId: 3 },
  ]

  // Rename "Reservas" → "Todas" if needed
  const reservasSheet = existingSheets.find(s => s.title === 'Reservas')
  const renameRequests = reservasSheet ? [{
    updateSheetProperties: {
      properties: { sheetId: reservasSheet.sheetId, title: 'Todas' },
      fields: 'title',
    },
  }] : []

  const addRequests = wantedSheets
    .filter(w => !existingSheets.some(e => e.title === w.title) && !(w.title === 'Todas' && reservasSheet))
    .map(w => ({ addSheet: { properties: { title: w.title, sheetId: w.sheetId } } }))

  if (renameRequests.length || addRequests.length) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST', headers: gHeaders,
      body: JSON.stringify({ requests: [...renameRequests, ...addRequests] }),
    })
  }

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
    method: 'POST', headers: gHeaders,
    body: JSON.stringify({ ranges: ['Todas!A:Z','Emprendimientos!A:Z','Residencial!A:Z','Comercial!A:Z'] }),
  })

  // 5. Preparar datos por pestaña
  const EMP_UNIDADES = ['EMPRENDIMIENTOS']
  const RES_UNIDADES = ['PLAT. PALERMO','PLAT. BELGRANO','PLAT. CABALLITO','PLAT. RECOLETA','PLAT. BARILOCHE','PLAT. ANGOSTURA','PLAT. PILAR','PLAT. CANNING','DPTO DE BÚSQUEDA']
  const COM_UNIDADES = ['OFICINAS Y EDIFICIOS','LOCALES Y TERRENOS','CONSULTORIA','INDUSTRIA','TAP']

  function buildSheetData(list: any[], label: string) {
    const rows = toRows(list)
    const totalARS = list.reduce((s, r) => s + (r.monto_ars || 0), 0)
    const totalUSD = list.reduce((s, r) => s + (r.monto_usd || 0), 0)
    const ventas   = list.filter(r => r.operacion === 'VENTA').length
    const alqs     = list.filter(r => r.operacion === 'ALQUILER').length
    const firmadas = list.filter(r => r.firmo === 'FIRMADO').length

    const titleRow   = [`${label}   ·   Actualizado: ${updatedAt}`, ...Array(NCOLS - 1).fill('')]
    const summaryA   = [`${list.length} reservas  ·  ${ventas} ventas  ·  ${alqs} alquileres  ·  ${firmadas} firmadas`, '', '', '']
    const summaryB   = [totalARS > 0 ? `ARS  $${fmtNumber(totalARS)}` : '—', '', '']
    const summaryC   = [totalUSD > 0 ? `USD  u$s${fmtNumber(totalUSD)}` : '—', '', '']
    const separatorRow = Array(NCOLS).fill('')

    return {
      rows,
      totalARS,
      totalUSD,
      values: [titleRow, [...summaryA, ...summaryB, ...summaryC], separatorRow, HEADER_ROW, ...rows],
    }
  }

  const sheets = [
    { range: 'Todas',          sheetId: 0, data: buildSheetData(reservas!, SHEET_TITLE) },
    { range: 'Emprendimientos', sheetId: 1, data: buildSheetData(reservas!.filter(r => EMP_UNIDADES.includes(r.unidad)), 'Emprendimientos') },
    { range: 'Residencial',    sheetId: 2, data: buildSheetData(reservas!.filter(r => RES_UNIDADES.includes(r.unidad)), 'Residencial') },
    { range: 'Comercial',      sheetId: 3, data: buildSheetData(reservas!.filter(r => COM_UNIDADES.includes(r.unidad)), 'Comercial') },
  ]

  // 6. Escribir valores
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: gHeaders,
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: sheets.map(s => ({ range: `${s.range}!A1`, values: s.data.values })),
    }),
  })

  // 7. Aplicar formato
  const allFormatRequests = sheets.flatMap(s =>
    buildFormatRequests(s.sheetId, s.data.rows, s.data.totalARS, s.data.totalUSD)
  )

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: gHeaders,
    body: JSON.stringify({ requests: allFormatRequests }),
  })

  return NextResponse.json({
    ok: true,
    url: spreadsheetUrl,
    total: reservas!.length,
    spreadsheetId,
    ...(!savedId ? { action: 'CREADO — guardá este ID en la variable SHEETS_RESERVAS_ID de Vercel para que los próximos exports actualicen este mismo archivo' } : { action: 'ACTUALIZADO' }),
  })
}
