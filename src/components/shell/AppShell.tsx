'use client'
import { useEffect, useState } from 'react'
import { useNavigation } from '@/components/NavigationProvider'
import { CambiarPasswordModal } from '@/components/CambiarPassword'
import { ToastProvider } from '@/design/primitives'
import { SCREENS } from '@/lib/screens'
import { Sidebar } from './Sidebar'
import { Topbar, type Theme } from './Topbar'

const COLLAPSE_KEY = 'ta-sidebar-collapsed'

/**
 * AppShell — el chrome del producto.
 *
 * Reemplaza al `page.tsx` que era shell + nav + router + tema + menú de
 * usuario en un solo archivo. Acá sólo se orquesta: la navegación viene de
 * `useNavigation()` (Fase 0), los ítems de `RUTAS`, y la pantalla del destino
 * actual de `SCREENS`.
 *
 * Las 11 pantallas se montan sin modificar. Van a verse con el layout viejo
 * dentro del shell nuevo, y eso es lo esperado en la Fase 1: la calidad se
 * construye por capas.
 */
export function AppShell({ theme, onTheme }: { theme: Theme; onTheme: (t: Theme) => void }) {
  const { route } = useNavigation()
  const [pendientes, setPendientes] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    try { if (localStorage.getItem(COLLAPSE_KEY) === '1') setCollapsed(true) } catch { /* noop */ }
  }, [])

  function toggleCollapse() {
    setCollapsed(v => {
      const next = !v
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0') } catch { /* noop */ }
      return next
    })
  }

  // Cerrar el cajón al navegar o al pasar a ancho de escritorio
  useEffect(() => { setDrawerOpen(false) }, [route.to])

  // Escape cierra el cajón, y mientras está abierto el fondo no scrollea.
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false) }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [drawerOpen])
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => { if (mq.matches) setDrawerOpen(false) }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const Screen = SCREENS[route.to]

  const cls = [
    'ta-shell',
    collapsed && 'is-collapsed',
    drawerOpen && 'is-drawer-open',
  ].filter(Boolean).join(' ')

  return (
    <div className={cls}>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        pendientes={pendientes}
        onCambiarPassword={() => setShowPassword(true)}
        onNavigate={() => setDrawerOpen(false)}
        theme={theme}
        onTheme={onTheme}
        enDrawer={drawerOpen}
        onCerrarDrawer={() => setDrawerOpen(false)}
      />
      {/* Fondo del cajón en mobile. Sólo visible por CSS bajo 1024px. */}
      <div className="ta-sidebar__scrim" onClick={() => setDrawerOpen(false)} aria-hidden />

      <div className="ta-main">
        <Topbar theme={theme} onTheme={onTheme} onOpenDrawer={() => setDrawerOpen(true)} />
        <main className="ta-content" id="contenido">
          {/* `key` fuerza el remontaje al cambiar de destino: una pantalla no
              arrastra el estado de la anterior. */}
          <Screen key={route.to} onPendientesChange={setPendientes} />
        </main>
      </div>

      {showPassword && <CambiarPasswordModal onClose={() => setShowPassword(false)} />}
      <ToastProvider />
    </div>
  )
}
