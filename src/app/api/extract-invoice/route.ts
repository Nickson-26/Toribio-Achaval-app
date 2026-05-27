import { NextRequest } from 'next/server'

// Aumentar límite del body para PDFs en base64 (hasta ~4MB)
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY no configurada. Agregala en .env.local' },
      { status: 500 }
    )
  }

  let pdfBase64: string
  try {
    const body = await req.json()
    pdfBase64 = body.pdfBase64
    if (!pdfBase64) throw new Error('falta pdfBase64')
  } catch {
    return Response.json({ error: 'Body inválido — se esperaba { pdfBase64: string }' }, { status: 400 })
  }

  const prompt = `Sos un extractor de datos de facturas argentinas (AFIP/ARCA).
Analizá este comprobante y devolvé ÚNICAMENTE un JSON con esta estructura exacta (sin texto adicional, sin markdown):
{
  "tipo": "FACT A" | "FACT B" | "FACT DE CREDITO" | "FACT E" | "NC A" | "NC B" | "ND A" | "ND B",
  "fecha": "YYYY-MM-DD",
  "cliente": "razón social del receptor (a quien se le emite)",
  "concepto": "descripción del servicio o producto facturado",
  "punto_venta": "XXXX (4 dígitos, ej: 0002)",
  "tipo_cambio": número o null,
  "neto_ars": número sin separadores de miles o null,
  "iva_ars": número sin separadores de miles o null,
  "total_ars": número sin separadores de miles o null,
  "neto_usd": número o null,
  "total_usd": número o null
}
Reglas:
- Si el comprobante es Factura A o FCE, separar neto e IVA.
- Si es Factura B, solo total (sin IVA separado).
- Los montos deben ser números puros (ej: 121000.5 no "$121.000,50").
- Solo el JSON, absolutamente nada más.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return Response.json(
        { error: `Error de Claude API (${response.status}): ${errText}` },
        { status: 502 }
      )
    }

    const claudeData = await response.json()
    const rawText = claudeData.content?.[0]?.text?.trim() || ''

    // Limpiar posibles backticks o bloques ```json ... ```
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    try {
      const extracted = JSON.parse(cleaned)
      return Response.json(extracted)
    } catch {
      return Response.json(
        { error: 'No se pudo parsear la respuesta de Claude', raw: rawText },
        { status: 422 }
      )
    }
  } catch (err: any) {
    return Response.json(
      { error: 'Error interno: ' + (err.message || 'desconocido') },
      { status: 500 }
    )
  }
}
