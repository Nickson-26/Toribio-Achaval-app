'use client'
import { useState } from 'react'
import { ToastProvider } from '@/components/ui'
import Dashboard    from '@/pages/Dashboard'
import Facturas     from '@/pages/Facturas'
import { Recibos }  from '@/pages/OtherPages'
import { Clientes } from '@/pages/OtherPages'
import { NotasCredito } from '@/pages/OtherPages'
import { NotasDebito }  from '@/pages/OtherPages'
import { Resumen }      from '@/pages/OtherPages'

type Page = 'dashboard'|'facturas'|'recibos'|'clientes'|'nc'|'nd'|'resumen'

const PAGES: { id: Page; label: string; icon: string; group: string }[] = [
  { id: 'dashboard', label: 'Dashboard',        icon: '◈', group: 'Principal' },
  { id: 'facturas',  label: 'Facturas',          icon: '◻', group: 'Principal' },
  { id: 'recibos',   label: 'Recibos',           icon: '◻', group: 'Principal' },
  { id: 'clientes',  label: 'Clientes',          icon: '◻', group: 'Principal' },
  { id: 'nc',        label: 'Notas de Crédito',  icon: '◻', group: 'Documentos' },
  { id: 'nd',        label: 'Notas de Débito',   icon: '◻', group: 'Documentos' },
  { id: 'resumen',   label: 'Resumen Anual',     icon: '◻', group: 'Documentos' },
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
  const [page, setPage]           = useState<Page>('dashboard')
  const [pendientes, setPendientes] = useState(0)
  const groups = Array.from(new Set(PAGES.map(p => p.group)))
  const PageComponent = COMPONENTS[page]

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="logo">
          <div className="logo-icon">TA</div>
          <div className="logo-text">
            <div className="logo-title">Toribio Achaval</div>
            <div className="logo-sub">Facturación 2026</div>
          </div>
        </div>
        {groups.map(g => (
          <div key={g} className="nav-section">
            <div className="nav-label">{g}</div>
            {PAGES.filter(p => p.group === g).map(p => (
              <button
                key={p.id}
                className={`nav-item${page === p.id ? ' active' : ''}`}
                onClick={() => setPage(p.id)}
              >
                <span className="nav-icon">{p.icon}</span>
                <span>{p.label}</span>
                {p.id === 'facturas' && pendientes > 0 && (
                  <span className="nav-badge">{pendientes}</span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="main">
        <div className="topbar">
          <div className="topbar-left">
            <span className="page-title">{TITLES[page]}</span>
          </div>
          <div className="topbar-right">
            <button className="btn btn-primary btn-sm" onClick={() => setPage('facturas')}>
              + Nueva factura
            </button>
          </div>
        </div>
        <div className="content">
          <PageComponent onPendientesChange={setPendientes} />
        </div>
      </div>
      <ToastProvider />
    </div>
  )
}
