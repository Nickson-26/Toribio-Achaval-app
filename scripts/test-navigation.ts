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
  routeToPath, pathToRoute, rutasDeSeccion, navegacionPara, puedeAcceder,
  itemActivo, RUTAS, SECCIONES, DESTINOS,
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
  // Administración y Análisis quedan vacías para editor y viewer.
  assert.deepEqual(rutasDeSeccion('administracion', 'admin').map(r => r.id), ['usuarios'])
  assert.deepEqual(rutasDeSeccion('administracion', 'editor'), [])
  assert.deepEqual(rutasDeSeccion('administracion', 'viewer'), [])
  assert.deepEqual(rutasDeSeccion('analisis', 'admin').map(r => r.id), ['informe'])
  assert.deepEqual(rutasDeSeccion('analisis', 'editor'), [])

  // Principal es igual para los tres roles. "Documentos" (la ruta `nc`) vive
  // acá desde que NC y ND comparten pantalla: son los seis módulos juntos.
  const principal = rutasDeSeccion('principal', 'viewer').map(r => r.id)
  assert.deepEqual(principal, ['inicio', 'facturas', 'recibos', 'clientes', 'reservas', 'nc'])
  assert.deepEqual(rutasDeSeccion('principal', 'admin').map(r => r.id), principal)
})

test('DECISIÓN DE PRODUCTO: Reservas está en la navegación normal', () => {
  // Antes vivía fuera de la nav, detrás de un switcher de módulos, como si
  // fuera otra aplicación. TA App es UN workspace.
  assert.equal(RUTAS.reservas.enNav, true)
  assert.equal(RUTAS.reservas.seccion, 'principal')
  // Y es accesible para cualquier rol, igual que antes.
  assert.ok(rutasDeSeccion('principal', 'viewer').some(r => r.id === 'reservas'))
})

test('navegacionPara no devuelve grupos vacíos', () => {
  for (const role of ['admin', 'editor', 'viewer'] as const) {
    const grupos = navegacionPara(role)
    for (const g of grupos) {
      assert.ok(g.rutas.length > 0, `${role}: el grupo ${g.seccion.id} vino vacío`)
    }
  }
  // admin ve Principal, Análisis y Administración; el resto sólo Principal.
  // La sección "Documentos" quedó sin rutas —su única entrada se mudó a
  // Principal— y `navegacionPara` descarta los grupos vacíos.
  assert.equal(navegacionPara('admin').length, 3)
  assert.equal(navegacionPara('editor').length, 1)
  assert.equal(navegacionPara('viewer').length, 1)
  assert.equal(navegacionPara(null).length, 1)
  assert.ok(!navegacionPara('admin').some(g => g.seccion.id === 'documentos'),
    'una sección sin rutas no puede llegar a la sidebar')
})

test('DECISIÓN DE PRODUCTO: una sola entrada "Documentos" para NC y ND', () => {
  // El brief pedía una entrada visible con las dos clases adentro. Las rutas
  // se conservan por compatibilidad, pero sólo una tiene ítem propio.
  assert.equal(RUTAS.nc.label, 'Documentos')
  assert.equal(RUTAS.nc.enNav, true)
  assert.equal(RUTAS.nd.enNav, false, 'ND no puede tener su propio ítem')
  // Las dos rutas siguen existiendo y con su path de siempre.
  assert.equal(routeToPath({ to: 'nc' }), '/notas-credito')
  assert.equal(routeToPath({ to: 'nd' }), '/notas-debito')
  assert.deepEqual(pathToRoute('/notas-debito'), { to: 'nd' })
  // Y las dos resaltan la misma entrada.
  assert.equal(itemActivo('nc'), 'nc')
  assert.equal(itemActivo('nd'), 'nc', 'estando en ND se marca "Documentos"')
  // Las demás rutas se representan a sí mismas.
  for (const id of Object.keys(RUTAS)) {
    if (id === 'nd') continue
    assert.equal(itemActivo(id as any), id)
  }
})

test('ninguna ruta queda huérfana: o tiene ítem, o la representa otra', () => {
  const enGrupos = new Set(navegacionPara('admin').flatMap(g => g.rutas.map(r => r.id)))
  for (const id of Object.keys(RUTAS) as (keyof typeof RUTAS)[]) {
    const representante = itemActivo(id)
    assert.ok(
      enGrupos.has(representante),
      `la ruta ${id} no aparece en la sidebar ni delega en una que sí aparezca`,
    )
  }
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
