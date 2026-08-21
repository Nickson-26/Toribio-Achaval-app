/**
 * Pruebas de la capa de navegación.
 *
 * Lo importante que se verifica acá es el ida y vuelta
 *   AppRoute  ->  path  ->  AppRoute
 * porque ESA es la costura de la que depende la futura migración a rutas
 * reales de Next. Si el round-trip se mantiene, migrar el provider a
 * useRouter()/usePathname() no obliga a tocar ningún componente.
 *
 * Correr: npm test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  routeToPath, pathToRoute, rutasDeSeccion, puedeAcceder,
  RUTAS, SECCIONES, DESTINOS,
  type AppRoute,
} from '../src/lib/navigation.ts'

// ── Serialización ────────────────────────────────────────────────────────────
test('routeToPath serializa destinos simples', () => {
  assert.equal(routeToPath({ to: 'inicio' }), '/')
  assert.equal(routeToPath({ to: 'facturas' }), '/facturas')
  assert.equal(routeToPath({ to: 'nc' }), '/notas-credito')
  assert.equal(routeToPath({ to: 'usuarios' }), '/usuarios')
})

test('routeToPath serializa los parámetros de facturas', () => {
  assert.equal(
    routeToPath({ to: 'facturas', estado: ['pendiente'] }),
    '/facturas?estado=pendiente'
  )
  assert.equal(
    routeToPath({ to: 'facturas', estado: ['pendiente', 'faltan_retenciones'] }),
    '/facturas?estado=pendiente%2Cfaltan_retenciones'
  )
  assert.equal(
    routeToPath({ to: 'facturas', tab: 'FACT B', buscar: 'acme' }),
    '/facturas?tab=FACT+B&q=acme'
  )
})

test('CLAVE: el round-trip route -> path -> route se preserva', () => {
  const casos: AppRoute[] = [
    { to: 'inicio' },
    { to: 'facturas' },
    { to: 'facturas', estado: ['pendiente'] },
    { to: 'facturas', estado: ['pendiente', 'faltan_retenciones', 'echeq_pendiente'] },
    { to: 'facturas', tab: 'FACT DE CREDITO' },
    { to: 'facturas', estado: ['cobrada'], tab: 'FACT A', buscar: 'constructora sur' },
    { to: 'recibos' },
    { to: 'recibos', buscar: 'acme s.a.' },
    { to: 'clientes', buscar: 'río negro' },
    { to: 'nc' }, { to: 'nd' }, { to: 'reservas' },
    { to: 'informe' }, { to: 'usuarios' },
  ]
  for (const r of casos) {
    assert.deepEqual(pathToRoute(routeToPath(r)), r, `falló el round-trip de ${JSON.stringify(r)}`)
  }
})

test('pathToRoute devuelve null para paths desconocidos', () => {
  assert.equal(pathToRoute('/no-existe'), null)
  assert.equal(pathToRoute('/facturas/algo/mas'), null)
})

test('pathToRoute tolera la barra final', () => {
  assert.deepEqual(pathToRoute('/facturas/'), { to: 'facturas' })
  assert.deepEqual(pathToRoute('/'), { to: 'inicio' })
})

// ── Permisos ─────────────────────────────────────────────────────────────────
test('las rutas sin roles declarados son accesibles para todos', () => {
  assert.ok(puedeAcceder(RUTAS.facturas, 'viewer'))
  assert.ok(puedeAcceder(RUTAS.facturas, 'editor'))
  assert.ok(puedeAcceder(RUTAS.facturas, 'admin'))
})

test('informe y usuarios son sólo para admin', () => {
  for (const r of [RUTAS.informe, RUTAS.usuarios]) {
    assert.ok(puedeAcceder(r, 'admin'), `${r.id} debería permitir admin`)
    assert.ok(!puedeAcceder(r, 'editor'), `${r.id} NO debería permitir editor`)
    assert.ok(!puedeAcceder(r, 'viewer'), `${r.id} NO debería permitir viewer`)
  }
})

test('sin rol no se accede a rutas restringidas', () => {
  assert.ok(!puedeAcceder(RUTAS.usuarios, null))
  assert.ok(!puedeAcceder(RUTAS.usuarios, undefined))
})

test('rutasDeSeccion filtra por rol', () => {
  const admin  = rutasDeSeccion('facturacion', 'admin').map(r => r.id)
  const editor = rutasDeSeccion('facturacion', 'editor').map(r => r.id)

  assert.ok(admin.includes('usuarios'))
  assert.ok(admin.includes('informe'))
  assert.ok(!editor.includes('usuarios'))
  assert.ok(!editor.includes('informe'))
  assert.ok(editor.includes('facturas'))
  assert.equal(admin.length, editor.length + 2)
})

// ── Consistencia del registro ────────────────────────────────────────────────
test('toda ruta tiene un path único', () => {
  const paths = Object.keys(RUTAS).map(id => routeToPath({ to: id } as AppRoute))
  assert.equal(new Set(paths).size, paths.length, 'hay paths duplicados')
})

test('toda ruta pertenece a una sección declarada', () => {
  const ids = new Set(SECCIONES.map(s => s.id))
  for (const r of Object.values(RUTAS)) {
    assert.ok(ids.has(r.seccion), `${r.id} apunta a una sección inexistente: ${r.seccion}`)
  }
})

test('el inicio de cada sección es una ruta real', () => {
  for (const s of SECCIONES) {
    assert.ok(RUTAS[s.inicio.to], `la sección ${s.id} arranca en un destino inexistente`)
  }
})

// ── Destinos con nombre ──────────────────────────────────────────────────────
test('DESTINOS produce rutas válidas y filtradas', () => {
  assert.deepEqual(DESTINOS.facturasPendientes(), { to: 'facturas', estado: ['pendiente'] })
  assert.deepEqual(DESTINOS.facturasFaltanRetenciones(), { to: 'facturas', estado: ['faltan_retenciones'] })
  assert.deepEqual(DESTINOS.buscarCliente('acme'), { to: 'clientes', buscar: 'acme' })

  const porCobrar = DESTINOS.facturasPorCobrar()
  assert.equal(porCobrar.to, 'facturas')
  assert.deepEqual(
    (porCobrar as any).estado,
    ['pendiente', 'faltan_retenciones', 'echeq_pendiente']
  )
  // Y sobrevive al round-trip, que es lo que importa para el deep-link.
  assert.deepEqual(pathToRoute(routeToPath(porCobrar)), porCobrar)
})
