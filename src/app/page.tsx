'use client'
import { useState, useRef, useEffect } from 'react'
import { ToastProvider } from '@/components/ui'
import { useAuth } from '@/components/AuthProvider'
import LoginPage from '@/components/LoginPage'
import { CambiarPasswordModal } from '@/components/CambiarPassword'
import Dashboard    from '@/pages/Dashboard'
import Facturas     from '@/pages/Facturas'
import Usuarios     from '@/pages/Usuarios'
import Informe      from '@/pages/Informe'
import Reservas     from '@/pages/Reservas'
import { Recibos, Clientes, NotasCredito, NotasDebito, Resumen } from '@/pages/OtherPages'

type Page = 'dashboard'|'facturas'|'recibos'|'clientes'|'nc'|'nd'|'usuarios'|'informe'|'reservas'
type Theme = 'dark'|'light'|'accessible'
type Modulo = 'facturacion' | 'reservas'

const NAV_FACTURACION: { id: Page; label: string; adminOnly?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'facturas',  label: 'Facturas' },
  { id: 'recibos',   label: 'Recibos' },
  { id: 'clientes',  label: 'Clientes' },
  { id: 'nc',        label: 'Notas de Crédito' },
  { id: 'nd',        label: 'Notas de Débito' },
  { id: 'informe',   label: '↓ Informe PDF', adminOnly: true },
  { id: 'usuarios',  label: 'Usuarios', adminOnly: true },
]

const COMPONENTS: Record<Page, React.ComponentType<any>> = {
  dashboard: Dashboard, facturas: Facturas, recibos: Recibos,
  clientes: Clientes, nc: NotasCredito, nd: NotasDebito,
  usuarios: Usuarios, informe: Informe, reservas: Reservas,
}

const TITLES: Record<Page, string> = {
  dashboard:'Dashboard', facturas:'Facturas', recibos:'Recibos',
  clientes:'Clientes', nc:'Notas de Crédito', nd:'Notas de Débito',
  usuarios:'Gestión de Usuarios', informe:'Informe Financiero', reservas:'Reservas',
}

export default function Home() {
  const { user, loading, signOut, isAdmin } = useAuth()
  const [page,         setPage]         = useState<Page>('dashboard')
  const [modulo,       setModulo]        = useState<Modulo>('facturacion')
  const [pendientes,   setPendientes]   = useState(0)
  const [menuOpen,     setMenuOpen]     = useState(false)
  const [userMenu,     setUserMenu]     = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [theme,        setTheme]        = useState<Theme>('dark')
  const menuRef     = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const html = document.documentElement
    if (theme === 'dark') html.removeAttribute('data-theme')
    else html.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const saved = localStorage.getItem('ta-theme') as Theme
    if (saved) setTheme(saved)
  }, [])

  function applyTheme(t: Theme) { setTheme(t); localStorage.setItem('ta-theme', t) }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current     && !menuRef.current.contains(e.target as Node))     setMenuOpen(false)
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function switchModulo(m: Modulo) {
    setModulo(m)
    setPage(m === 'reservas' ? 'reservas' : 'dashboard')
    setMenuOpen(false)
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#111' }}>
      <div className="spinner" />
    </div>
  )

  if (!user) return <LoginPage onLogin={() => {}} />

  if (!user.aprobado) return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">TA</div>
        <h1 className="auth-title">Cuenta pendiente</h1>
        <p className="auth-subtitle">Tu cuenta está esperando aprobación del administrador.</p>
        <button className="btn btn-primary" style={{ width:'100%', marginTop:16 }} onClick={signOut}>Cerrar sesión</button>
      </div>
    </div>
  )

  function goTo(p: Page) { setPage(p); setMenuOpen(false) }

  const isReservas = modulo === 'reservas'
  const visibleNav = NAV_FACTURACION.filter(n => !n.adminOnly || isAdmin)
  const PageComponent = COMPONENTS[isReservas ? 'reservas' : page]
  const initials = user.nombre.split(' ').map((n: string) => n[0]).slice(0,2).join('').toUpperCase()
  const roleBadge = user.role === 'admin' ? 'badge-red' : user.role === 'editor' ? 'badge-blue' : 'badge-gray'
  const roleLabel = user.role === 'admin' ? 'Administrador' : user.role === 'editor' ? 'Editor' : 'Solo lectura'

  // Colors per module
  const moduleAccent = isReservas ? '#1a6bc8' : '#C8102E'

  return (
    <div className="app-shell">
      <header className="topnav" style={{ borderBottom: `1px solid var(--border)` }}>
        <div className="topnav-left" style={{ gap: 8 }}>
          <div className="logo-mark" style={{ background: moduleAccent }}>TA</div>
          <span className="brand-name">Toribio Achaval</span>
          {/* Module switcher */}
          <div style={{ display: 'flex', marginLeft: 8, border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <button
              onClick={() => switchModulo('facturacion')}
              style={{
                padding: '4px 12px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                background: !isReservas ? '#C8102E' : 'var(--bg-secondary)',
                color: !isReservas ? '#fff' : 'var(--text-secondary)',
                border: 'none', transition: 'all .1s',
              }}>Facturación</button>
            <button
              onClick={() => switchModulo('reservas')}
              style={{
                padding: '4px 12px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                background: isReservas ? '#1a6bc8' : 'var(--bg-secondary)',
                color: isReservas ? '#fff' : 'var(--text-secondary)',
                border: 'none', borderLeft: '1px solid var(--border)', transition: 'all .1s',
              }}>Reservas</button>
          </div>
        </div>

        {!isReservas && (
          <nav className="topnav-center">
            {visibleNav.map(n => (
              <button key={n.id} className={`topnav-item${page===n.id?' active':''}`} onClick={() => goTo(n.id)}>
                {n.label}
                {n.id==='facturas' && pendientes>0 && <span className="nav-pill">{pendientes}</span>}
                {n.id==='usuarios' && isAdmin && <PendingBadge />}
              </button>
            ))}
          </nav>
        )}

        {isReservas && <div style={{ flex: 1 }} />}

        <div className="topnav-right">
          {/* Theme switcher */}
          <div className="theme-switcher">
            <button className={`theme-btn${theme==='dark'?' active':''}`} onClick={() => applyTheme('dark')} title="Oscuro">🌙</button>
            <button className={`theme-btn${theme==='light'?' active':''}`} onClick={() => applyTheme('light')} title="Claro">☀️</button>
            <button className={`theme-btn${theme==='accessible'?' active':''}`} onClick={() => applyTheme('accessible')} title="Alto contraste">♿</button>
          </div>

          {!isReservas && (isAdmin || user.role==='editor') && (
            <button className="btn btn-primary btn-sm" onClick={() => goTo('facturas')}>+ Nueva factura</button>
          )}

          <div ref={userMenuRef} style={{ position:'relative' }}>
            <button className="user-avatar-btn" onClick={() => setUserMenu(v=>!v)}>
              <div className="user-avatar" style={{ borderColor: isReservas ? 'rgba(26,107,200,0.4)' : undefined }}>
                {initials}
              </div>
            </button>
            {userMenu && (
              <div className="user-dropdown">
                <div className="user-dd-header">
                  <div style={{ fontWeight:500, fontSize:13 }}>{user.nombre}</div>
                  <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:2 }}>{user.email}</div>
                  <div style={{ marginTop:6 }}><span className={`badge ${roleBadge}`}>{roleLabel}</span></div>
                </div>
                <div className="user-dd-divider" />
                <button className="user-dd-item" onClick={() => { setShowPassword(true); setUserMenu(false) }}>
                  🔑 Cambiar contraseña
                </button>
                <div className="user-dd-divider" />
                <button className="user-dd-item" onClick={signOut} style={{ color:'var(--danger)' }}>Cerrar sesión</button>
              </div>
            )}
          </div>

          <div ref={menuRef} style={{ position:'relative' }}>
            <button className="mobile-menu-btn" onClick={() => setMenuOpen(v=>!v)}>☰</button>
            {menuOpen && (
              <div className="mobile-dropdown">
                <button className="mobile-dd-item" onClick={() => switchModulo('facturacion')} style={{ fontWeight: !isReservas ? 600 : 400 }}>📊 Facturación</button>
                <button className="mobile-dd-item" onClick={() => switchModulo('reservas')} style={{ fontWeight: isReservas ? 600 : 400 }}>🏠 Reservas</button>
                <div className="user-dd-divider" />
                {!isReservas && visibleNav.map(n => (
                  <button key={n.id} className={`mobile-dd-item${page===n.id?' active':''}`} onClick={() => goTo(n.id)}>
                    {n.label}
                  </button>
                ))}
                <div className="user-dd-divider" />
                <button className="mobile-dd-item" onClick={() => { setShowPassword(true); setMenuOpen(false) }}>🔑 Cambiar contraseña</button>
                <div className="user-dd-divider" />
                <button className="mobile-dd-item" onClick={signOut} style={{ color:'var(--danger)' }}>Cerrar sesión</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="main-content">
        <PageComponent onPendientesChange={setPendientes} />
      </main>

      {showPassword && <CambiarPasswordModal onClose={() => setShowPassword(false)} />}
      <ToastProvider />
    </div>
  )
}

function PendingBadge() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    import('@/lib/supabase').then(({ supabase }) => {
      supabase.from('usuarios').select('id', { count: 'exact' }).eq('aprobado', false)
        .then(({ count: c }) => setCount(c || 0))
    })
  }, [])
  if (!count) return null
  return <span className="nav-pill" style={{ marginLeft: 4 }}>{count}</span>
}
