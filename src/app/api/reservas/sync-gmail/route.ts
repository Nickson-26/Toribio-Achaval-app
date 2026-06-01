import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseReservaEmail } from '@/scripts/parse-reserva-email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SENDER = 'info@toribioachaval.com'
const MAX_RESULTS = 50 // mails a procesar por run

async function getGmailToken(refreshToken: string): Promise<string> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const json = await resp.json()
  if (!json.access_token) throw new Error(`Gmail token error: ${JSON.stringify(json)}`)
  return json.access_token
}

async function fetchNewReservaMails(accessToken: string) {
  const headers = { Authorization: `Bearer ${accessToken}` }

  // Buscar mails de Nueva Reserva del remitente
  const q = encodeURIComponent(`from:${SENDER} subject:"Nueva Reserva"`)
  const listResp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=${MAX_RESULTS}`,
    { headers }
  )
  const listJson = await listResp.json()
  const messages: { id: string }[] = listJson.messages || []

  const results = []
  for (const msg of messages) {
    const detailResp = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers }
    )
    const detail = await detailResp.json()
    const headers2 = detail.payload?.headers || []
    const subject = headers2.find((h: any) => h.name === 'Subject')?.value || ''
    const date = headers2.find((h: any) => h.name === 'Date')?.value || ''

    results.push({
      messageId: msg.id,
      subject,
      snippet: detail.snippet || '',
      dateIso: date ? new Date(date).toISOString() : new Date().toISOString(),
    })
  }

  return results
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const secret = process.env.RESERVAS_IMPORT_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const refreshToken = process.env.GMAIL_REFRESH_TOKEN
  if (!refreshToken) {
    return NextResponse.json({ error: 'GMAIL_REFRESH_TOKEN not set' }, { status: 500 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  let accessToken: string
  try {
    accessToken = await getGmailToken(refreshToken)
  } catch (e: any) {
    return NextResponse.json({ error: 'gmail_auth_failed', detail: e.message }, { status: 500 })
  }

  let mails
  try {
    mails = await fetchNewReservaMails(accessToken)
  } catch (e: any) {
    return NextResponse.json({ error: 'gmail_fetch_failed', detail: e.message }, { status: 500 })
  }

  let inserted = 0, skipped = 0, parser_skipped = 0, errors = 0

  for (const mail of mails) {
    const parsed = parseReservaEmail(mail)
    if (!parsed.ok) {
      parser_skipped++
      console.log(`[sync-gmail] SKIP ${mail.subject}: ${parsed.skip_reason}`)
      continue
    }

    try {
      // Idempotencia por email_message_id
      const { data: existing } = await sb
        .from('reservas').select('id')
        .eq('email_message_id', mail.messageId).maybeSingle()

      if (existing) { skipped++; continue }

      await sb.from('reservas').insert({ ...parsed.payload, email_message_id: mail.messageId })
      inserted++
    } catch (e: any) {
      if (e.message?.includes('23505')) { skipped++; continue }
      console.error(`[sync-gmail] Error ${mail.messageId}:`, e.message)
      errors++
    }
  }

  return NextResponse.json({
    status: 'ok', total: mails.length,
    inserted, skipped, parser_skipped, errors,
    timestamp: new Date().toISOString(),
  })
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'reservas/sync-gmail' })
}
