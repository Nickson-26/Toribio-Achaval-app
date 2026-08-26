/**
 * Checklist del SHELL mobile — las 12 condiciones acordadas para 390×844.
 *
 * Separado de smoke-mobile.mjs a propósito: aquel mide la composición del
 * Inicio; éste mide que el shell y la navegación funcionen, que es lo que
 * tiene que quedar sano AHORA aunque las pantallas internas (Recibos,
 * Facturación) todavía tengan su layout viejo.
 *
 * Distingue explícitamente:
 *   · SHELL  -> topbar, cajón, navegación. Falla si algo no anda.
 *   · CONTENIDO INTERNO -> el layout viejo de cada pantalla. Se MIDE y se
 *     REPORTA para su fase, pero no se cuenta como fallo de esta entrega.
 *
 * Uso: node scripts/smoke-mobile-nav.mjs <baseUrl> <usuarios> <dirSalida>
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const [BASE, USERS_FILE, OUT] = process.argv.slice(2)
fs.mkdirSync(OUT, { recursive: true })
const [, , email, pass] = fs.readFileSync(USERS_FILE, 'utf8').trim().split('\n')[0].split('|')

const fallos = []
const deuda = []   // contenido interno viejo: se documenta, no se cuenta como fallo
const fallo = m => { fallos.push(m); console.log(`  ✗ ${m}`) }
const pend  = m => { deuda.push(m);  console.log(`  ▸ ${m}`) }
const ok    = m => console.log(`  ✓ ${m}`)

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2, isMobile: true, hasTouch: true,
})
const p = await ctx.newPage()
const errores = []
p.on('pageerror', e => errores.push(String(e).slice(0, 160)))
p.on('console', m => { if (m.type() === 'error') errores.push(m.text().slice(0, 160)) })

await p.goto(BASE, { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(1500)
await p.locator('input[type=email]').first().fill(email)
await p.locator('input[type=password]').first().fill(pass)
await p.locator('button[type=submit], .auth-submit').first().click()
await p.waitForSelector('.ta-home', { timeout: 30000 })
await p.waitForTimeout(1500)
console.log('Sesión iniciada\n')

// Qué deployment está sirviendo esto, dicho por la propia página.
const dpl = await p.evaluate(() => {
  const l = [...document.querySelectorAll('link[href*="dpl_"], script[src*="dpl_"]')][0]
  const u = l?.getAttribute('href') || l?.getAttribute('src') || ''
  return (u.match(/dpl_[A-Za-z0-9]+/) || [null])[0]
})
console.log(`Deployment servido: ${dpl}\n`)

console.log('═══ 1-2. TOPBAR ═══')
const topbar = await p.evaluate(() => {
  const vis = e => !!(e && e.getBoundingClientRect().width > 0)
  return {
    burger:  vis(document.querySelector('.ta-topbar__burger')),
    titulo:  document.querySelector('.ta-topbar__title')?.textContent ?? null,
    // Por aria-label, no por clase: una clase mal escrita da un veredicto
    // falso —en los dos sentidos— y ya nos pasó una vez.
    ojo: vis(document.querySelector(
      '.ta-topbar [aria-label="Ocultar cifras"], .ta-topbar [aria-label="Mostrar cifras"]')),
    ctaIcono: vis(document.querySelector('.ta-topbar__cta-icon')),
    ctaAncho: [...document.querySelectorAll('.ta-topbar button')]
      .some(b => /nueva factura/i.test(b.textContent || '') && b.getBoundingClientRect().width > 0),
    temaExiste:  !!document.querySelector('.ta-topbar .ta-theme-group'),
    temaVisible: vis(document.querySelector('.ta-topbar .ta-theme-group')),
    alto: Math.round(document.querySelector('.ta-topbar').getBoundingClientRect().height),
  }
})
if (!topbar.burger)   fallo('no hay hamburguesa en la topbar')
if (!topbar.titulo)   fallo('no hay título en la topbar')
if (!topbar.ojo)      fallo('no está el control de privacidad')
if (!topbar.ctaIcono) fallo('no está el CTA compacto')
if (topbar.ctaAncho)  fallo('sigue el CTA ancho "Nueva factura" en mobile')
if (!topbar.temaExiste) fallo('.ta-theme-group no existe: la prueba del tema no sería válida')
else if (topbar.temaVisible) fallo('el selector completo de temas sigue en la topbar')
if (!fallos.length) ok(`topbar = hamburguesa + "${topbar.titulo}" + ojo + CTA icono (${topbar.alto}px)`)

console.log('\n═══ 3-6. CAJÓN ═══')
await p.locator('.ta-topbar__burger').click()
await p.waitForTimeout(600)
const drawer = await p.evaluate(() => {
  const sb = document.querySelector('.ta-sidebar')
  const tb = document.querySelector('.ta-topbar')
  const sc = document.querySelector('.ta-sidebar__scrim')
  const nav = document.querySelector('.ta-nav')
  const r = sb.getBoundingClientRect()
  const cs = getComputedStyle(sb)
  return {
    zEncima: +cs.zIndex > +getComputedStyle(tb).zIndex,
    top: Math.round(r.top),
    alto: Math.round(r.height),
    vh: window.innerHeight,
    ancho: Math.round(r.width),
    equivaleA100dvh: Math.abs(r.height - window.innerHeight) <= 1,
    cerrarVisible: !!document.querySelector('.ta-sidebar__close')?.getBoundingClientRect().width,
    scrimVisible: !!sc && getComputedStyle(sc).display !== 'none',
    bodyBloqueado: getComputedStyle(document.body).overflow === 'hidden',
    contraerVisible: [...sb.querySelectorAll('button')]
      .some(b => /contraer/i.test(b.textContent || '') && b.getBoundingClientRect().width > 0),
    navScrollable: nav ? getComputedStyle(nav).overflowY : null,
    navDesborda: nav ? nav.scrollHeight - nav.clientHeight : null,
    items: [...sb.querySelectorAll('.ta-nav__item')].map(e => ({
      txt: e.textContent.trim().replace(/\s+/g, ' '),
      alto: Math.round(e.getBoundingClientRect().height),
      // ¿Está realmente dentro del cajón visible, o cortado abajo?
      dentro: e.getBoundingClientRect().bottom <= window.innerHeight + 1,
    })),
  }
})
if (!drawer.zEncima)         fallo('el cajón queda por debajo de la topbar')
else ok('cajón por encima de la topbar')
if (!drawer.cerrarVisible)   fallo('no hay botón X visible')
else ok('botón X visible')
if (!drawer.equivaleA100dvh) fallo(`el cajón mide ${drawer.alto}px de ${drawer.vh}px de viewport`)
else ok(`cajón ${drawer.ancho}×${drawer.alto}px = alto completo`)
if (!drawer.scrimVisible)    fallo('no hay scrim')
else ok('scrim presente')
if (!drawer.bodyBloqueado)   fallo('el fondo sigue scrolleando')
else ok('fondo bloqueado')
if (drawer.contraerVisible)  fallo('"Contraer" (control de escritorio) visible dentro del cajón mobile')
else ok('sin "Contraer" en el cajón mobile')

const cortados = drawer.items.filter(i => !i.dentro)
if (cortados.length && drawer.navDesborda <= 0)
  fallo(`${cortados.length} items fuera de pantalla y la navegación no scrollea`)
else if (cortados.length)
  ok(`${cortados.length} items abajo del pliegue, pero la navegación scrollea`)
else ok(`los ${drawer.items.length} items entran en pantalla`)
console.log(`    items: ${drawer.items.map(i => i.txt).join(' · ')}`)

await p.screenshot({ path: path.join(OUT, 'nav_drawer.png') })

console.log('\n═══ 7-8. NAVEGACIÓN A CADA PANTALLA ═══')
const nombres = drawer.items.map(i => i.txt.replace(/\s*\d+$/, '').trim())
for (const nombre of nombres) {
  const abierto = await p.evaluate(() => !!document.querySelector('.ta-shell.is-drawer-open'))
  if (!abierto) { await p.locator('.ta-topbar__burger').click(); await p.waitForTimeout(500) }

  const item = p.locator('.ta-nav__item', { hasText: nombre }).first()
  try { await item.scrollIntoViewIfNeeded({ timeout: 3000 }) } catch {}
  try {
    await item.click({ timeout: 5000 })
  } catch (e) {
    fallo(`no se pudo tocar "${nombre}": ${String(e).slice(0, 80)}`)
    continue
  }
  await p.waitForTimeout(1400)

  const r = await p.evaluate(() => ({
    titulo: document.querySelector('.ta-topbar__title')?.textContent ?? null,
    drawerCerrado: !document.querySelector('.ta-shell.is-drawer-open'),
    bodyLiberado: getComputedStyle(document.body).overflow !== 'hidden',
    // Contenido interno: ¿la pantalla desborda a lo ancho?
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    tabla: !!document.querySelector('table'),
  }))

  if (!r.drawerCerrado) fallo(`el cajón no se cerró al navegar a ${nombre}`)
  if (!r.bodyLiberado)  fallo(`el fondo quedó bloqueado tras navegar a ${nombre}`)

  const estado = r.drawerCerrado && r.bodyLiberado ? '✓' : '✗'
  console.log(`  ${estado} ${nombre} -> "${r.titulo}"${r.overflow > 1 ? `  [desborda ${r.overflow}px]` : ''}`)

  // El desborde de una pantalla NO migrada es deuda de su fase, no fallo del shell.
  if (r.overflow > 1) {
    pend(`${nombre}: el contenido desborda ${r.overflow}px a lo ancho${r.tabla ? ' (tabla sin adaptar)' : ''}`)
    await p.screenshot({ path: path.join(OUT, `interno_${nombre.replace(/\W+/g, '-')}.png`) })
  }
}

console.log('\n═══ 9. SCRIM CIERRA EL CAJÓN ═══')
await p.locator('.ta-topbar__burger').click()
await p.waitForTimeout(500)
const vp = p.viewportSize()
await p.mouse.click(vp.width - 20, Math.round(vp.height / 2))
await p.waitForTimeout(600)
const porScrim = await p.evaluate(() => ({
  cerrado: !document.querySelector('.ta-shell.is-drawer-open'),
  bodyLiberado: getComputedStyle(document.body).overflow !== 'hidden',
}))
if (!porScrim.cerrado) fallo('el scrim no cierra el cajón')
else ok('el scrim cierra el cajón')
if (!porScrim.bodyLiberado) fallo('el fondo queda bloqueado tras cerrar por scrim')
else ok('el fondo se libera al cerrar')

console.log('\n═══ 10. EL TEMA SIGUE SIENDO ALCANZABLE ═══')
await p.locator('.ta-topbar__burger').click()
await p.waitForTimeout(500)
await p.locator('.ta-userchip').first().click()
await p.waitForTimeout(500)
const menu = await p.evaluate(() => {
  const g = document.querySelector('.ta-menu__tema .ta-theme-group')
  return {
    visible: !!g && g.getBoundingClientRect().width > 0,
    botones: g ? g.querySelectorAll('button').length : 0,
  }
})
if (!menu.visible) fallo('el tema no es alcanzable desde el menú de usuario')
else ok(`tema en el menú de usuario (${menu.botones} opciones)`)
await p.screenshot({ path: path.join(OUT, 'nav_menu_usuario.png') })

await p.keyboard.press('Escape'); await p.waitForTimeout(200)
await p.keyboard.press('Escape'); await p.waitForTimeout(500)

await browser.close()

console.log('\n' + '═'.repeat(64))
if (errores.length) {
  console.log('ERRORES DE CONSOLA:')
  ;[...new Set(errores)].forEach(e => console.log('  ' + e))
}
console.log(`SHELL — FALLOS: ${fallos.length}`)
fallos.forEach(f => console.log('  ✗ ' + f))
console.log(`\nCONTENIDO INTERNO — deuda documentada para sus fases: ${deuda.length}`)
deuda.forEach(d => console.log('  ▸ ' + d))
console.log(`\nCapturas en ${OUT}`)
process.exit(fallos.length ? 1 : 0)
