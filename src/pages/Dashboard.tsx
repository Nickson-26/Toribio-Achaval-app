'use client'
import { useEffect, useState } from 'react'
import { db } from '@/lib/supabase'
import { ars, usd, fdate, montoARS, MESES, PERSONAS } from '@/lib/utils'
import { TipoBadge, EstadoBadge, Spinner } from '@/components/ui'

const YEARS = ['2026', '2025', '2024']

export default function Dashboard({ onPendientesChange }: { onPendientesChange?: (n: number) => void }) {
  const [all,     setAll]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fYear,   setFYear]   = useState('2026')
  const [fMes,    setFMes]    = useState('all')
  const [fUnidad, setFUnidad] = useState('all')

  useEffect(() => {
    db.getDashboardStats().then(s => {
      setAll(s.comprobantes || [])
      const p = (s.comprobantes || []).filter((c: any) => c.tipo?.startsWith('FACT') && c.estado === 'pendiente').length
      onPendientesChange?.(p)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  // Apply filters
  const facts = all.filter((c: any) => {
    if (!c.tipo?.startsWith('FACT') || c.estado === 'anulada') return false
    if (fYear !== 'all' && !c.fecha?.startsWith(fYear)) return false
    if (fMes  !== 'all' && c.fecha?.slice(5, 7) !== fMes) return false
    if (fUnidad !== 'all' && c.persona !== fUnidad) return false
    return true
  })

  // Convert everything to ARS using stored TC
  const toARS = (f: any) => {
    if (f.monto_ars) return f.monto_ars
    if (f.monto_usd && f.tipo_cambio) return f.monto_usd * f.tipo_cambio
    return 0
  }

  const totalARS   = facts.reduce((s: number, f: any) => s + toARS(f), 0)
  const totalUSD   = facts.filter((f: any) => f.monto_usd).reduce((s: number, f: any) => s + (f.monto_usd || 0), 0)
  const cobradas   = facts.filter((f: any) => f.estado === 'cobrada').length
  const pendCount  = facts.filter((f: any) => f.estado === 'pendiente').length
  const montoPend  = facts.filter((f: any) => f.estado === 'pendiente').reduce((s: number, f: any) => s + toARS(f), 0)

  // By unidad
  const byUnidad: Record<string, number> = {}
  facts.forEach((f: any) => { byUnidad[f.persona] = (byUnidad[f.persona] || 0) + toARS(f) })

  // By month (for chart — always show all months of selected year)
  const byMes = new Array(12).fill(0)
  all.filter((c: any) => {
    if (!c.tipo?.startsWith('FACT') || c.estado === 'anulada') return false
    if (!c.fecha?.startsWith(fYear)) return false
    if (fUnidad !== 'all' && c.persona !== fUnidad) return false
    return true
  }).forEach((f: any) => {
    const m = parseInt(f.fecha?.slice(5, 7) || '0') - 1
    if (m >= 0 && m < 12) byMes[m] += toARS(f)
  })
  const maxM = Math.max(...byMes, 1)

  const recent = [...facts].sort((a: any, b: any) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, 8)

  return (
    <>
      {/* Filter bar */}
      <div className="dash-filters">
        <label>Filtros</label>
        <span className="filter-sep" />
        <label>Año</label>
        <select value={fYear} onChange={e => setFYear(e.target.value)}>
          <option value="all">Todos</option>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <label>Mes</label>
        <select value={fMes} onChange={e => setFMes(e.target.value)}>
          <option value="all">Todos</option>
          {MESES.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
        </select>
        <label>Unidad</label>
        <select value={fUnidad} onChange={e => setFUnidad(e.target.value)}>
          <option value="all">Todas</option>
          {PERSONAS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {(fMes !== 'all' || fUnidad !== 'all') && (
          <button className="btn btn-sm" onClick={() => { setFMes('all'); setFUnidad('all') }}>
            Limpiar
          </button>
        )}
      </div>

      {/* Metrics */}
      <div className="metrics-grid">
        <div className="metric-card accent">
          <div className="metric-label">Facturado ARS</div>
          <div className="metric-value">{ars(totalARS)}</div>
          <div className="metric-sub">{facts.length} comprobantes</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Facturado USD</div>
          <div className="metric-value">{usd(totalUSD)}</div>
          <div className="metric-sub">{facts.filter((f: any) => f.monto_usd).length} en dólares</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Cobradas</div>
          <div className="metric-value">
            {cobradas}
            <span style={{ fontSize: 14, color: 'var(--text-tertiary)', fontWeight: 400 }}> / {facts.length}</span>
          </div>
          <div className="metric-sub">{facts.length ? Math.round((cobradas / facts.length) * 100) : 0}% del total</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Pendiente cobro</div>
          <div className="metric-value" style={{ color: 'var(--warn)' }}>{ars(montoPend)}</div>
          <div className="metric-sub">{pendCount} facturas</div>
        </div>
      </div>

      <div className="two-col">
        {/* Bar chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Facturación mensual {fYear} — ARS equivalente</span>
          </div>
          <div style={{ padding: '16px 16px 8px' }}>
            <div className="chart-bars">
              {byMes.map((v, i) => (
                <div key={i} className="bar-col">
                  <div className="bar-val">{v > 0 ? '$' + Math.round(v / 1_000_000) + 'M' : ''}</div>
                  <div
                    className="bar"
                    style={{
                      height: `${Math.round((v / maxM) * 100)}%`,
                      background: v > 0 ? 'var(--accent)' : 'var(--border)',
                      opacity: fMes !== 'all' && String(i + 1).padStart(2, '0') !== fMes ? 0.3 : 1
                    }}
                    title={`${MESES[i]}: ${ars(v)}`}
                  />
                  <div className="bar-lbl">{MESES[i]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* By unidad */}
        <div className="card">
          <div className="card-header"><span className="card-title">Por unidad de negocio</span></div>
          <div style={{ padding: '14px 16px' }}>
            {Object.entries(byUnidad).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([p, v]) => (
              <div key={p} className="progress-row">
                <span className="progress-label">{p}</span>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${Math.round((v / totalARS) * 100)}%` }} />
                </div>
                <span className="progress-value">{ars(v)}</span>
              </div>
            ))}
            {Object.keys(byUnidad).length === 0 && (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                Sin datos para los filtros seleccionados
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Últimas facturas</span>
          <span className="card-hint">{fUnidad !== 'all' ? fUnidad : ''} {fMes !== 'all' ? MESES[parseInt(fMes) - 1] : ''}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>N°</th><th>Fecha</th><th>Cliente</th><th>Tipo</th>
                <th>Unidad</th><th className="text-right">ARS</th><th className="text-right">USD</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr><td colSpan={8} className="empty-row">Sin resultados</td></tr>
              ) : recent.map((f: any) => (
                <tr key={f.id} className="tr-clickable">
                  <td className="text-link">{f.id}</td>
                  <td>{fdate(f.fecha)}</td>
                  <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.cliente}</td>
                  <td><TipoBadge tipo={f.tipo} /></td>
                  <td className="text-dim" style={{ fontSize: 11.5 }}>{f.persona}</td>
                  <td className="text-right text-mono">{ars(f.monto_ars)}</td>
                  <td className="text-right text-mono">{usd(f.monto_usd)}</td>
                  <td><EstadoBadge estado={f.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
