/**
 * Smoke test MOBILE del Inicio (Fase 2).
 *
 * Nace de una lección: el smoke anterior daba PASS porque los elementos
 * existían y no había overflow de página, mientras en un iPhone real el título
 * chocaba con un icono, la señal de +60 días se partía en cuatro renglones y el
 * Resumen quedaba fuera del primer recorrido.
 *
 * Por eso acá NO alcanza con que las cosas existan. Se mide:
 *   · texto recortado (scrollWidth > clientWidth) elemento por elemento;
 *   · cuántos renglones ocupa realmente la señal de antigüedad;
 *   · superposición geométrica entre piezas de la topbar;
 *   · altura real de las acciones rápidas;
 *   · a qué distancia del top aparece el Resumen, en pantallas de viewport;
 *   · tamaño de los blancos táctiles;
 *   · comportamiento del drawer (safe area, scrim, cierre).
 *
 * Y además deja capturas para mirar con los ojos, que es el único juez final.
 *
 * Uso: node scripts/smoke-mobile.mjs <baseUrl> <usuarios> <dirSalida>
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const [BASE, USERS_FILE, OUT] = process.argv.slice(2)
fs.mkdirSync(OUT, { recursive: true })
const [rol, , email, pass] = fs.readFileSync(USERS_FILE, 'utf8').trim().split('\n')[0].split('|')

const fallos = []
const avisos = []
const fallo = (ctx, m) => { fallos.push(`${ctx} — ${m}`); console.log(`  ✗ ${ctx} — ${m}`) }
const aviso = (ctx, m) => { avisos.push(`${ctx} — ${m}`); console.log(`  ⚠ ${ctx} — ${m}`) }
const ok = m => console.log(`  ✓ ${m}`)

const VIEWPORTS = [
  { nombre: '390x844', width: 390, height: 844 },  // iPhone 14/15/16
  { nombre: '375x667', width: 375, height: 667 },  // iPhone SE / 8
  { nombre: '430x932', width: 430, height: 932 },  // iPhone Pro Max
]
const TEMAS = ['dark', 'light']

async function login(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  await page.locator('input[type=email]').first().fill(email)
  await page.locator('input[type=password]').first().fill(pass)
  await page.locator('button[type=submit], .auth-submit').first().click()
  await page.waitForTimeout(3500)
  return await page.locator('.ta-home').count() > 0
}

const setTheme = (page, t) => page.evaluate(th => {
  localStorage.setItem('ta-theme', th)
  th === 'dark' ? document.documentElement.removeAttribute('data-theme')
                : document.documentElement.setAttribute('data-theme', th)
}, t)

const browser = await chromium.launch()
const ctx0 = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
})
const page = await ctx0.newPage()
const errores = []
page.on('console', m => { if (m.type() === 'error') errores.push(m.text().slice(0, 160)) })
page.on('pageerror', e => errores.push('pageerror: ' + String(e).slice(0, 160)))

if (!await login(page)) { console.log('FALLO: no se pudo entrar'); process.exit(1) }
const storage = await ctx0.storageState()
await ctx0.close()

for (const vp of VIEWPORTS) {
  for (const tema of TEMAS) {
    const etiqueta = `${vp.nombre} ${tema}`
    console.log(`\n═══ ${etiqueta} ═══`)
    const c = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: storage,
    })
    const p = await c.newPage()
    p.on('pageerror', e => errores.push(`${etiqueta}: ` + String(e).slice(0, 160)))
    await p.goto(BASE, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(600)
    await setTheme(p, tema)
    await p.reload({ waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.ta-home', { timeout: 20000 })
    await p.waitForTimeout(1500)

    // ─────────────────────────────────────────────────────────────────────
    // 1. Scroll horizontal de página
    // ─────────────────────────────────────────────────────────────────────
    const overflowPagina = await p.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (overflowPagina > 1) fallo(etiqueta, `la página desborda ${overflowPagina}px a lo ancho`)
    else ok('sin scroll horizontal')

    // ─────────────────────────────────────────────────────────────────────
    // 2. Texto recortado, elemento por elemento
    // ─────────────────────────────────────────────────────────────────────
    const recortes = await p.evaluate(() => {
      const sel = [
        '.ta-home__saludo', '.ta-home__sub', '.ta-sec__title',
        '.ta-atn__titulo', '.ta-atn__detalle', '.ta-atn__monto', '.ta-atn__flag',
        '.ta-atn__flag-txt', '.ta-atn__cta-mobile',
        '.ta-qa__btn', '.ta-sum__label', '.ta-sum__valor', '.ta-sum__nota',
        '.ta-topbar__title', '.ta-home__filtros-btn',
      ].join(',')
      const out = []
      for (const e of document.querySelectorAll(sel)) {
        const cs = getComputedStyle(e)
        // Un elipsis deliberado no es un recorte: es una decisión de diseño.
        const elipsis = cs.textOverflow === 'ellipsis'
        const d = e.scrollWidth - e.clientWidth
        if (d > 2) out.push({ cls: e.className, d, elipsis, txt: (e.textContent || '').trim().slice(0, 48) })
      }
      return out
    })
    const cortados = recortes.filter(r => !r.elipsis)
    const abreviados = recortes.filter(r => r.elipsis)
    cortados.forEach(r => fallo(etiqueta, `texto recortado ${r.d}px en .${String(r.cls).split(' ')[0]}: "${r.txt}"`))
    // Un elipsis no rompe la pantalla, pero esconde información: se reporta.
    abreviados.forEach(r => aviso(etiqueta, `texto abreviado con elipsis en .${String(r.cls).split(' ')[0]}: "${r.txt}"`))
    if (!recortes.length) ok('ningún texto recortado ni abreviado')

    // ─────────────────────────────────────────────────────────────────────
    // 3. La señal +60 días: cuántos renglones ocupa de verdad
    // ─────────────────────────────────────────────────────────────────────
    const flag = await p.evaluate(() => {
      const e = document.querySelector('.ta-atn__flag')
      if (!e) return null
      const cs = getComputedStyle(e)
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4
      const alto = e.getBoundingClientRect().height
      const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
      return {
        renglones: Math.round((alto - pad) / lh),
        alto: Math.round(alto),
        texto: e.textContent.trim(),
        fs: cs.fontSize,
      }
    })
    if (!flag) aviso(etiqueta, 'no hay señal de antigüedad en los datos actuales')
    else {
      console.log(`    señal: "${flag.texto}" — ${flag.renglones} renglón/es, ${flag.alto}px, ${flag.fs}`)
      if (flag.renglones > 2) fallo(etiqueta, `la señal +60 días ocupa ${flag.renglones} renglones (máx. 2)`)
      else ok(`señal +60 días en ${flag.renglones} renglón/es`)
    }

    // ─────────────────────────────────────────────────────────────────────
    // 4. Superposición geométrica en la topbar
    // ─────────────────────────────────────────────────────────────────────
    const choques = await p.evaluate(() => {
      const piezas = [...document.querySelectorAll('.ta-topbar > *, .ta-topbar__actions > *')]
        .filter(e => e.offsetParent !== null)
        .map(e => ({ n: e.className || e.tagName, r: e.getBoundingClientRect() }))
        .filter(x => x.r.width > 0)
      const out = []
      for (let i = 0; i < piezas.length; i++) for (let j = i + 1; j < piezas.length; j++) {
        const a = piezas[i].r, b = piezas[j].r
        if (a.right > b.left + 2 && b.right > a.left + 2 && a.bottom > b.top + 2 && b.bottom > a.top + 2) {
          // ignorar contenedor/hijo
          if (a.left <= b.left && a.right >= b.right && a.top <= b.top && a.bottom >= b.bottom) continue
          if (b.left <= a.left && b.right >= a.right && b.top <= a.top && b.bottom >= a.bottom) continue
          out.push(`${String(piezas[i].n).split(' ')[0]} × ${String(piezas[j].n).split(' ')[0]}`)
        }
      }
      return out
    })
    if (choques.length) choques.forEach(c => fallo(etiqueta, `piezas de la topbar superpuestas: ${c}`))
    else ok('topbar sin superposiciones')

    // ─────────────────────────────────────────────────────────────────────
    // 5. El selector de tema no ocupa lugar permanente
    // ─────────────────────────────────────────────────────────────────────
    const selTema = await p.evaluate(() => {
      const enTopbar = document.querySelector('.ta-topbar .ta-theme-group')
      return {
        // Que el grupo EXISTA en el DOM es lo que hace válida la prueba: si el
        // selector estuviera mal escrito, "no visible" sería un falso PASS.
        existe: !!enTopbar,
        visible: !!(enTopbar && enTopbar.getBoundingClientRect().width > 0),
      }
    })
    if (!selTema.existe) fallo(etiqueta, 'no se encontró .ta-theme-group: la prueba del tema no es válida')
    else if (selTema.visible) fallo(etiqueta, 'el selector de tema sigue ocupando la topbar')
    else ok('selector de tema presente pero fuera de la topbar')

    // Y tiene que seguir siendo alcanzable desde el menú de usuario.
    await p.locator('.ta-topbar__burger').first().click()
    await p.waitForTimeout(400)
    await p.locator('.ta-userchip').first().click()
    await p.waitForTimeout(400)
    const temaEnMenu = await p.evaluate(() => {
      const e = document.querySelector('.ta-menu__tema .ta-theme-group')
      return !!(e && e.getBoundingClientRect().width > 0)
    })
    if (!temaEnMenu) fallo(etiqueta, 'el tema no es alcanzable desde el menú de usuario')
    else ok('tema alcanzable desde el menú de usuario')
    await p.keyboard.press('Escape'); await p.waitForTimeout(200)
    await p.keyboard.press('Escape'); await p.waitForTimeout(400)

    // ─────────────────────────────────────────────────────────────────────
    // 6. Filtros compactos
    // ─────────────────────────────────────────────────────────────────────
    const filtros = await p.evaluate(() => {
      const btn = document.querySelector('.ta-home__filtros-btn')
      const selects = [...document.querySelectorAll('.ta-home__filtros .ta-select')]
        .filter(e => e.offsetParent !== null)
      return {
        boton: btn && btn.offsetParent !== null ? Math.round(btn.getBoundingClientRect().height) : null,
        selectsVisibles: selects.length,
        altoBloque: (() => {
          const h = document.querySelector('.ta-home__head')
          return h ? Math.round(h.getBoundingClientRect().height) : null
        })(),
      }
    })
    if (filtros.selectsVisibles > 0) fallo(etiqueta, `${filtros.selectsVisibles} selects a la vista en mobile`)
    else if (!filtros.boton) fallo(etiqueta, 'no hay botón de Filtros en mobile')
    else ok(`filtros como botón de ${filtros.boton}px (encabezado: ${filtros.altoBloque}px)`)

    // ─────────────────────────────────────────────────────────────────────
    // 7. Acciones rápidas: densidad
    // ─────────────────────────────────────────────────────────────────────
    const qa = await p.evaluate(() => {
      const bs = [...document.querySelectorAll('.ta-qa__btn')]
      return {
        n: bs.length,
        altos: bs.map(b => Math.round(b.getBoundingClientRect().height)),
        bloque: (() => { const g = document.querySelector('.ta-qa'); return g ? Math.round(g.getBoundingClientRect().height) : 0 })(),
      }
    })
    const maxQA = Math.max(0, ...qa.altos)
    if (maxQA > 60) fallo(etiqueta, `acciones de ${maxQA}px de alto (objetivo ≤60)`)
    else if (maxQA < 40) fallo(etiqueta, `acciones de ${maxQA}px: blanco táctil chico`)
    else ok(`${qa.n} acciones de ${maxQA}px — bloque total ${qa.bloque}px`)

    // ─────────────────────────────────────────────────────────────────────
    // 8. ¿A qué altura aparece el Resumen?
    // ─────────────────────────────────────────────────────────────────────
    const resumen = await p.evaluate(() => {
      const e = document.querySelector('.ta-sum')
      if (!e) return null
      const top = e.getBoundingClientRect().top + window.scrollY
      return { top: Math.round(top), vh: window.innerHeight }
    })
    if (!resumen) fallo(etiqueta, 'no se encontró el Resumen')
    else {
      const pantallas = +(resumen.top / resumen.vh).toFixed(2)
      console.log(`    Resumen empieza a ${resumen.top}px = ${pantallas} pantallas`)
      if (pantallas > 1.6) fallo(etiqueta, `el Resumen aparece recién a ${pantallas} pantallas del top`)
      else ok(`Resumen a ${pantallas} pantallas del top`)
    }

    // ─────────────────────────────────────────────────────────────────────
    // 9. Blancos táctiles
    // ─────────────────────────────────────────────────────────────────────
    const chicos = await p.evaluate(() => {
      const out = []
      for (const e of document.querySelectorAll('button, a, select')) {
        if (e.offsetParent === null) continue
        const r = e.getBoundingClientRect()
        if (r.width === 0) continue
        if (r.height < 32) out.push({ n: (e.className || e.tagName).toString().split(' ')[0], h: Math.round(r.height) })
      }
      return out
    })
    if (chicos.length) chicos.forEach(x => aviso(etiqueta, `blanco táctil de ${x.h}px en .${x.n}`))
    else ok('todos los blancos táctiles ≥32px')

    // ─────────────────────────────────────────────────────────────────────
    // 10. Capturas
    // ─────────────────────────────────────────────────────────────────────
    const base = `${vp.nombre}_${tema}`
    await p.screenshot({ path: path.join(OUT, `${base}_top.png`) })
    await p.screenshot({ path: path.join(OUT, `${base}_full.png`), fullPage: true })

    // ─────────────────────────────────────────────────────────────────────
    // 11. Drawer (sólo una vez por viewport, en dark)
    // ─────────────────────────────────────────────────────────────────────
    if (tema === 'dark') {
      await p.locator('.ta-topbar__burger').first().click()
      await p.waitForTimeout(500)
      const d = await p.evaluate(() => {
        const sb = document.querySelector('.ta-sidebar')
        const tb = document.querySelector('.ta-topbar')
        const sc = document.querySelector('.ta-sidebar__scrim')
        if (!sb) return null
        const r = sb.getBoundingClientRect(), t = tb.getBoundingClientRect()
        const cs = getComputedStyle(sb)
        const zs = +getComputedStyle(sb).zIndex, zt = +getComputedStyle(tb).zIndex
        return {
          top: Math.round(r.top), alto: Math.round(r.height), ancho: Math.round(r.width),
          cubreTopbar: zs > zt,
          empiezaEnCero: Math.round(r.top) === 0,
          altoViewport: window.innerHeight,
          // offsetParent es null en position:fixed — hay que mirar el display.
          scrim: !!sc && getComputedStyle(sc).display !== 'none',
          cerrar: !!sb.querySelector('.ta-sidebar__close'),
          bodyLock: getComputedStyle(document.body).overflow === 'hidden',
          fondoSolido: !cs.backdropFilter || cs.backdropFilter === 'none',
          paddingTop: cs.paddingTop,
          items: [...sb.querySelectorAll('.ta-nav__item')].map(e => Math.round(e.getBoundingClientRect().height)),
          colapsado: document.querySelector('.ta-shell')?.classList.contains('is-collapsed') ?? false,
        }
      })
      if (!d) fallo(etiqueta, 'el drawer no abrió')
      else {
        if (!d.cubreTopbar) fallo(etiqueta, `el drawer queda debajo de la topbar (z ${d.ancho})`)
        if (!d.empiezaEnCero) aviso(etiqueta, `el drawer arranca en y=${d.top}`)
        if (d.alto < d.altoViewport - 2) fallo(etiqueta, `el drawer mide ${d.alto}px de ${d.altoViewport}px`)
        if (!d.scrim) fallo(etiqueta, 'no hay scrim bloqueando el fondo')
        if (!d.cerrar) fallo(etiqueta, 'el drawer no tiene botón de cierre visible')
        if (!d.bodyLock) fallo(etiqueta, 'el fondo sigue scrolleando con el drawer abierto')
        if (d.colapsado) fallo(etiqueta, 'el drawer hereda el estado colapsado de escritorio')
        const minItem = Math.min(...d.items)
        if (minItem < 40) aviso(etiqueta, `items de navegación de ${minItem}px`)
        ok(`drawer ${d.ancho}×${d.alto}px, padding-top ${d.paddingTop}, ${d.items.length} items de ${minItem}px+`)
        await p.screenshot({ path: path.join(OUT, `${base}_drawer.png`) })

        // Cierre por Escape
        await p.keyboard.press('Escape')
        await p.waitForTimeout(400)
        const cerrado = await p.evaluate(() => !document.querySelector('.ta-shell.is-drawer-open'))
        if (!cerrado) fallo(etiqueta, 'Escape no cierra el drawer')
        else ok('Escape cierra el drawer')

        // Cierre al navegar
        await p.locator('.ta-topbar__burger').first().click()
        await p.waitForTimeout(400)
        await p.locator('.ta-nav__item').nth(1).click()
        await p.waitForTimeout(700)
        const cerrado2 = await p.evaluate(() => !document.querySelector('.ta-shell.is-drawer-open'))
        if (!cerrado2) fallo(etiqueta, 'el drawer no se cierra al navegar')
        else ok('el drawer se cierra al navegar')
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 12. Hoja de filtros
    // ─────────────────────────────────────────────────────────────────────
    if (vp.nombre === '390x844') {
      await p.goto(BASE, { waitUntil: 'domcontentloaded' })
      await p.waitForSelector('.ta-home', { timeout: 20000 })
      await p.waitForTimeout(1200)
      await p.locator('.ta-home__filtros-btn').first().click()
      await p.waitForTimeout(600)
      const hoja = await p.evaluate(() => {
        const m = document.querySelector('.ta-modal')
        if (!m) return null
        const r = m.getBoundingClientRect()
        return {
          ancho: Math.round(r.width), alto: Math.round(r.height),
          desdeAbajo: Math.round(window.innerHeight - r.bottom),
          selects: m.querySelectorAll('select').length,
        }
      })
      if (!hoja) fallo(etiqueta, 'la hoja de filtros no abrió')
      else ok(`hoja de filtros ${hoja.ancho}×${hoja.alto}px con ${hoja.selects} selects`)
      await p.screenshot({ path: path.join(OUT, `${base}_filtros.png`) })
    }

    await c.close()
  }
}

await browser.close()

console.log('\n' + '═'.repeat(62))
if (errores.length) { console.log('ERRORES DE CONSOLA:'); [...new Set(errores)].forEach(e => console.log('  ' + e)) }
console.log(`FALLOS: ${fallos.length}   AVISOS: ${avisos.length}`)
fallos.forEach(f => console.log('  ✗ ' + f))
avisos.forEach(a => console.log('  ⚠ ' + a))
console.log('Capturas en ' + OUT)
process.exit(fallos.length ? 1 : 0)
