'use client'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import {
  AppRoute, RouteId, RUTAS, RUTA_INICIAL, SeccionId, SECCIONES,
  routeToPath, puedeAcceder,
} from '@/lib/navigation'
import { useAuth } from './AuthProvider'

/**
 * Implementación ACTUAL de la navegación: estado en memoria.
 *
 * Deliberadamente encapsulada. Cuando se migre a rutas reales de Next, se
 * reemplaza el cuerpo de este provider por `useRouter()` + `usePathname()` +
 * `pathToRoute()`, y NINGÚN componente consumidor cambia — todos hablan con
 * `useNavigation()`, no con `useState`.
 *
 * Lo que este provider garantiza y `setPage()` no garantizaba:
 *  · navegación tipada con parámetros (estado, tab, búsqueda);
 *  · chequeo de permisos en un solo lugar, antes de mover al usuario;
 *  · historial, para poder volver;
 *  · un único punto donde instrumentar analítica o confirmaciones.
 */

type NavigationCtx = {
  /** Destino actual, con sus parámetros. */
  route: AppRoute
  /** Sección actual — hoy gobierna el switcher del topnav. */
  seccion: SeccionId
  /** Ir a un destino. Si el rol no tiene permiso, no hace nada. */
  navigate: (route: AppRoute) => void
  /** Volver al destino anterior. */
  back: () => void
  puedeVolver: boolean
  /** Ir al inicio de una sección. */
  irASeccion: (s: SeccionId) => void
  /** URL equivalente al destino actual. Útil para deep-links y debugging. */
  path: string
}

const Ctx = createContext<NavigationCtx | null>(null)

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [route, setRoute] = useState<AppRoute>(RUTA_INICIAL)
  const [historial, setHistorial] = useState<AppRoute[]>([])

  const navigate = useCallback((destino: AppRoute) => {
    const def = RUTAS[destino.to as RouteId]
    if (!def) {
      console.warn(`[navigation] destino desconocido: ${String(destino.to)}`)
      return
    }
    // El permiso se valida acá, una sola vez, en lugar de en cada botón.
    // Nota: esto es defensa en profundidad de UI. El control real es RLS.
    if (!puedeAcceder(def, user?.role)) {
      console.warn(`[navigation] sin permiso para "${def.id}" con rol "${user?.role}"`)
      return
    }
    setHistorial(h => [...h.slice(-19), route])
    setRoute(destino)
  }, [route, user?.role])

  const back = useCallback(() => {
    setHistorial(h => {
      if (!h.length) return h
      setRoute(h[h.length - 1])
      return h.slice(0, -1)
    })
  }, [])

  const irASeccion = useCallback((s: SeccionId) => {
    const sec = SECCIONES.find(x => x.id === s)
    if (sec) navigate(sec.inicio)
  }, [navigate])

  const value = useMemo<NavigationCtx>(() => ({
    route,
    seccion: RUTAS[route.to as RouteId]?.seccion ?? 'facturacion',
    navigate,
    back,
    puedeVolver: historial.length > 0,
    irASeccion,
    path: routeToPath(route),
  }), [route, navigate, back, historial.length, irASeccion])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useNavigation(): NavigationCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useNavigation debe usarse dentro de <NavigationProvider>')
  return ctx
}

/**
 * Parámetros del destino actual, tipados, si coincide con `id`.
 *
 *   const params = useRouteParams('facturas')
 *   // params?.estado -> ComprobanteEstado[] | undefined
 *
 * Devuelve null si la ruta actual es otra. Permite que una pantalla lea los
 * filtros con los que la abrieron sin recibirlos por props desde page.tsx.
 */
export function useRouteParams<T extends RouteId>(
  id: T
): Extract<AppRoute, { to: T }> | null {
  const { route } = useNavigation()
  return route.to === id ? (route as Extract<AppRoute, { to: T }>) : null
}
