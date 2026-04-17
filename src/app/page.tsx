'use client'
import { useState, useRef, useEffect } from 'react'
import { ToastProvider } from '@/components/ui'
import Dashboard    from '@/pages/Dashboard'
import Facturas     from '@/pages/Facturas'
import { Recibos, Clientes, NotasCredito, NotasDebito, Resumen } from '@/pages/OtherPages'

type Page = 'dashboard'|'facturas'|'recibos'|'clientes'|'nc'|'nd'|'resumen'

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard',       icon: '◈' },
  { id: 'facturas',  label: 'Facturas',         icon: '▦' },
  { id: 'recibos',   label: 'Recibos',          icon: '▤' },
  { id: 'clientes',  label: 'Clientes',         icon: '▣' },
  { id: 'nc',        label: 'Notas de Crédito', icon: '▥' },
  { id: 'nd',        label: 'Notas de Débito',  icon: '▥' },
]

const TITLES: Record<Page, string> = {
  dashboard:'Dashboard', facturas:'Facturas', recibos:'Recibos',
  clientes:'Clientes', nc:'Notas de Crédito', nd:'Notas de Débito', resumen:'Resumen Anual',
}

const COMPONENTS: Record<Page, React.ComponentType<any>> = {
  dashboard: Dashboard, facturas: Facturas, recibos: Recibos,
  clientes: Clientes, nc: NotasCredito, nd: NotasDebito, resumen: Resumen,
}

export default function Home() {
  const [page, setPage]             = useState<Page>('dashboard')
  const [pendientes, setPendientes] = useState(0)
  const [menuOpen, setMenuOpen]     = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function goTo(p: Page) { setPage(p); setMenuOpen(false) }

  const PageComponent = COMPONENTS[page]

  return (
    <div className="app-shell">
      {/* TOP NAV */}
      <header className="topnav">
        <div className="topnav-left">
          <div className="logo-mark">TA</div>
          <span className="brand-name">Toribio Achaval</span>
        </div>

        <nav className="topnav-center">
          {NAV.map(n => (
            <button
              key={n.id}
              className={`topnav-item${page === n.id ? ' active' : ''}`}
              onClick={() => goTo(n.id)}
            >
              {n.label}
              {n.id === 'facturas' && pendientes > 0 && <span className="nav-pill">{pendientes}</span>}
            </button>
          ))}
        </nav>

        <div className="topnav-right">
          <button className="btn btn-primary btn-sm" onClick={() => goTo('facturas')}>
            + Nueva factura
          </button>
          {/* Mobile menu */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button className="mobile-menu-btn" onClick={() => setMenuOpen(v => !v)}>☰</button>
            {menuOpen && (
              <div className="mobile-dropdown">
                {NAV.map(n => (
                  <button key={n.id} className={`mobile-dd-item${page === n.id ? ' active' : ''}`} onClick={() => goTo(n.id)}>
                    {n.label}
                    {n.id === 'facturas' && pendientes > 0 && <span className="nav-pill">{pendientes}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="main-content">
        <PageComponent onPendientesChange={setPendientes} />
      </main>

      <ToastProvider />
    </div>
  )
}
