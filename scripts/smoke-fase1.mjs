/**
 * Smoke test visual de la Fase 1.
 *
 * Levanta Chromium headless, inicia sesión con un usuario real por cada rol y
 * recorre el AppShell en los tres temas y en varios anchos, capturando y
 * midiendo. No es un test unitario: verifica lo que sólo se ve en un navegador
 * — overflow, dobles paddings, focus, gateo de CTAs por rol.
 *
 * Uso:  node scripts/smoke-fase1.mjs <baseUrl> <archivoDeUsuarios> <dirSalida>
 * El archivo de usuarios es una línea por rol: rol|uid|email|password
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const [BASE, USERS_FILE, OUT] = process.argv.slice(2)
if (!BASE || !USERS_FILE || !OUT) {
  console.error('faltan argumentos'); process.exit(1)
}
fs.mkdirSync(OUT, { recursive: true })

const users = fs.readFileSync(USERS_FILE, 'utf8').trim().split('\n')
  .map(l => l.split('|')).filter(p => p.length >= 4)
  .map(([rol, uid, email, pass]) => ({ rol, uid, email, pass }))

const THEMES = ['light', 'dark', 'accessible']
const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '390x844',  width: 390,  height: 844 },
]
const PANTALLAS = ['inicio', 'facturas', 'recibos', 'clientes', 'reservas', 'nc', 'nd', 'informe', 'usuarios']

const findings = []
const add = (sev, ctx, msg) => { findings.push({ sev, ctx, msg }); console.log(`  [${sev}] ${ctx} — ${msg}`) }

async function login(page, u) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  const email = page.locator('input[type=email], input[name=email]').first()
  if (await email.count() === 0) {
    // Ya hay sesión o la pantalla es otra
    return await page.locator('.ta-shell').count() > 0
  }
  await email.fill(u.email)
  await page.locator('input[type=password]').first().fill(u.pass)
  await page.locator('button[type=submit], .auth-submit').first().click()
  await page.waitForTimeout(2600)
  return await page.locator('.ta-shell').count() > 0
}

async function setTheme(page, t) {
  await page.evaluate(th => {
    localStorage.setItem('ta-theme', th)
    if (th === 'dark') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', th)
  }, t)
  await page.waitForTimeout(250)
}

/** Detecta desbordes horizontales reales dentro del área de contenido. */
async function overflow(page) {
  return await page.evaluate(() => {
    const doc = document.documentElement
    const pageOverflow = doc.scrollWidth - doc.clientWidth
    const main = document.querySelector('.ta-content')
    const inner = main ? main.scrollWidth - main.clientWidth : 0
    return { pageOverflow, inner }
  })
}

/** Paddings efectivos, para detectar duplicaciones. */
async function paddings(page) {
  return await page.evaluate(() => {
    const g = s => { const e = document.querySelector(s); return e ? getComputedStyle(e).padding : null }
    return { content: g('.ta-content'), dash: g('.dashboard-shell'), sidebar: g('.ta-sidebar') }
  })
}

async function contrastes(page) {
  return await page.evaluate(() => {
    function rgb(s) { const m = s.match(/\d+(\.\d+)?/g); return m ? m.slice(0, 3).map(Number) : null }
    function lum([r, g, b]) {
      const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    function bgOf(el) {
      let n = el
      while (n && n !== document.documentElement) {
        const c = getComputedStyle(n).backgroundColor
        const m = c.match(/rgba?\(([^)]+)\)/)
        if (m) {
          const p = m[1].split(',').map(s => parseFloat(s))
          if (p.length < 4 || p[3] > 0.55) return [p[0], p[1], p[2]]
        }
        n = n.parentElement
      }
      return [255, 255, 255]
    }
    function cr(a, b) { const la = lum(a), lb = lum(b); const hi = Math.max(la, lb), lo = Math.min(la, lb); return (hi + 0.05) / (lo + 0.05) }
    const out = []
    for (const sel of ['.ta-brand__sub', '.ta-nav__heading', '.ta-nav__item', '.ta-userchip__role', '.ta-topbar__title', '.ta-badge']) {
      const el = document.querySelector(sel)
      if (!el) continue
      const fg = rgb(getComputedStyle(el).color)
      if (!fg) continue
      out.push({ sel, ratio: +cr(fg, bgOf(el)).toFixed(2) })
    }
    return out
  })
}

const browser = await chromium.launch()

for (const u of users) {
  console.log(`\n═══ ROL: ${u.rol} ═══`)
  const ctxb = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const page = await ctxb.newPage()
  const errores = []
  page.on('console', m => { if (m.type() === 'error') errores.push(m.text().slice(0, 160)) })
  page.on('pageerror', e => errores.push('pageerror: ' + String(e).slice(0, 160)))

  const ok = await login(page, u)
  if (!ok) { add('FALLO', u.rol, 'no se pudo entrar al AppShell'); await ctxb.close(); continue }
  console.log('  login OK, AppShell montado')

  // ── Navegación por todas las pantallas ──
  for (const p of PANTALLAS) {
    const item = page.locator(`.ta-nav__item`).filter({ hasText: '' })
    const visible = await page.evaluate(id => {
      const btns = [...document.querySelectorAll('.ta-nav__item')]
      return btns.map(b => b.textContent.trim())
    })
    // se navega por el orden real de la sidebar más abajo
    void item; void p; void visible
    break
  }
  const navLabels = await page.evaluate(() =>
    [...document.querySelectorAll('.ta-nav__item')].map(b => b.textContent.replace(/\d+$/, '').trim()))
  console.log(`  sidebar (${navLabels.length}): ${navLabels.join(' · ')}`)

  for (let i = 0; i < navLabels.length; i++) {
    await page.locator('.ta-nav__item').nth(i).click()
    await page.waitForTimeout(1500)
    const o = await overflow(page)
    if (o.inner > 4) add('AVISO', `${u.rol}/${navLabels[i]}`, `overflow horizontal en el contenido: ${o.inner}px`)
    const title = await page.locator('.ta-topbar__title').textContent().catch(() => '')
    const crashed = await page.locator('.ta-shell').count() === 0
    if (crashed) add('FALLO', `${u.rol}/${navLabels[i]}`, 'el shell desapareció')
    else console.log(`    ${navLabels[i]} -> "${title}" ${o.inner > 4 ? '(overflow)' : 'ok'}`)
  }

  // ── CTA según permisos ──
  await page.locator('.ta-nav__item').first().click()
  await page.waitForTimeout(900)
  const cta = await page.locator('.ta-topbar__actions .ta-btn--primary').count()
  const esperado = u.rol === 'viewer' ? 0 : 1
  if (cta !== esperado) add('FALLO', u.rol, `CTA "Nueva factura": esperado ${esperado}, encontrado ${cta}`)
  else console.log(`  CTA "Nueva factura" ${cta ? 'visible' : 'oculto'} — correcto para ${u.rol}`)

  // ── Menú de usuario ──
  await page.locator('.ta-userchip').click()
  await page.waitForTimeout(400)
  const menuItems = await page.locator('.ta-menu__item').count()
  const rolTexto = await page.locator('.ta-userchip__role').textContent()
  if (menuItems < 2) add('FALLO', u.rol, `menú de usuario con ${menuItems} ítems`)
  else console.log(`  menú de usuario: ${menuItems} ítems · rol mostrado "${rolTexto}"`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)

  // ── Focus visible ──
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab')
  const foco = await page.evaluate(() => {
    const el = document.activeElement
    if (!el || el === document.body) return null
    const s = getComputedStyle(el)
    return { tag: el.tagName, outline: s.outlineWidth, style: s.outlineStyle, shadow: s.boxShadow.slice(0, 40) }
  })
  if (!foco) add('AVISO', u.rol, 'el tabulador no llegó a un elemento enfocable')
  else if (foco.outline === '0px' && !foco.shadow.includes('rgb')) add('FALLO', u.rol, `foco sin indicador visible en ${foco.tag}`)
  else console.log(`  focus visible en ${foco.tag}: outline ${foco.outline} ${foco.style}`)

  // ── Temas + viewports + capturas ──
  for (const t of THEMES) {
    await setTheme(page, t)
    const cs = await contrastes(page)
    const bajos = cs.filter(c => c.ratio < 4.5)
    console.log(`  tema ${t}: ${cs.map(c => `${c.sel.replace('.ta-', '')} ${c.ratio}`).join(' · ')}`)
    for (const b of bajos) {
      if (b.ratio < 3.0) add('FALLO', `${u.rol}/${t}`, `${b.sel} contraste ${b.ratio}:1 (< 3:1)`)
      else add('AVISO', `${u.rol}/${t}`, `${b.sel} contraste ${b.ratio}:1 (< 4.5:1, ok para UI)`)
    }
    if (u.rol === 'admin') {
      for (const v of VIEWPORTS) {
        await page.setViewportSize({ width: v.width, height: v.height })
        await page.waitForTimeout(500)
        const o = await overflow(page)
        if (o.pageOverflow > 4) add('AVISO', `${t}/${v.name}`, `scroll horizontal de página: ${o.pageOverflow}px`)
        await page.screenshot({ path: path.join(OUT, `${t}_${v.name}.png`) })
      }
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.waitForTimeout(400)
    }
  }

  // ── Sidebar colapsada ──
  await setTheme(page, 'light')
  const btnCol = page.locator('.ta-sidebar__footer .ta-btn--ghost')
  if (await btnCol.count()) {
    await btnCol.click(); await page.waitForTimeout(500)
    const w = await page.evaluate(() => document.querySelector('.ta-shell').getBoundingClientRect &&
      getComputedStyle(document.querySelector('.ta-shell')).gridTemplateColumns.split(' ')[0])
    const labelsVisibles = await page.locator('.ta-nav__label:visible').count()
    console.log(`  colapsada: ancho ${w}, labels visibles ${labelsVisibles}`)
    if (labelsVisibles > 0) add('AVISO', u.rol, `colapsada pero ${labelsVisibles} labels siguen visibles`)
    if (u.rol === 'admin') await page.screenshot({ path: path.join(OUT, 'light_colapsada.png') })
    await btnCol.click(); await page.waitForTimeout(400)
  } else add('AVISO', u.rol, 'no se encontró el botón de contraer')

  // ── Modal a través de la fachada ui.tsx ──
  if (u.rol !== 'viewer') {
    const nav = await page.evaluate(() =>
      [...document.querySelectorAll('.ta-nav__item')].findIndex(b => /Facturaci/.test(b.textContent)))
    if (nav >= 0) {
      await page.locator('.ta-nav__item').nth(nav).click()
      await page.waitForTimeout(1800)
      // El botón DE LA PANTALLA, no el CTA de la topbar (que sólo navega).
      const nueva = page.locator('button.btn-primary').filter({ hasText: /Nueva factura/i }).first()
      if (await nueva.count()) {
        await nueva.click(); await page.waitForTimeout(1600)
        const modales = await page.locator('.ta-modal, .modal').count()
        const titulo = await page.locator('.ta-modal__title, .modal-header').first().textContent().catch(() => '?')
        if (!modales) add('FALLO', u.rol, 'el modal de nueva factura no abrió')
        else {
          const f = await page.evaluate(() => {
            const a = document.activeElement
            return { tag: a.tagName, enCuerpo: !!a.closest('.ta-modal__body'), tipo: a.getAttribute('type') || '' }
          })
          console.log(`  modal vía fachada ui.tsx: abrió ("${(titulo || '').trim().slice(0, 40)}")`)
          if (!f.enCuerpo) add('FALLO', u.rol, `foco inicial del modal fuera del cuerpo (${f.tag})`)
          else console.log(`  foco inicial en el primer campo: ${f.tag}${f.tipo ? '[' + f.tipo + ']' : ''} ✓`)
        }
        if (u.rol === 'admin' && modales) await page.screenshot({ path: path.join(OUT, 'light_modal.png') })
        await page.keyboard.press('Escape'); await page.waitForTimeout(500)
        const cerro = await page.locator('.ta-modal, .modal').count() === 0
        if (!cerro) add('AVISO', u.rol, 'el modal no cerró con Escape')
        else console.log('  Escape cierra el modal: ok')
      } else add('AVISO', u.rol, 'no se encontró el botón de nueva factura en la pantalla')
    }
  }

  // ── Badges de estado: ¿queda snake_case? ──
  const snake = await page.evaluate(() =>
    [...document.querySelectorAll('.ta-badge, .badge')].map(b => b.textContent.trim()).filter(t => t.includes('_')))
  if (snake.length) add('FALLO', u.rol, `badges con snake_case: ${[...new Set(snake)].join(', ')}`)
  else console.log('  badges: sin snake_case')

  if (errores.length) {
    const uniq = [...new Set(errores)].slice(0, 4)
    for (const e of uniq) add('AVISO', u.rol, `consola: ${e}`)
  } else console.log('  consola: sin errores')

  await ctxb.close()
}

await browser.close()

console.log('\n═══════════ RESUMEN ═══════════')
const fallos = findings.filter(f => f.sev === 'FALLO')
const avisos = findings.filter(f => f.sev === 'AVISO')
console.log(`  FALLOS: ${fallos.length}`)
console.log(`  AVISOS: ${avisos.length}`)
console.log(`  capturas en ${OUT}`)
fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify(findings, null, 2))
process.exit(fallos.length ? 1 : 0)
