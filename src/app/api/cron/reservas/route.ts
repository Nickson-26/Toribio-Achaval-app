import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Vercel Cron llama a este endpoint con el header Authorization: Bearer CRON_SECRET
// Configurado en vercel.json

export async function GET(req: NextRequest) {
  // Vercel Cron usa el header Authorization con CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ta-app-toribio-achaval.vercel.app'
  const importSecret = process.env.RESERVAS_IMPORT_SECRET
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${importSecret}`,
  }

  const results: Record<string, any> = {}

  // 1. Sync PROA
  try {
    const proaResp = await fetch(`${baseUrl}/api/reservas/sync-proa`, { method: 'POST', headers })
    results.proa = await proaResp.json()
  } catch (e: any) {
    results.proa = { error: e.message }
  }

  // 2. Sync Gmail
  try {
    const gmailResp = await fetch(`${baseUrl}/api/reservas/sync-gmail`, { method: 'POST', headers })
    results.gmail = await gmailResp.json()
  } catch (e: any) {
    results.gmail = { error: e.message }
  }

  console.log('[cron/reservas] resultado:', JSON.stringify(results))

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    results,
  })
}
