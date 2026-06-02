import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Vercel Cron: lunes 09:00 ARG (12:00 UTC)
// Llama al endpoint de export-sheets para actualizar el archivo en Drive

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ta-app-toribio-achaval.vercel.app'

  try {
    const resp = await fetch(`${baseUrl}/api/reservas/export-sheets`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    })
    const json = await resp.json()
    console.log('[cron/export-sheets] resultado:', JSON.stringify(json))
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), result: json })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
