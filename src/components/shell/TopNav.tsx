'use client'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useHideNumbers } from '@/components/HideNumbers'
import { useNavigation } from '@/components/NavigationProvider'
import { SECCIONES, rutasDeSeccion } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/auth'

export type Theme = 'dark' | 'light' | 'accessible'

/**
 * Barra superior.
 *
 * Extraída de `app/page.tsx`, que concentraba shell + nav + router + theme +
 * menú de usuario en un solo archivo de 252 líneas.
 *
 * El markup y las clases son IDÉNTICOS a los anteriores: esta fase no cambia
 * nada visual. Lo que cambia es de dónde salen los datos — la navegación ahora
 * se deriva de `RUTAS`/`SECCIONES` en vez de estar duplicada en cinco listas
 * que había que mantener sincronizadas a mano.
 */
export function TopNav({
  theme, onTheme, pendientes, onCambiarPassword,
}: {
  theme: Theme
  onTheme: (t: Theme) => void
  pendientes: number
  onCambiarPassword: () => void
}) {
  const { user, signOut, isAdmin, isEditor } = useAuth()
  const { hidden, toggle: toggleHide } = useHideNumbers()
  const { route, seccion, navigate, irASeccion } = useNavigation()

  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!user) return null

  const isReservas = seccion === 'reservas'
  const navItems = rutasDeSeccion('facturacion', user.role)
  const initials = user.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const seccionActual = SECCIONES.find(s => s.id === seccion)
  const moduleAccent = seccionActual?.accent ?? '#C8102E'

  function ir(id: Parameters<typeof navigate>[0]) {
    navigate(id)
    setMenuOpen(false)
  }

  return (
    <header className="topnav" style={{ borderBottom: `1px solid var(--border)` }}>
      <div className="topnav-left" style={{ gap: 8 }}>
        <div className="logo-mark" style={{ background: moduleAccent }}>TA</div>
        <span className="brand-name">Toribio Achaval</span>

        {/* Switcher de módulos — derivado de SECCIONES */}
        <div style={{ display: 'flex', marginLeft: 8, border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {SECCIONES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { irASeccion(s.id); setMenuOpen(false) }}
              style={{
                padding: '4px 12px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                background: seccion === s.id ? s.accent : 'var(--bg-secondary)',
                color: seccion === s.id ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                borderLeft: i > 0 ? '1px solid var(--border)' : undefined,
                transition: 'all .1s',
              }}>{s.label}</button>
          ))}
        </div>
      </div>

      {!isReservas && (
        <nav className="topnav-center">
          {navItems.map(n => (
            <button
              key={n.id}
              className={`topnav-item${route.to === n.id ? ' active' : ''}`}
              onClick={() => ir({ to: n.id } as any)}
            >
              {n.label}
              {n.id === 'facturas' && pendientes > 0 && <span className="nav-pill">{pendientes}</span>}
              {n.id === 'usuarios' && isAdmin && <PendingBadge />}
            </button>
          ))}
        </nav>
      )}

      {isReservas && <div style={{ flex: 1 }} />}

      <div className="topnav-right">
        <button className="eye-btn" onClick={toggleHide} title={hidden ? 'Mostrar números' : 'Ocultar números'}>
          {hidden ? '🙈' : '👁'}
        </button>

        <div className="theme-switcher">
          <button className={`theme-btn${theme === 'dark' ? ' active' : ''}`} onClick={() => onTheme('dark')} title="Oscuro">🌙</button>
          <button className={`theme-btn${theme === 'light' ? ' active' : ''}`} onClick={() => onTheme('light')} title="Claro">☀️</button>
          <button className={`theme-btn${theme === 'accessible' ? ' active' : ''}`} onClick={() => onTheme('accessible')} title="Alto contraste">♿</button>
        </div>

        {!isReservas && isEditor && (
          <button className="btn btn-primary btn-sm" onClick={() => ir({ to: 'facturas' })}>+ Nueva factura</button>
        )}

        <div ref={userMenuRef} style={{ position: 'relative' }}>
          <button className="user-avatar-btn" onClick={() => setUserMenu(v => !v)}>
            <div className="user-avatar" style={{ borderColor: isReservas ? 'rgba(26,107,200,0.4)' : undefined }}>
              {initials}
            </div>
          </button>
          {userMenu && (
            <div className="user-dropdown">
              <div className="user-dd-header">
                <div style={{ fontWeight: 500, fontSize: 13 }}>{user.nombre}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{user.email}</div>
                <div style={{ marginTop: 6 }}>
                  <span className={`badge ${ROLE_COLORS[user.role]}`}>{ROLE_LABELS[user.role]}</span>
                </div>
              </div>
              <div className="user-dd-divider" />
              <button className="user-dd-item" onClick={() => { onCambiarPassword(); setUserMenu(false) }}>
                🔑 Cambiar contraseña
              </button>
              <div className="user-dd-divider" />
              <button className="user-dd-item" onClick={signOut} style={{ color: 'var(--danger)' }}>Cerrar sesión</button>
            </div>
          )}
        </div>

        <div ref={menuRef} style={{ position: 'relative' }}>
          <button className="mobile-menu-btn" onClick={() => setMenuOpen(v => !v)}>☰</button>
          {menuOpen && (
            <div className="mobile-dropdown">
              {SECCIONES.map(s => (
                <button key={s.id} className="mobile-dd-item"
                  onClick={() => { irASeccion(s.id); setMenuOpen(false) }}
                  style={{ fontWeight: seccion === s.id ? 600 : 400 }}>
                  {s.id === 'reservas' ? '🏠' : '📊'} {s.label}
                </button>
              ))}
              <div className="user-dd-divider" />
              {!isReservas && navItems.map(n => (
                <button key={n.id} className={`mobile-dd-item${route.to === n.id ? ' active' : ''}`}
                  onClick={() => ir({ to: n.id } as any)}>
                  {n.label}
                </button>
              ))}
              <div className="user-dd-divider" />
              <button className="mobile-dd-item" onClick={() => { onCambiarPassword(); setMenuOpen(false) }}>🔑 Cambiar contraseña</button>
              <div className="user-dd-divider" />
              <button className="mobile-dd-item" onClick={signOut} style={{ color: 'var(--danger)' }}>Cerrar sesión</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function PendingBadge() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    supabase.from('usuarios').select('id', { count: 'exact' }).eq('aprobado', false)
      .then(({ count: c }) => setCount(c || 0))
  }, [])
  if (!count) return null
  return <span className="nav-pill" style={{ marginLeft: 4 }}>{count}</span>
}
