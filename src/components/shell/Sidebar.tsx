'use client'
import { useEffect, useRef, useState } from 'react'
import {
  House, FileText, ReceiptText, Users, Building2, FileMinus2, FilePlus2,
  ChartNoAxesCombined, UserCog, ChevronsLeft, ChevronsRight, ChevronUp,
  LockKeyhole, LogOut, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { useNavigation } from '@/components/NavigationProvider'
import { navegacionPara, type AppRoute, type RouteId } from '@/lib/navigation'
import { ROLE_LABEL } from '@/design/permissions'
import { supabase } from '@/lib/supabase'

/**
 * Sidebar.
 *
 * Reemplaza al topnav + switcher de módulos. Decisión de producto de Fase 1:
 * TA App es UN workspace, no varias aplicaciones — Reservas dejó de estar
 * detrás de un switcher y pasó a ser un ítem más del grupo Principal.
 *
 * Los ítems y los grupos se derivan de `RUTAS`/`SECCIONES` y se filtran por
 * rol con `puedeAcceder()`, que ya existía y está testeado desde la Fase 0.
 */

/** Mapa nombre → componente. Los strings viven en navigation.ts, que es
 *  código no visual y no debe importar React. */
const ICONS: Record<string, LucideIcon> = {
  House, FileText, ReceiptText, Users, Building2,
  FileMinus2, FilePlus2, ChartNoAxesCombined, UserCog,
}

export function Sidebar({
  collapsed, onToggleCollapse, pendientes, onCambiarPassword, onNavigate,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
  pendientes: number
  onCambiarPassword: () => void
  onNavigate?: () => void
}) {
  const { user, signOut } = useAuth()
  const { route, navigate } = useNavigation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  if (!user) return null

  const grupos = navegacionPara(user.role)
  const initials = user.nombre.split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase()

  function ir(id: RouteId) {
    navigate({ to: id } as AppRoute)
    onNavigate?.()
  }

  return (
    <aside className="ta-sidebar">
      <div className="ta-sidebar__inner">
        {/* Identidad — nunca "Facturación 2026": el producto trasciende el
            módulo y el año fiscal. */}
        <div className="ta-brand">
          <div className="ta-brand__mark" aria-hidden>TA</div>
          <div className="ta-brand__text">
            <div className="ta-brand__name">Toribio Achaval</div>
            <div className="ta-brand__sub">Gestión interna</div>
          </div>
        </div>

        <nav className="ta-nav" aria-label="Navegación principal">
          {grupos.map(({ seccion, rutas }) => (
            <div className="ta-nav__group" key={seccion.id}>
              {seccion.label && <div className="ta-nav__heading">{seccion.label}</div>}
              {rutas.map(r => {
                const Icon = ICONS[r.icono] ?? FileText
                const active = route.to === r.id
                const badge = r.id === 'facturas' && pendientes > 0 ? pendientes : null
                return (
                  <button
                    key={r.id}
                    className={`ta-nav__item${active ? ' is-active' : ''}`}
                    onClick={() => ir(r.id)}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? r.label : undefined}
                  >
                    <Icon size={17} aria-hidden />
                    <span className="ta-nav__label">{r.label}</span>
                    {badge !== null && (
                      <span className="ta-nav__pill" aria-label={`${badge} pendientes`}>{badge}</span>
                    )}
                    {r.id === 'usuarios' && <PendingUsersDot />}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="ta-sidebar__footer">
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              className="ta-userchip"
              onClick={() => setMenuOpen(o => !o)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              title={collapsed ? user.nombre : undefined}
            >
              <span className="ta-userchip__avatar" aria-hidden>{initials}</span>
              <span className="ta-userchip__body">
                <span className="ta-userchip__name">{user.nombre}</span>
                <span className="ta-userchip__role">{ROLE_LABEL[user.role]}</span>
              </span>
              <ChevronUp size={14} aria-hidden style={{ color: 'var(--text-tertiary)' }} />
            </button>

            {menuOpen && (
              <div className="ta-menu ta-menu--up" role="menu">
                <div className="ta-menu__header">
                  <div className="ta-menu__name">{user.nombre}</div>
                  <div className="ta-menu__email">{user.email}</div>
                </div>
                <div className="ta-menu__divider" />
                <button className="ta-menu__item" role="menuitem"
                        onClick={() => { onCambiarPassword(); setMenuOpen(false) }}>
                  <LockKeyhole size={15} aria-hidden /> Cambiar contraseña
                </button>
                <div className="ta-menu__divider" />
                <button className="ta-menu__item ta-menu__item--danger" role="menuitem" onClick={signOut}>
                  <LogOut size={15} aria-hidden /> Cerrar sesión
                </button>
              </div>
            )}
          </div>

          <button
            className="ta-btn ta-btn--ghost ta-btn--sm"
            style={{ width: '100%', marginTop: 'var(--space-1)', justifyContent: collapsed ? 'center' : 'flex-start' }}
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
          >
            {collapsed ? <ChevronsRight size={15} aria-hidden /> : <ChevronsLeft size={15} aria-hidden />}
            {!collapsed && <span>Contraer</span>}
          </button>
        </div>
      </div>
    </aside>
  )
}

/** Punto de solicitudes de cuenta pendientes. Sólo lo ve un admin, porque la
 *  ruta `usuarios` ya está filtrada por rol antes de renderizar. */
function PendingUsersDot() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let alive = true
    supabase.from('usuarios').select('id', { count: 'exact', head: true }).eq('aprobado', false)
      .then(({ count: c }) => { if (alive) setCount(c || 0) })
    return () => { alive = false }
  }, [])
  if (!count) return null
  return <span className="ta-nav__pill" aria-label={`${count} solicitudes pendientes`}>{count}</span>
}
