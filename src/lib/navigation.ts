import type { ComprobanteEstado } from './supabase'
import type { UserRole } from './auth'

/**
 * CAPA DE NAVEGACIÓN TIPADA
 * =========================
 *
 * Por qué existe
 * --------------
 * `src/app/page.tsx` era shell + nav + router + theme + menú de usuario en un
 * solo archivo, y navegar era llamar a `setPage('facturas')` desde donde fuera.
 * Eso hace imposible que una alerta del Home abra "facturas filtradas por
 * pendiente", y acopla cada componente al estado interno de page.tsx.
 *
 * Este módulo define el CONTRATO de navegación. Los componentes declaran a
 * dónde quieren ir y con qué parámetros; no saben cómo se implementa el
 * traslado.
 *
 * Migración futura a rutas reales de Next
 * ---------------------------------------
 * Hoy `NavigationProvider` resuelve el destino con `useState`. Cuando se migre
 * a App Router, se reemplaza SOLO la implementación del provider por
 * `useRouter()` + `usePathname()`, y se usan `routeToPath()` / `pathToRoute()`
 * —que ya existen y están testeados— para serializar.
 *
 * Ningún componente que llame a `navigate(...)` necesita cambiar.
 * Ese es el objetivo del diseño: la costura ya está puesta.
 */

// ── Destinos ────────────────────────────────────────────────────────────────

export type RouteId =
  | 'inicio'
  | 'facturas'
  | 'recibos'
  | 'clientes'
  | 'nc'
  | 'nd'
  | 'reservas'
  | 'informe'
  | 'usuarios'

/** Pestañas del listado de facturas (tipos de comprobante). */
export type FacturaTab = 'FACT A' | 'FACT B' | 'FACT DE CREDITO' | 'FACT E'

/**
 * Un destino con sus parámetros. Unión discriminada: el compilador exige que
 * los parámetros correspondan al destino.
 *
 *   navigate({ to: 'facturas', estado: ['pendiente'] })   ✓
 *   navigate({ to: 'recibos',  estado: ['pendiente'] })   ✗ error de tipo
 */
export type AppRoute =
  | { to: 'inicio' }
  | { to: 'facturas'; estado?: ComprobanteEstado[]; tab?: FacturaTab; buscar?: string }
  | { to: 'recibos';  buscar?: string }
  | { to: 'clientes'; buscar?: string }
  | { to: 'nc' }
  | { to: 'nd' }
  | { to: 'reservas' }
  | { to: 'informe' }
  | { to: 'usuarios' }

export const RUTA_INICIAL: AppRoute = { to: 'inicio' }

// ── Registro ────────────────────────────────────────────────────────────────

/**
 * Secciones del producto. Hoy gobiernan el switcher de módulos del topnav;
 * en el rediseño serán los grupos de la sidebar.
 */
export type SeccionId = 'facturacion' | 'reservas'

export type SeccionDef = {
  id: SeccionId
  label: string
  /** A dónde va el usuario al entrar a la sección. */
  inicio: AppRoute
  /** Acento del módulo. Pasará a ser un design token en la Fase 1. */
  accent: string
}

export const SECCIONES: SeccionDef[] = [
  { id: 'facturacion', label: 'Facturación', inicio: { to: 'inicio' },    accent: '#C8102E' },
  { id: 'reservas',    label: 'Reservas',    inicio: { to: 'reservas' },  accent: '#1a6bc8' },
]

export type RouteDef = {
  id: RouteId
  /** Texto en la navegación. */
  label: string
  /** Título de la pantalla. */
  titulo: string
  seccion: SeccionId
  /** Roles con acceso. `undefined` = cualquier usuario aprobado. */
  roles?: UserRole[]
  /** Si es false, no aparece en la navegación (accesible sólo por navigate). */
  enNav: boolean
  /** Nombre del icono de lucide-react. Se conecta en la Fase 1. */
  icono: string
}

/**
 * FUENTE ÚNICA DE VERDAD de la navegación.
 *
 * Antes esto vivía repartido en 5 lugares de page.tsx que había que mantener
 * sincronizados a mano: NAV_FACTURACION, COMPONENTS, TITLES, el switcher de
 * módulos y el dropdown mobile.
 */
export const RUTAS: Record<RouteId, RouteDef> = {
  inicio:   { id: 'inicio',   label: 'Dashboard',        titulo: 'Dashboard',            seccion: 'facturacion', enNav: true, icono: 'LayoutDashboard' },
  facturas: { id: 'facturas', label: 'Facturas',         titulo: 'Facturas',             seccion: 'facturacion', enNav: true, icono: 'FileText' },
  recibos:  { id: 'recibos',  label: 'Recibos',          titulo: 'Recibos',              seccion: 'facturacion', enNav: true, icono: 'Receipt' },
  clientes: { id: 'clientes', label: 'Clientes',         titulo: 'Clientes',             seccion: 'facturacion', enNav: true, icono: 'Users' },
  nc:       { id: 'nc',       label: 'Notas de Crédito', titulo: 'Notas de Crédito',     seccion: 'facturacion', enNav: true, icono: 'FileMinus' },
  nd:       { id: 'nd',       label: 'Notas de Débito',  titulo: 'Notas de Débito',      seccion: 'facturacion', enNav: true, icono: 'FilePlus' },
  informe:  { id: 'informe',  label: '↓ Informe PDF',    titulo: 'Informe Financiero',   seccion: 'facturacion', enNav: true, icono: 'FileBarChart', roles: ['admin'] },
  usuarios: { id: 'usuarios', label: 'Usuarios',         titulo: 'Gestión de Usuarios',  seccion: 'facturacion', enNav: true, icono: 'UserCog',      roles: ['admin'] },
  reservas: { id: 'reservas', label: 'Reservas',         titulo: 'Reservas',             seccion: 'reservas',    enNav: false, icono: 'Home' },
}

// ── Permisos ────────────────────────────────────────────────────────────────

/** ¿Este rol puede entrar a esta ruta? */
export function puedeAcceder(ruta: RouteDef, role: UserRole | null | undefined): boolean {
  if (!ruta.roles) return true
  if (!role) return false
  return ruta.roles.includes(role)
}

/** Rutas visibles en la navegación de una sección, filtradas por rol. */
export function rutasDeSeccion(seccion: SeccionId, role: UserRole | null | undefined): RouteDef[] {
  return Object.values(RUTAS).filter(r => r.seccion === seccion && r.enNav && puedeAcceder(r, role))
}

// ── Serialización — la costura para migrar a rutas reales ───────────────────

const PATHS: Record<RouteId, string> = {
  inicio:   '/',
  facturas: '/facturas',
  recibos:  '/recibos',
  clientes: '/clientes',
  nc:       '/notas-credito',
  nd:       '/notas-debito',
  reservas: '/reservas',
  informe:  '/informe',
  usuarios: '/usuarios',
}

/**
 * Serializa un destino a una URL.
 *
 * Hoy sólo se usa para deep-links y para el futuro command palette. Cuando se
 * migre a App Router, pasa a ser el argumento de `router.push()`.
 */
export function routeToPath(route: AppRoute): string {
  const base = PATHS[route.to]
  const qs = new URLSearchParams()

  if (route.to === 'facturas') {
    if (route.estado?.length) qs.set('estado', route.estado.join(','))
    if (route.tab)            qs.set('tab', route.tab)
    if (route.buscar)         qs.set('q', route.buscar)
  } else if (route.to === 'recibos' || route.to === 'clientes') {
    if (route.buscar)         qs.set('q', route.buscar)
  }

  const s = qs.toString()
  return s ? `${base}?${s}` : base
}

const POR_PATH = Object.fromEntries(
  Object.entries(PATHS).map(([id, p]) => [p, id as RouteId])
) as Record<string, RouteId>

/**
 * Inversa de `routeToPath`. Devuelve null si el path no corresponde a ninguna
 * ruta conocida.
 */
export function pathToRoute(path: string): AppRoute | null {
  const [base, query] = path.split('?')
  const limpio = base.length > 1 ? base.replace(/\/$/, '') : base
  const id = POR_PATH[limpio]
  if (!id) return null

  const qs = new URLSearchParams(query || '')

  if (id === 'facturas') {
    const estado = qs.get('estado')
    const tab = qs.get('tab')
    const buscar = qs.get('q')
    return {
      to: 'facturas',
      ...(estado ? { estado: estado.split(',') as ComprobanteEstado[] } : {}),
      ...(tab ? { tab: tab as FacturaTab } : {}),
      ...(buscar ? { buscar } : {}),
    }
  }
  if (id === 'recibos' || id === 'clientes') {
    const buscar = qs.get('q')
    return { to: id, ...(buscar ? { buscar } : {}) }
  }
  return { to: id } as AppRoute
}

// ── Atajos de uso frecuente ─────────────────────────────────────────────────

/**
 * Destinos con nombre, para que las alertas del Home y las acciones rápidas no
 * tengan que construir el objeto a mano. Crece a medida que aparecen casos.
 */
export const DESTINOS = {
  facturasPendientes: (): AppRoute => ({ to: 'facturas', estado: ['pendiente'] }),
  facturasFaltanRetenciones: (): AppRoute => ({ to: 'facturas', estado: ['faltan_retenciones'] }),
  facturasEcheqPendiente: (): AppRoute => ({ to: 'facturas', estado: ['echeq_pendiente'] }),
  facturasPorCobrar: (): AppRoute => ({
    to: 'facturas',
    estado: ['pendiente', 'faltan_retenciones', 'echeq_pendiente'],
  }),
  buscarCliente: (q: string): AppRoute => ({ to: 'clientes', buscar: q }),
} as const
