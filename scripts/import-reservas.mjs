// Importador de reservas: toma un array de mails (subject/snippet/date)
// y los postea uno por uno al endpoint /api/reservas/import.
//
// Uso desde CLI:
//   IMPORT_URL=https://ta-app-toribio-achaval.vercel.app/api/reservas/import \
//   IMPORT_SECRET=<RESERVAS_IMPORT_SECRET> \
//   node scripts/import-reservas.mjs < emails.json
//
// emails.json esperado:
//   [
//     { "messageId": "...", "subject": "...", "snippet": "...", "dateIso": "2026-05-06T20:08:07Z" },
//     ...
//   ]

import { parseReservaEmail } from './parse-reserva-email.mjs'

const IMPORT_URL = process.env.IMPORT_URL || 'https://ta-app-toribio-achaval.vercel.app/api/reservas/import'
const IMPORT_SECRET = process.env.IMPORT_SECRET
const DRY_RUN = process.env.DRY_RUN === '1'

if (!DRY_RUN && !IMPORT_SECRET) {
  console.error('Falta IMPORT_SECRET (o usar DRY_RUN=1).')
  process.exit(1)
}

async function main() {
  const raw = await readStdin()
  let emails
  try {
    emails = JSON.parse(raw)
  } catch (e) {
    console.error('STDIN no es JSON válido:', e.message)
    process.exit(1)
  }
  if (!Array.isArray(emails)) {
    console.error('STDIN debe ser un array de mails.')
    process.exit(1)
  }

  const stats = { total: emails.length, inserted: 0, skipped: 0, parser_skipped: 0, errors: 0 }
  const review = []

  for (const m of emails) {
    const r = parseReservaEmail(m)
    if (!r.ok) {
      stats.parser_skipped++
      review.push({ messageId: m.messageId, subject: m.subject, reason: r.skip_reason })
      console.log(`  [SKIP parser] ${m.subject} — ${r.skip_reason}`)
      continue
    }
    if (DRY_RUN) {
      console.log(`  [DRY] ${m.subject} → ${r.payload.unidad} · ${r.payload.operacion} · ${r.payload.direccion}`)
      stats.inserted++ // contado como "se hubiera insertado"
      continue
    }
    try {
      const resp = await fetch(IMPORT_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${IMPORT_SECRET}`,
        },
        body: JSON.stringify(r.payload),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        stats.errors++
        console.log(`  [ERR ${resp.status}] ${m.subject} — ${JSON.stringify(json)}`)
      } else if (json.status === 'inserted') {
        stats.inserted++
        console.log(`  [OK] ${m.subject} → reserva id=${json.id}`)
      } else if (json.status === 'skipped') {
        stats.skipped++
        console.log(`  [DUP] ${m.subject} (${json.reason})`)
      } else {
        console.log(`  [?] ${m.subject} — ${JSON.stringify(json)}`)
      }
    } catch (e) {
      stats.errors++
      console.log(`  [NET-ERR] ${m.subject} — ${e.message}`)
    }
  }

  console.log('\n──────── Resumen ────────')
  console.log(`Total mails:     ${stats.total}`)
  console.log(`Insertados:      ${stats.inserted}${DRY_RUN ? ' (dry-run)' : ''}`)
  console.log(`Duplicados:      ${stats.skipped}`)
  console.log(`Skip por parser: ${stats.parser_skipped}`)
  console.log(`Errores:         ${stats.errors}`)
  if (review.length) {
    console.log('\nMails para review manual:')
    for (const r of review) console.log(`  · ${r.subject} — ${r.reason}`)
  }
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (c) => (data += c))
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', reject)
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
