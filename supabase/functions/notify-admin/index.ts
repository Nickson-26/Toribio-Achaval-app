import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ADMIN_EMAIL = 'nicolasscaniglia@toribioachaval.com'
const APP_URL     = 'https://ta-app-silk.vercel.app'

serve(async (req) => {
  try {
    const { nombre, email } = await req.json()

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'No API key' }), { status: 500 })
    }

    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
        <h2 style="color:#C8102E;margin-bottom:8px">Nueva solicitud de acceso</h2>
        <p style="color:#666;margin-bottom:24px">Un usuario solicitó acceso al sistema de facturación.</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
          <tr><td style="padding:8px 0;color:#999;font-size:13px">Nombre</td><td style="padding:8px 0;font-weight:500">${nombre}</td></tr>
          <tr><td style="padding:8px 0;color:#999;font-size:13px">Email</td><td style="padding:8px 0">${email}</td></tr>
        </table>
        <a href="${APP_URL}" style="display:inline-block;background:#C8102E;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500">
          Ir a la app para aprobar
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px">
          Entrá a Usuarios → verás la solicitud pendiente para aprobar o rechazar.
        </p>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'Facturación TA <noreply@toribioachaval.com>',
        to:      [ADMIN_EMAIL],
        subject: `Nueva solicitud de acceso — ${nombre}`,
        html,
      })
    })

    if (!res.ok) throw new Error(await res.text())
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
