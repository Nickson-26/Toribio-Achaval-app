'use client'
import { useState, useRef, useEffect } from 'react'
import { ToastProvider } from '@/components/ui'
import { useAuth } from '@/components/AuthProvider'
import LoginPage from '@/components/LoginPage'
import Dashboard    from '@/pages/Dashboard'
import Facturas     from '@/pages/Facturas'
import Usuarios     from '@/pages/Usuarios'
import { Recibos, Clientes, NotasCredito, NotasDebito, Resumen } from '@/pages/OtherPages'

type Page = 'dashboard'|'facturas'|'recibos'|'clientes'|'nc'|'nd'|'usuarios'

const NAV: { id: Page; label: string; adminOnly?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'facturas',  label: 'Facturas' },
  { id: 'recibos',   label: 'Recibos' },
  { id: 'clientes',  label: 'Clientes' },
  { id: 'nc',        label: 'Notas de Crédito' },
  { id: 'nd',        label: 'Notas de Débito' },
  { id: 'usuarios',  label: 'Usuarios', adminOnly: true },
]

const COMPONENTS: Record<Page, React.ComponentType<any>> = {
  dashboard: Dashboard, facturas: Facturas, recibos: Recibos,
  clientes: Clientes, nc: NotasCredito, nd: NotasDebito, usuarios: Usuarios,
}

const TITLES: Record<Page, string> = {
  dashboard:'Dashboard', facturas:'Facturas', recibos:'Recibos',
  clientes:'Clientes', nc:'Notas de Crédito', nd:'Notas de Débito', usuarios:'Gestión de Usuarios',
}

export default function Home() {
  const { user, loading, signOut, isAdmin } = useAuth()
  const [page,       setPage]       = useState<Page>('dashboard')
  const [pendientes, setPendientes] = useState(0)
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [userMenu,   setUserMenu]   = useState(false)
  const menuRef     = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current     && !menuRef.current.contains(e.target as Node))     setMenuOpen(false)
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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
        <button className="btn btn-primary" style={{width:'100%',marginTop:16}} onClick={signOut}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )

  function goTo(p: Page) { setPage(p); setMenuOpen(false) }

  const visibleNav = NAV.filter(n => !n.adminOnly || isAdmin)
  const PageComponent = COMPONENTS[page]

  return (
    <div className="app-shell">
      <header className="topnav">
        <div className="topnav-left">
          <div className="logo-mark">TA</div>
          <span className="brand-name">Toribio Achaval</span>
        </div>

        <nav className="topnav-center">
          {visibleNav.map(n => (
            <button
              key={n.id}
              className={`topnav-item${page===n.id?' active':''}`}
              onClick={() => goTo(n.id)}
            >
              {n.label}
              {n.id==='facturas' && pendientes>0 && <span className="nav-pill">{pendientes}</span>}
            </button>
          ))}
        </nav>

        <div className="topnav-right">
          {(isAdmin || user.role==='editor') && (
            <button className="btn btn-primary btn-sm" onClick={() => goTo('facturas')}>+ Nueva factura</button>
          )}

          {/* User menu */}
          <div ref={userMenuRef} style={{position:'relative'}}>
            <button className="user-avatar-btn" onClick={() => setUserMenu(v=>!v)}>
              <div className="user-avatar">{user.nombre.slice(0,2).toUpperCase()}</div>
            </button>
            {userMenu && (
              <div className="user-dropdown">
                <div className="user-dd-header">
                  <div style={{fontWeight:500,fontSize:13}}>{user.nombre}</div>
                  <div style={{fontSize:11,color:'var(--text-tertiary)'}}>{user.email}</div>
                  <div style={{marginTop:4}}><span className={`badge badge-${user.role==='admin'?'red':user.role==='editor'?'blue':'gray'}`}>{user.role==='admin'?'Administrador':user.role==='editor'?'Editor':'Solo lectura'}</span></div>
                </div>
                <div className="user-dd-divider"/>
                <button className="user-dd-item" onClick={signOut}>Cerrar sesión</button>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <div ref={menuRef} style={{position:'relative'}}>
            <button className="mobile-menu-btn" onClick={() => setMenuOpen(v=>!v)}>☰</button>
            {menuOpen && (
              <div className="mobile-dropdown">
                {visibleNav.map(n => (
                  <button key={n.id} className={`mobile-dd-item${page===n.id?' active':''}`} onClick={()=>goTo(n.id)}>
                    {n.label}
                    {n.id==='facturas' && pendientes>0 && <span className="nav-pill">{pendientes}</span>}
                  </button>
                ))}
                <div className="user-dd-divider"/>
                <button className="mobile-dd-item" onClick={signOut} style={{color:'var(--danger)'}}>Cerrar sesión</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="main-content">
        <PageComponent onPendientesChange={setPendientes} />
      </main>

      <ToastProvider />
    </div>
  )
}
