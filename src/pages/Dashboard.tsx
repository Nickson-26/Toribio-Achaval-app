'use client'
import { useEffect, useState, useRef } from 'react'
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

  const barRef   = useRef<HTMLCanvasElement>(null)
  const lineRef  = useRef<HTMLCanvasElement>(null)
  const donutRef = useRef<HTMLCanvasElement>(null)
  const typeRef  = useRef<HTMLCanvasElement>(null)

  const barChart   = useRef<any>(null)
  const lineChart  = useRef<any>(null)
  const donutChart = useRef<any>(null)
  const typeChart  = useRef<any>(null)

  useEffect(() => {
    db.getDashboardStats().then(s => {
      setAll(s.comprobantes || [])
      const p = (s.comprobantes || []).filter((c: any) => c.tipo?.startsWith('FACT') && c.estado === 'pendiente').length
      onPendientesChange?.(p)
    }).finally(() => setLoading(false))
  }, [])

  const toARS = (f: any) => {
    if (f.monto_ars) return f.monto_ars
    if (f.monto_usd && f.tipo_cambio) return f.monto_usd * f.tipo_cambio
    return 0
  }

  const facts = all.filter((c: any) => {
    if (!c.tipo?.startsWith('FACT') || c.estado === 'anulada') return false
    if (fYear !== 'all' && !c.fecha?.startsWith(fYear)) return false
    if (fMes  !== 'all' && c.fecha?.slice(5,7) !== fMes) return false
    if (fUnidad !== 'all' && c.persona !== fUnidad) return false
    return true
  })

  const totalARS  = facts.reduce((s: number, f: any) => s + toARS(f), 0)
  const totalUSD  = facts.filter((f: any) => f.monto_usd).reduce((s: number, f: any) => s + (f.monto_usd || 0), 0)
  const cobradas  = facts.filter((f: any) => f.estado === 'cobrada').length
  const pendCount = facts.filter((f: any) => f.estado === 'pendiente').length
  const montoPend = facts.filter((f: any) => f.estado === 'pendiente').reduce((s: number, f: any) => s + toARS(f), 0)
  const pctCobrado = facts.length ? Math.round((cobradas / facts.length) * 100) : 0

  // By month data
  const byMes = new Array(12).fill(0)
  all.filter((c: any) => c.tipo?.startsWith('FACT') && c.estado !== 'anulada' && c.fecha?.startsWith(fYear) && (fUnidad === 'all' || c.persona === fUnidad))
    .forEach((f: any) => { const m = parseInt(f.fecha?.slice(5,7)||'0')-1; if(m>=0&&m<12) byMes[m]+=toARS(f) })

  // Cumulative line
  const cumulative = byMes.reduce((acc: number[], v, i) => { acc.push((acc[i-1]||0)+v); return acc }, [])

  // By unidad
  const byUnidad: Record<string, number> = {}
  facts.forEach((f: any) => { byUnidad[f.persona] = (byUnidad[f.persona]||0)+toARS(f) })

  // By tipo
  const byTipo: Record<string, number> = {}
  facts.forEach((f: any) => { byTipo[f.tipo] = (byTipo[f.tipo]||0)+toARS(f) })

  // Top clientes
  const byCliente: Record<string, number> = {}
  facts.forEach((f: any) => { byCliente[f.cliente] = (byCliente[f.cliente]||0)+toARS(f) })
  const topClientes = Object.entries(byCliente).sort((a,b)=>b[1]-a[1]).slice(0,6)

  const recent = [...facts].sort((a: any,b: any)=>(b.fecha||'').localeCompare(a.fecha||'')).slice(0,6)

  // Draw charts
  useEffect(() => {
    if (loading || typeof window === 'undefined') return
    import('chart.js/auto').then(({ default: Chart }) => {
      const ACCENT = '#C8102E'
      const ACCENT2 = '#ff6680'
      const GRID = 'rgba(255,255,255,0.06)'
      const TEXT = '#a8a8a8'

      const defaults = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      }

      // BAR — Monthly
      if (barRef.current) {
        barChart.current?.destroy()
        barChart.current = new Chart(barRef.current, {
          type: 'bar',
          data: {
            labels: MESES,
            datasets: [{
              data: byMes.map(v => Math.round(v/1000000)),
              backgroundColor: byMes.map((v,i) => fMes !== 'all' && String(i+1).padStart(2,'0') === fMes ? ACCENT : 'rgba(200,16,46,0.35)'),
              borderColor: ACCENT,
              borderWidth: 1,
              borderRadius: 4,
            }]
          },
          options: {
            ...defaults,
            scales: {
              x: { grid: { color: GRID }, ticks: { color: TEXT, font: { size: 10 } } },
              y: { grid: { color: GRID }, ticks: { color: TEXT, font: { size: 10 }, callback: (v: any) => `$${v}M` } }
            },
            plugins: { ...defaults.plugins, tooltip: { callbacks: { label: (ctx: any) => ` $${ctx.raw}M` } } }
          }
        })
      }

      // LINE — Cumulative
      if (lineRef.current) {
        lineChart.current?.destroy()
        lineChart.current = new Chart(lineRef.current, {
          type: 'line',
          data: {
            labels: MESES,
            datasets: [{
              data: cumulative.map(v => Math.round(v/1000000)),
              borderColor: ACCENT,
              backgroundColor: 'rgba(200,16,46,0.08)',
              borderWidth: 2,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: ACCENT,
              pointRadius: 3,
            }]
          },
          options: {
            ...defaults,
            scales: {
              x: { grid: { color: GRID }, ticks: { color: TEXT, font: { size: 10 } } },
              y: { grid: { color: GRID }, ticks: { color: TEXT, font: { size: 10 }, callback: (v: any) => `$${v}M` } }
            }
          }
        })
      }

      // DONUT — Cobradas vs Pendientes
      if (donutRef.current) {
        donutChart.current?.destroy()
        donutChart.current = new Chart(donutRef.current, {
          type: 'doughnut',
          data: {
            labels: ['Cobradas', 'Pendientes'],
            datasets: [{
              data: [cobradas, pendCount],
              backgroundColor: ['rgba(34,197,94,0.8)', 'rgba(200,16,46,0.7)'],
              borderColor: ['#22c55e', ACCENT],
              borderWidth: 1,
            }]
          },
          options: {
            ...defaults,
            cutout: '72%',
            plugins: {
              legend: { display: true, position: 'bottom', labels: { color: TEXT, font: { size: 11 }, padding: 12, boxWidth: 10 } }
            }
          }
        })
      }

      // DONUT — By tipo
      if (typeRef.current) {
        typeChart.current?.destroy()
        const tipoLabels = Object.keys(byTipo)
        const tipoVals   = Object.values(byTipo).map(v => Math.round(v/1000000))
        const colors = ['rgba(200,16,46,0.8)','rgba(96,165,250,0.8)','rgba(245,158,11,0.8)','rgba(139,92,246,0.8)','rgba(20,184,166,0.8)']
        typeChart.current = new Chart(typeRef.current, {
          type: 'doughnut',
          data: {
            labels: tipoLabels,
            datasets: [{
              data: tipoVals,
              backgroundColor: colors.slice(0, tipoLabels.length),
              borderWidth: 1,
            }]
          },
          options: {
            ...defaults,
            cutout: '68%',
            plugins: {
              legend: { display: true, position: 'bottom', labels: { color: TEXT, font: { size: 10 }, padding: 8, boxWidth: 10 } }
            }
          }
        })
      }
    })

    return () => {
      barChart.current?.destroy()
      lineChart.current?.destroy()
      donutChart.current?.destroy()
      typeChart.current?.destroy()
    }
  }, [loading, fYear, fMes, fUnidad, all])

  if (loading) return <Spinner />

  return (
    <>
      {/* Filter bar */}
      <div className="dash-filters">
        <label>Filtros</label>
        <span className="filter-sep" />
        <label>Año</label>
        <select value={fYear} onChange={e => setFYear(e.target.value)}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <label>Mes</label>
        <select value={fMes} onChange={e => setFMes(e.target.value)}>
          <option value="all">Todos</option>
          {MESES.map((m,i) => <option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>)}
        </select>
        <label>Unidad</label>
        <select value={fUnidad} onChange={e => setFUnidad(e.target.value)}>
          <option value="all">Todas</option>
          {PERSONAS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {(fMes !== 'all' || fUnidad !== 'all') && (
          <button className="btn btn-sm" onClick={() => { setFMes('all'); setFUnidad('all') }}>Limpiar</button>
        )}
      </div>

      {/* KPI row */}
      <div className="metrics-grid">
        <div className="metric-card accent">
          <div className="metric-label">Facturado ARS</div>
          <div className="metric-value">{ars(totalARS)}</div>
          <div className="metric-sub">{facts.length} comprobantes</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Facturado USD</div>
          <div className="metric-value">{usd(totalUSD)}</div>
          <div className="metric-sub">{facts.filter((f:any)=>f.monto_usd).length} en dólares</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Tasa de cobro</div>
          <div className="metric-value" style={{ color: pctCobrado >= 80 ? 'var(--success)' : pctCobrado >= 50 ? 'var(--warn)' : 'var(--danger)' }}>
            {pctCobrado}%
          </div>
          <div className="metric-sub">{cobradas} cobradas / {facts.length} total</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Pendiente cobro</div>
          <div className="metric-value" style={{ color: 'var(--warn)' }}>{ars(montoPend)}</div>
          <div className="metric-sub">{pendCount} facturas</div>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="two-col">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Facturación mensual — ARS</span>
            <span className="card-hint">{fYear}</span>
          </div>
          <div style={{ padding: '12px 16px 16px', height: 200 }}>
            <canvas ref={barRef} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Acumulado anual</span>
            <span className="card-hint">{fYear}</span>
          </div>
          <div style={{ padding: '12px 16px 16px', height: 200 }}>
            <canvas ref={lineRef} />
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Estado de cobro</span></div>
          <div style={{ padding: '12px 16px 16px', height: 200 }}>
            <canvas ref={donutRef} />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Por tipo</span></div>
          <div style={{ padding: '12px 16px 16px', height: 200 }}>
            <canvas ref={typeRef} />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Top clientes</span></div>
          <div style={{ padding: '12px 16px' }}>
            {topClientes.length === 0 ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: 20 }}>Sin datos</div>
            ) : topClientes.map(([cliente, v], i) => (
              <div key={cliente} className="progress-row" style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 16, flexShrink: 0 }}>{i+1}</span>
                <span className="progress-label" style={{ width: 130 }}>{cliente}</span>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${Math.round((v/topClientes[0][1])*100)}%` }} />
                </div>
                <span className="progress-value" style={{ minWidth: 80, fontSize: 11 }}>{ars(v)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* By unidad */}
      <div className="two-col">
        <div className="card">
          <div className="card-header"><span className="card-title">Por unidad de negocio</span></div>
          <div style={{ padding: '14px 16px' }}>
            {Object.entries(byUnidad).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([p,v]) => (
              <div key={p} className="progress-row">
                <span className="progress-label">{p}</span>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${Math.round((v/totalARS)*100)}%` }} />
                </div>
                <span className="progress-value">{ars(v)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent table */}
        <div className="card">
          <div className="card-header"><span className="card-title">Últimas facturas</span></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>N°</th><th>Cliente</th><th>Unidad</th>
                  <th className="text-right">Monto</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr><td colSpan={5} className="empty-row">Sin datos</td></tr>
                ) : recent.map((f: any) => (
                  <tr key={f.id} className="tr-clickable">
                    <td className="text-link" style={{ fontSize: 11 }}>{f.id}</td>
                    <td style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12 }}>{f.cliente}</td>
                    <td className="text-dim" style={{ fontSize: 11 }}>{f.persona}</td>
                    <td className="text-right text-mono" style={{ fontSize: 12, fontWeight: 500 }}>
                      {f.monto_ars ? ars(f.monto_ars) : usd(f.monto_usd)}
                    </td>
                    <td><EstadoBadge estado={f.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
