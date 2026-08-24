/**
 * Smoke test del nuevo Inicio (Fase 2).
 *
 * Verifica en un navegador real, con un usuario por rol, lo que no se ve
 * leyendo código: composición, overflow, permisos, privacidad de cifras y que
 * ningún estado técnico se filtre a la UI.
 *
 * Uso: node scripts/smoke-home.mjs <baseUrl> <usuarios> <dirSalida>
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const [BASE, USERS_FILE, OUT] = process.argv.slice(2)
fs.mkdirSync(OUT, { recursive: true })
const users = fs.readFileSync(USERS_FILE, 'utf8').trim().split('\n')
  .map(l => l.split('|')).filter(p => p.length >= 4)
  .map(([rol, uid, email, pass]) => ({ rol, email, pass }))

const findings = []
const add = (sev, ctx, msg) => { findings.push({ sev, ctx, msg }); console.log(`  [${sev}] ${ctx} — ${msg}`) }

async function login(page, u) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  await page.locator('input[type=email]').first().fill(u.email)
  await page.locator('input[type=password]').first().fill(u.pass)
  await page.locator('button[type=submit], .auth-submit').first().click()
  await page.waitForTimeout(3000)
  return await page.locator('.ta-home').count() > 0
}

const setTheme = (page, t) => page.evaluate(th => {
  localStorage.setItem('ta-theme', th)
  th === 'dark' ? document.documentElement.removeAttribute('data-theme')
                : document.documentElement.setAttribute('data-theme', th)
}, t)

const browser = await chromium.launch()

for (const u of users) {
  console.log(`\n═══ ROL: ${u.rol} ═══`)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('console', m => { if (m.type() === 'error') errores.push(m.text().slice(0, 150)) })
  page.on('pageerror', e => errores.push('pageerror: ' + String(e).slice(0, 150)))

  if (!await login(page, u)) { add('FALLO', u.rol, 'el Inicio no montó'); await ctx.close(); continue }
  console.log('  Inicio montado')

  // ── Composición ──
  const comp = await page.evaluate(() => ({
    saludo: document.querySelector('.ta-home__saludo')?.textContent ?? null,
    sub: document.querySelector('.ta-home__sub')?.textContent ?? null,
    secciones: [...document.querySelectorAll('.ta-sec__title')].map(e => e.textContent),
    atencion: [...document.querySelectorAll('.ta-atn__item')].map(e => ({
      titulo: e.querySelector('.ta-atn__titulo')?.textContent,
      detalle: e.querySelector('.ta-atn__detalle')?.textContent,
      flag: e.querySelector('.ta-atn__flag')?.textContent ?? null,
      monto: e.querySelector('.ta-atn__monto')?.textContent ?? null,
    })),
    acciones: [...document.querySelectorAll('.ta-qa__btn')].map(e => e.textContent.trim()),
    metricas: [...document.querySelectorAll('.ta-sum__item')].map(e => ({
      label: e.querySelector('.ta-sum__label')?.textContent,
      nota: e.querySelector('.ta-sum__nota')?.textContent,
    })),
    actividad: document.querySelectorAll('.ta-list__row').length,
    graficos: document.querySelectorAll('canvas').length,
    vacio: !!document.querySelector('.ta-state'),
  }))
  console.log(`  saludo: "${comp.saludo}" / "${comp.sub}"`)
  console.log(`  secciones: ${comp.secciones.join(' · ')}`)
  console.log(`  atención (${comp.atencion.length}):`)
  comp.atencion.forEach(a => console.log(`     ${a.titulo} — ${a.detalle} — ${a.monto}${a.flag ? ` | ${a.flag}` : ''}`))
  console.log(`  acciones (${comp.acciones.length}): ${comp.acciones.join(' · ')}`)
  console.log(`  métricas: ${comp.metricas.map(m => `${m.label} (${m.nota})`).join(' · ')}`)
  console.log(`  filas de listas: ${comp.actividad}`)

  // ── Reglas duras ──
  if (comp.graficos > 0) add('FALLO', u.rol, `hay ${comp.graficos} <canvas>: el Home debe tener CERO gráficos`)
  else console.log('  gráficos: 0 ✓')

  if (comp.metricas.length !== 3) add('FALLO', u.rol, `resumen con ${comp.metricas.length} métricas, deberían ser 3`)
  if (comp.metricas.some(m => /pendiente/i.test(m.label ?? ''))) add('FALLO', u.rol, 'el resumen duplica "Pendiente"')
  if (comp.metricas.some(m => /IVA|ticket|mejor mes/i.test(m.label ?? ''))) add('FALLO', u.rol, 'métricas analíticas en el Home')

  // Estados técnicos filtrados a la UI
  const cuerpo = await page.evaluate(() => document.querySelector('.ta-home')?.textContent ?? '')
  for (const t of ['faltan_retenciones', 'echeq_pendiente', 'snake_case']) {
    if (cuerpo.includes(t)) add('FALLO', u.rol, `estado técnico visible en la UI: ${t}`)
  }
  if (/vencid|atrasad|moros/i.test(cuerpo)) add('FALLO', u.rol, 'vocabulario de vencimiento en el copy')

  // Retenciones nunca como deuda
  const ret = comp.atencion.find(a => /retenciones/i.test(a.titulo ?? ''))
  if (ret) {
    if (!/Pago recibido/i.test(ret.detalle ?? '')) add('FALLO', u.rol, 'Faltan retenciones no dice "Pago recibido"')
    else console.log('  "Faltan retenciones" comunica pago recibido ✓')
  }

  // Antigüedad dentro del item de pendientes, no como card aparte
  const pend = comp.atencion.filter(a => /pendiente/i.test(a.titulo ?? ''))
  if (pend.length > 1) add('FALLO', u.rol, `${pend.length} cards de pendientes: deberían ser una sola`)
  if (pend[0]?.flag) console.log(`  antigüedad dentro del item ✓ — "${pend[0].flag}"`)

  // ── Permisos ──
  const esperadas = u.rol === 'viewer' ? ['Buscar cliente'] : ['Nueva factura', 'Registrar cobro', 'Nuevo recibo', 'Buscar cliente']
  const falta = esperadas.filter(e => !comp.acciones.some(a => a.includes(e)))
  const sobra = comp.acciones.filter(a => !esperadas.some(e => a.includes(e)))
  if (falta.length || sobra.length) add('FALLO', u.rol, `acciones: faltan [${falta}] sobran [${sobra}]`)
  else console.log(`  permisos de acciones correctos para ${u.rol} ✓`)

  // ── Privacidad de cifras ──
  await page.locator('.ta-topbar__actions .ta-btn--icon').first().click()
  await page.waitForTimeout(500)
  const priv = await page.evaluate(() => {
    const sels = ['.ta-atn__monto', '.ta-atn__flag', '.ta-sum__valor', '.ta-list__monto']
    const out = {}
    for (const s of sels) {
      const els = [...document.querySelectorAll(s)]
      out[s] = { total: els.length, ocultos: els.filter(e => e.classList.contains('is-hidden-money') || e.querySelector('.is-hidden-money')).length }
    }
    return out
  })
  let privOk = true
  for (const [sel, v] of Object.entries(priv)) {
    if (v.total && v.ocultos < v.total) { privOk = false; add('FALLO', u.rol, `${sel}: ${v.ocultos}/${v.total} ocultos con el ojo activo`) }
  }
  if (privOk) console.log(`  privacidad: todas las cifras se ocultan ✓ (${Object.values(priv).reduce((s, v) => s + v.total, 0)} elementos)`)
  await page.locator('.ta-topbar__actions .ta-btn--icon').first().click()
  await page.waitForTimeout(400)

  // ── Navegación desde un item ──
  if (comp.atencion.length) {
    await page.locator('.ta-atn__item').first().click()
    await page.waitForTimeout(1800)
    const t = await page.locator('.ta-topbar__title').textContent().catch(() => '')
    if (!/Facturaci/.test(t ?? '')) add('FALLO', u.rol, `el item de atención no llevó a Facturación (fue a "${t}")`)
    else console.log('  click en atención -> Facturación ✓')
    await page.locator('.ta-nav__item').first().click()
    await page.waitForTimeout(1500)
  }

  // ── Temas y viewports ──
  for (const th of ['light', 'dark', 'accessible']) {
    await setTheme(page, th); await page.waitForTimeout(350)
    if (u.rol === 'admin') {
      for (const v of [[1440, 900], [1366, 768], [390, 844]]) {
        await page.setViewportSize({ width: v[0], height: v[1] })
        await page.waitForTimeout(500)
        const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        if (o > 4) add('AVISO', `${th}/${v[0]}`, `scroll horizontal ${o}px`)
        await page.screenshot({ path: path.join(OUT, `${th}_${v[0]}x${v[1]}.png`) })
      }
      await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(400)
    }
  }
  await setTheme(page, 'light'); await page.waitForTimeout(300)
  if (u.rol === 'viewer') await page.screenshot({ path: path.join(OUT, 'light_viewer.png') })

  // ── Altura de la primera pantalla a 1366 ──
  if (u.rol === 'admin') {
    await page.setViewportSize({ width: 1366, height: 768 }); await page.waitForTimeout(500)
    const fold = await page.evaluate(() => {
      const y = s => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().bottom) : null }
      return { atencion: y('.ta-atn'), acciones: y('.ta-qa'), resumen: y('.ta-sum'), alto: window.innerHeight }
    })
    console.log(`  a 1366x768 — atención termina en ${fold.atencion}px · acciones ${fold.acciones}px · resumen ${fold.resumen}px (pliegue ${fold.alto}px)`)
    if (fold.acciones && fold.acciones > fold.alto) add('AVISO', u.rol, 'las acciones rápidas caen debajo del pliegue a 1366')
    await page.setViewportSize({ width: 1440, height: 900 })
  }

  if (errores.length) [...new Set(errores)].slice(0, 3).forEach(e => add('AVISO', u.rol, `consola: ${e}`))
  else console.log('  consola: sin errores')

  await ctx.close()
}

await browser.close()
const f = findings.filter(x => x.sev === 'FALLO')
console.log(`\n═══ RESUMEN ═══\n  FALLOS: ${f.length}\n  AVISOS: ${findings.length - f.length}`)
fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify(findings, null, 2))
process.exit(f.length ? 1 : 0)
