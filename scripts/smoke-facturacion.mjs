/**
 * Smoke test de FACTURACIÓN (Fase 3).
 *
 * Mide en navegador real lo que no se ve leyendo código, con el mismo criterio
 * que quedó de la Fase 2: no alcanza con que las cosas existan y no desborden.
 *
 * Cubre lo que hay que probar antes de tocar un iPhone:
 *   · escritorio y mobile como composiciones distintas;
 *   · los tres roles, con foco en que un viewer no vea escritura;
 *   · buscar, filtrar, limpiar filtros, abrir y cerrar detalle;
 *   · que la lista siga visible con el panel abierto;
 *   · que el formulario de cobro se abra desde ambas composiciones;
 *   · texto recortado elemento por elemento y blancos táctiles.
 *
 * Los selectores van por rol/aria-label donde se puede. Una clase mal escrita
 * ya nos dio un PASS falso (.ta-seg) y un FAIL falso (.ta-iconbtn); cuando la
 * prueba depende de que algo exista, primero se verifica que exista.
 *
 * Uso: node scripts/smoke-facturacion.mjs <baseUrl> <usuarios> <dirSalida>
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const [BASE, USERS_FILE, OUT] = process.argv.slice(2)
fs.mkdirSync(OUT, { recursive: true })
const users = fs.readFileSync(USERS_FILE, 'utf8').trim().split('\n')
  .map(l => l.split('|')).filter(p => p.length >= 4)
  .map(([rol, , email, pass]) => ({ rol, email, pass }))

const fallos = []
const avisos = []
const fallo = (ctx, m) => { fallos.push(`${ctx} — ${m}`); console.log(`  ✗ ${m}`) }
const aviso = (ctx, m) => { avisos.push(`${ctx} — ${m}`); console.log(`  ⚠ ${m}`) }
const ok = m => console.log(`  ✓ ${m}`)

const DESKTOP = { width: 1440, height: 900 }
const MOBILE  = { width: 390,  height: 844 }

async function abrirFacturacion(p, vp) {
  if (vp.width < 500) {
    await p.locator('.ta-topbar__burger').click()
    await p.waitForTimeout(500)
  }
  await p.locator('.ta-nav__item', { hasText: 'Facturación' }).first().click()
  await p.waitForSelector('.ta-mod', { timeout: 20000 })
  await p.waitForTimeout(1500)
}

/**
 * Una sola sesión por rol, reutilizada en todos los contextos.
 *
 * Antes cada combinación de rol y viewport hacía su propio login: ocho o más
 * por corrida, y con varias corridas seguidas Supabase empieza a limitar y el
 * test falla por algo que no tiene nada que ver con lo que está probando.
 */
const sesiones = new Map()

async function sesionDe(browser, u) {
  if (sesiones.has(u.rol)) return sesiones.get(u.rol)
  // Dos intentos: la primera carga contra un servidor recién levantado a veces
  // tarda lo suficiente como para que el login quede a mitad de camino, y un
  // timeout de arranque no es un hallazgo sobre la pantalla.
  for (let intento = 1; intento <= 2; intento++) {
    const ctx = await browser.newContext({ viewport: DESKTOP })
    const p = await ctx.newPage()
    try {
      await p.goto(BASE, { waitUntil: 'load' })
      await p.waitForSelector('input[type=email]', { timeout: 30000 })
      await p.waitForTimeout(800)
      await p.locator('input[type=email]').first().fill(u.email)
      await p.locator('input[type=password]').first().fill(u.pass)
      await p.locator('button[type=submit], .auth-submit').first().click()
      await p.waitForSelector('.ta-home', { timeout: 45000 })
      const estado = await ctx.storageState()
      await ctx.close()
      sesiones.set(u.rol, estado)
      return estado
    } catch (e) {
      const visto = await p.locator('body').innerText().catch(() => '')
      await ctx.close()
      if (intento === 2) {
        console.log(`  ! no se pudo entrar como ${u.rol}. En pantalla: ${visto.replace(/\s+/g, ' ').slice(0, 120)}`)
        throw e
      }
      await new Promise(r => setTimeout(r, 3000))
    }
  }
}

async function abrirApp(ctx) {
  const p = await ctx.newPage()
  await p.goto(BASE, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.ta-home', { timeout: 30000 })
  await p.waitForTimeout(1200)
  return p
}

const setTheme = (p, t) => p.evaluate(th => {
  localStorage.setItem('ta-theme', th)
  th === 'dark' ? document.documentElement.removeAttribute('data-theme')
                : document.documentElement.setAttribute('data-theme', th)
}, t)

const browser = await chromium.launch()
const errores = []

// Calentar el servidor: la primera petición contra un build recién hecho paga
// la carga de todos los chunks, y eso no es parte de lo que se está midiendo.
{
  const ctx = await browser.newContext({ viewport: DESKTOP })
  const p = await ctx.newPage()
  await p.goto(BASE, { waitUntil: 'load' }).catch(() => {})
  await p.waitForTimeout(2500)
  await ctx.close()
}

for (const u of users) {
  for (const [vp, tag] of [[DESKTOP, 'desktop'], [MOBILE, 'mobile']]) {
    const ctxName = `${u.rol} ${tag}`
    console.log(`\n═══ ${ctxName} ═══`)
    const ctx = await browser.newContext({
      viewport: vp, deviceScaleFactor: 2,
      isMobile: vp.width < 500, hasTouch: vp.width < 500,
      storageState: await sesionDe(browser, u),
    })
    const p = await abrirApp(ctx)
    p.on('pageerror', e => errores.push(`${ctxName}: ${String(e).slice(0, 150)}`))
    p.on('console', m => { if (m.type() === 'error') errores.push(`${ctxName}: ${m.text().slice(0, 150)}`) })
    await abrirFacturacion(p, vp)

    // ── 1. Sin desborde horizontal ────────────────────────────────────────
    const over = await p.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (over > 1) fallo(ctxName, `la página desborda ${over}px`)
    else ok('sin scroll horizontal')

    // ── 2. Composición correcta para el ancho ─────────────────────────────
    const comp = await p.evaluate(() => {
      const vis = s => {
        const e = document.querySelector(s)
        return !!(e && e.getBoundingClientRect().width > 0)
      }
      return {
        tabla: vis('.ta-tabla'),
        items: document.querySelectorAll('.ta-mov').length,
        filas: document.querySelectorAll('.ta-fila').length,
        toolbarAlto: Math.round(document.querySelector('.ta-barra')?.getBoundingClientRect().height ?? 0),
        tabs: [...document.querySelectorAll('.ta-vista')].map(e => e.textContent.trim()),
        senales: [...document.querySelectorAll('.ta-senal__titulo')].map(e => e.textContent),
        hoy: document.querySelector('.ta-hoy')?.textContent?.replace(/\s+/g, ' ') ?? null,
        // El listado es para consultar: ningún botón operativo adentro.
        ctasEnFilas: document.querySelectorAll('.ta-mov button').length,
      }
    })
    if (tag === 'desktop') {
      if (!comp.tabla) fallo(ctxName, 'no hay tabla en escritorio')
      else ok(`tabla con ${comp.filas} filas renderizadas`)
      if (comp.items > 0) fallo(ctxName, 'se renderiza la lista mobile en escritorio')
    } else {
      if (comp.tabla) fallo(ctxName, 'la tabla sigue montada en mobile')
      else if (!comp.items) fallo(ctxName, 'no hay lista en mobile')
      else ok(`${comp.items} filas de lista, sin tabla`)
      if (comp.toolbarAlto > 110) fallo(ctxName, `la toolbar mide ${comp.toolbarAlto}px en mobile`)
      else ok(`toolbar de ${comp.toolbarAlto}px`)
    }
    if (comp.ctasEnFilas > 0) {
      fallo(ctxName, `${comp.ctasEnFilas} botones operativos dentro de las filas del listado`)
    }
    console.log(`    vistas: ${comp.tabs.join(' · ')}`)
    console.log(`    hoy: ${comp.hoy}`)
    console.log(`    señales: ${comp.senales.join(' · ') || '(ninguna)'}`)

    // ── 3. Texto recortado ────────────────────────────────────────────────
    const recortes = await p.evaluate(() => {
      const sel = [
        '.ta-vista', '.ta-hoy', '.ta-resolver__titulo',
        '.ta-senal__titulo', '.ta-senal__monto',
        '.ta-mov__monto', '.ta-pcab__monto',
        '.ta-fila__n', '.ta-fila__total', '.ta-barra__chip',
        // Los badges también se recortan, y un estado a medias ("Faltan
        // retencione") es peor que no mostrarlo.
        '.ta-badge', '.ta-status',
      ].join(',')
      const out = []
      for (const e of document.querySelectorAll(sel)) {
        if (getComputedStyle(e).textOverflow === 'ellipsis') continue
        const d = e.scrollWidth - e.clientWidth
        if (d > 2) out.push({ cls: String(e.className).split(' ')[0], d, txt: e.textContent.trim().slice(0, 40) })
      }
      return out
    })
    recortes.forEach(r => fallo(ctxName, `texto recortado ${r.d}px en .${r.cls}: "${r.txt}"`))
    if (!recortes.length) ok('ningún texto recortado')

    // ── 4. Permisos: qué acciones ve este rol ─────────────────────────────
    const escritura = await p.evaluate(() => {
      const txt = [...document.querySelectorAll('button, label.ta-btn')]
        .filter(b => b.getBoundingClientRect().width > 0)
        .map(b => (b.textContent || '').trim().toLowerCase())
      const busca = re => txt.filter(t => re.test(t))
      return {
        nuevaFactura: busca(/nueva factura/).length,
        ctaTarjetas: document.querySelectorAll('.ta-mov button').length,
        // El CTA de la topbar también tiene que respetar el rol.
        ctaTopbar: !!document.querySelector('.ta-topbar__cta-icon, .ta-topbar .ta-btn--primary'),
      }
    })
    if (u.rol === 'viewer') {
      const altas = escritura.nuevaFactura +
        (await p.locator('.ta-barra__nueva').count())
      if (altas > 0) fallo(ctxName, `el viewer ve ${altas} accesos al alta de facturas`)
      if (escritura.ctaTopbar) fallo(ctxName, 'el viewer ve el CTA de alta en la topbar')
      if (!altas && !escritura.ctaTopbar) ok('el viewer no ve ninguna acción de escritura')
    } else {
      const puedeCrear = escritura.nuevaFactura > 0 || await p.locator('.ta-barra__nueva').count() > 0
      if (!puedeCrear) fallo(ctxName, `${u.rol} no tiene forma de crear una factura`)
      else ok(`${u.rol} puede crear una factura`)
    }

    // ── 5. Búsqueda local ─────────────────────────────────────────────────
    const antes = await p.evaluate(() =>
      document.querySelectorAll('.ta-fila, .ta-fcard').length)
    await p.locator('input[type=search]').first().fill('zzzzzznoexiste')
    await p.waitForTimeout(600)
    const vacio = await p.evaluate(() => ({
      items: document.querySelectorAll('.ta-fila, .ta-fcard').length,
      estadoVacio: !!document.querySelector('.ta-state'),
    }))
    if (vacio.items > 0) fallo(ctxName, 'la búsqueda sin resultados sigue mostrando filas')
    else if (!vacio.estadoVacio) fallo(ctxName, 'sin resultados no aparece el estado vacío')
    else ok('búsqueda sin resultados muestra estado vacío')

    await p.locator('input[type=search]').first().fill('')
    await p.waitForTimeout(600)
    const despues = await p.evaluate(() =>
      document.querySelectorAll('.ta-fila, .ta-fcard').length)
    if (despues !== antes) fallo(ctxName, `limpiar la búsqueda no restaura (${antes} -> ${despues})`)
    else ok(`la búsqueda es local y reversible (${antes} items)`)

    // ── 6. Filtros y chips removibles ─────────────────────────────────────
    await p.locator('.ta-barra__filtros').click()
    await p.waitForTimeout(500)
    const hoja = await p.evaluate(() => ({
      abierta: !!document.querySelector('.ta-modal'),
      estados: document.querySelectorAll('.ta-hojaf__estado').length,
      // Nunca snake_case delante del usuario.
      crudo: (document.querySelector('.ta-modal')?.textContent || '').match(/[a-z]+_[a-z]+/)?.[0] ?? null,
    }))
    if (!hoja.abierta) fallo(ctxName, 'la hoja de filtros no abre')
    else if (hoja.crudo) fallo(ctxName, `snake_case visible en filtros: "${hoja.crudo}"`)
    else ok(`hoja de filtros con ${hoja.estados} estados`)

    if (hoja.estados > 0) {
      await p.locator('.ta-hojaf__estado').first().click()
      await p.waitForTimeout(300)
      await p.locator('.ta-modal button', { hasText: /Ver resultados/ }).first().click()
      await p.waitForTimeout(700)
      const chips = await p.evaluate(() =>
        [...document.querySelectorAll('.ta-barra__chip')].map(e => e.textContent.trim()))
      if (!chips.length) fallo(ctxName, 'el filtro aplicado no aparece como chip')
      else {
        ok(`filtro activo visible como chip: "${chips[0]}"`)
        await p.locator('.ta-barra__chip').first().click()
        await p.waitForTimeout(600)
        const quedan = await p.evaluate(() => document.querySelectorAll('.ta-barra__chip').length)
        if (quedan >= chips.length) fallo(ctxName, 'el chip no se puede quitar')
        else ok('el chip se quita al tocarlo')
      }
    }

    await p.screenshot({ path: path.join(OUT, `${u.rol}_${tag}_lista.png`) })

    // ── 7. Detalle ────────────────────────────────────────────────────────
    const primer = tag === 'desktop' ? '.ta-fila' : '.ta-mov'
    await p.locator(primer).first().click()
    await p.waitForTimeout(800)
    const panel = await p.evaluate(() => {
      const pn = document.querySelector('.ta-panel')
      if (!pn) return null
      const r = pn.getBoundingClientRect()
      const lista = document.querySelector('.ta-tabla, .ta-movs')
      const lr = lista?.getBoundingClientRect()
      return {
        ancho: Math.round(r.width),
        // ¿La lista sigue visible al lado, o el panel la tapa?
        listaVisible: !!lr && lr.width > 0 && lr.right <= r.left + 1,
        seleccionada: !!document.querySelector('.ta-fila.is-sel'),
        cerrar: !!document.querySelector('[aria-label="Cerrar detalle"]'),
        acciones: [...(pn.querySelector('.ta-panel__foot')?.querySelectorAll('button') ?? [])]
          .map(b => b.textContent.trim() || b.getAttribute('aria-label')),
        // Progressive disclosure: el detalle contable arranca plegado.
        contablePlegado: !!pn.querySelector('.ta-mas') && !pn.querySelector('.ta-mas[open]'),
        crudo: (pn.textContent || '').match(/\b[a-z]+_[a-z]+\b/)?.[0] ?? null,
      }
    })
    if (!panel) fallo(ctxName, 'el detalle no abre')
    else {
      if (panel.crudo) fallo(ctxName, `snake_case en el detalle: "${panel.crudo}"`)
      if (!panel.cerrar) fallo(ctxName, 'el detalle no tiene botón de cierre')
      if (tag === 'desktop') {
        if (!panel.listaVisible) fallo(ctxName, 'el panel tapa la lista en escritorio')
        else ok(`panel de ${panel.ancho}px con la lista visible al lado`)
        if (!panel.seleccionada) fallo(ctxName, 'la fila abierta no queda resaltada')
        else ok('la fila abierta queda resaltada')
      } else {
        ok(`hoja de detalle de ${panel.ancho}px`)
      }
      console.log(`    acciones del panel: ${panel.acciones.join(' · ') || '(ninguna)'}`)
      if (!panel.contablePlegado) fallo(ctxName, 'el detalle contable no arranca plegado')
      // Una sola acción primaria: el resto vive en el menú.
      const primarias = panel.acciones.filter(a => a && !/más acciones/i.test(a))
      if (primarias.length > 1) {
        fallo(ctxName, `${primarias.length} acciones compiten en el pie: ${primarias.join(', ')}`)
      }
      if (u.rol === 'viewer' && panel.acciones.length > 0) {
        fallo(ctxName, `el viewer ve acciones en el detalle: ${panel.acciones.join(', ')}`)
      }
      await p.screenshot({ path: path.join(OUT, `${u.rol}_${tag}_detalle.png`) })
    }

    // ── 8. Registrar cobro se abre y se cancela sin escribir nada ─────────
    if (u.rol !== 'viewer') {
      // Buscar una factura que de verdad tenga el paso de cobro disponible.
      // Tomar la primera de la lista es una lotería: si está cobrada, el
      // formulario nunca se ejercita y el test pasa sin haber probado nada.
      let cobrar = p.locator('.ta-panel__foot button', { hasText: /cobro|acreditación/i }).first()
      if (!await cobrar.count()) {
        const items = tag === 'desktop' ? '.ta-fila' : '.ta-mov'
        const n = Math.min(await p.locator(items).count(), 25)
        for (let i = 1; i < n; i++) {
          // En mobile la hoja tapa la lista —que es lo correcto—, así que hay
          // que cerrarla antes de tocar la siguiente tarjeta.
          const cerrar = p.locator('[aria-label="Cerrar detalle"]').first()
          if (await cerrar.count()) { await cerrar.click(); await p.waitForTimeout(350) }
          await p.locator(items).nth(i).click()
          await p.waitForTimeout(500)
          cobrar = p.locator('.ta-panel__foot button', { hasText: /cobro|acreditación/i }).first()
          if (await cobrar.count()) break
        }
      }
      if (await cobrar.count()) {
        await cobrar.click()
        await p.waitForTimeout(1200)
        const form = await p.evaluate(() => {
          const m = document.querySelector('.ta-modal, .modal')
          return m ? { titulo: m.querySelector('.ta-modal__title, .modal-title')?.textContent ?? '', campos: m.querySelectorAll('input, select').length } : null
        })
        if (!form) fallo(ctxName, 'el formulario de cobro no abrió')
        else ok(`formulario de cobro: "${form.titulo}" con ${form.campos} campos`)
        await p.screenshot({ path: path.join(OUT, `${u.rol}_${tag}_cobro.png`) })
        await p.keyboard.press('Escape')
        await p.waitForTimeout(500)
      } else {
        aviso(ctxName, 'la primera factura del tab no tiene acción de cobro')
      }
    }

    // ── 9. Cerrar el detalle ──────────────────────────────────────────────
    const btnCerrar = p.locator('[aria-label="Cerrar detalle"]').first()
    if (await btnCerrar.count()) {
      await btnCerrar.click()
      await p.waitForTimeout(500)
      const cerrado = await p.evaluate(() => !document.querySelector('.ta-panel'))
      if (!cerrado) fallo(ctxName, 'el detalle no se cierra')
      else ok('el detalle se cierra')
    }

    // ── 10. Blancos táctiles en mobile ────────────────────────────────────
    if (tag === 'mobile') {
      const chicos = await p.evaluate(() => {
        const out = []
        for (const e of document.querySelectorAll('.ta-mod button, .ta-mod a')) {
          const r = e.getBoundingClientRect()
          if (r.width === 0) continue
          if (r.height < 32) out.push({ n: String(e.className).split(' ')[0], h: Math.round(r.height) })
        }
        return out
      })
      chicos.forEach(c => aviso(ctxName, `blanco táctil de ${c.h}px en .${c.n}`))
      if (!chicos.length) ok('blancos táctiles ≥32px')
    }

    await ctx.close()
  }
}

// ── Temas ─────────────────────────────────────────────────────────────────
console.log('\n═══ TEMAS (admin, escritorio) ═══')
{
  const u = users[0]
  for (const tema of ['dark', 'light', 'accessible']) {
    const ctx = await browser.newContext({
      viewport: DESKTOP, deviceScaleFactor: 2,
      storageState: await sesionDe(browser, u),
    })
    const p = await abrirApp(ctx)
    await setTheme(p, tema)
    await p.waitForTimeout(400)
    await abrirFacturacion(p, DESKTOP)
    const r = await p.evaluate(() => ({
      tema: document.documentElement.getAttribute('data-theme') ?? 'dark',
      filas: document.querySelectorAll('.ta-fila').length,
      // Un fondo transparente en un tema es un token faltante.
      fondoTabla: getComputedStyle(document.querySelector('.ta-tabla-wrap')).backgroundColor,
    }))
    if (r.filas === 0) fallo(`tema ${tema}`, 'la tabla quedó vacía')
    else if (/rgba\(0, 0, 0, 0\)/.test(r.fondoTabla)) fallo(`tema ${tema}`, 'la tabla no tiene fondo')
    else ok(`${r.tema}: ${r.filas} filas, fondo ${r.fondoTabla}`)
    await p.screenshot({ path: path.join(OUT, `tema_${tema}.png`) })
    await ctx.close()
  }
}

await browser.close()

console.log('\n' + '═'.repeat(64))
if (errores.length) {
  console.log('ERRORES DE CONSOLA:')
  ;[...new Set(errores)].forEach(e => console.log('  ' + e))
}
console.log(`FALLOS: ${fallos.length}   AVISOS: ${avisos.length}`)
fallos.forEach(f => console.log('  ✗ ' + f))
avisos.forEach(a => console.log('  ⚠ ' + a))
console.log(`Capturas en ${OUT}`)
process.exit(fallos.length ? 1 : 0)
