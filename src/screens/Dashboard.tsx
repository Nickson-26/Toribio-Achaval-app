'use client'
import { useEffect, useRef, useState } from 'react'
import { db } from '@/lib/supabase'
import { ars, usd, fdate, MESES, PERSONAS } from '@/lib/utils'
import { TipoBadge, EstadoBadge, Spinner } from '@/components/ui'
import { useHideNumbers } from '@/components/HideNumbers'

const YEARS = ['2026', '2025', '2024']

function pctChange(current: number, previous: number) {
  if (!previous) return null
  return Math.round(((current - previous) / previous) * 100)
}

function pctLabel(value: number | null) {
  if (value == null) return 'sin comparativo'
  return `${value > 0 ? '+' : ''}${value}% vs. ano anterior`
}

function meterWidth(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`
}

export default function Dashboard({ onPendientesChange }: { onPendientesChange?: (n: number) => void }) {
  const [all, setAll] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fYear, setFYear] = useState('2026')
  const [fMes, setFMes] = useState('all')
  const [fUnidad, setFUnidad] = useState('all')

  const { hidden } = useHideNumbers()
  const barRef = useRef<HTMLCanvasElement>(null)
  const lineRef = useRef<HTMLCanvasElement>(null)
  const donutRef = useRef<HTMLCanvasElement>(null)
  const typeRef = useRef<HTMLCanvasElement>(null)
  const barChart = useRef<any>(null)
  const lineChart = useRef<any>(null)
  const donutChart = useRef<any>(null)
  const typeChart = useRef<any>(null)

  useEffect(() => {
    db.getDashboardStats().then(s => {
      const comprobantes = s.comprobantes || []
      setAll(comprobantes)
      const p = comprobantes.filter((c: any) => c.tipo?.startsWith('FACT') && c.estado === 'pendiente').length
      onPendientesChange?.(p)
    }).finally(() => setLoading(false))
  }, [onPendientesChange])

  const toNeto = (f: any) => {
    if (f.monto_usd) {
      if (!f.tipo_cambio) return 0
      if (f.neto_usd) return Math.round(f.neto_usd * f.tipo_cambio * 100) / 100
      return Math.round((f.monto_usd * f.tipo_cambio / 1.21) * 100) / 100
    }
    if (f.neto_ars) return f.neto_ars
    if (f.monto_ars) return Math.round((f.monto_ars / 1.21) * 100) / 100
    return 0
  }

  const toBruto = (f: any) => {
    if (f.monto_usd) return f.tipo_cambio ? Math.round(f.monto_usd * f.tipo_cambio * 100) / 100 : 0
    return f.monto_ars || 0
  }

  const filterFacturas = (year: string) => all.filter((c: any) => {
    if (!c.tipo?.startsWith('FACT') || c.estado === 'anulada') return false
    if (year !== 'all' && !c.fecha?.startsWith(year)) return false
    if (fMes !== 'all' && c.fecha?.slice(5, 7) !== fMes) return false
    if (fUnidad !== 'all' && c.persona !== fUnidad) return false
    return true
  })

  const facts = filterFacturas(fYear)
  const previousYear = String(Number(fYear) - 1)
  const factsPrevYear = YEARS.includes(previousYear) ? filterFacturas(previousYear) : []

  const totalNeto = facts.reduce((s: number, f: any) => s + toNeto(f), 0)
  const totalBruto = facts.reduce((s: number, f: any) => s + toBruto(f), 0)
  const totalIVA = totalBruto - totalNeto
  const totalUSD = facts.filter((f: any) => f.monto_usd).reduce((s: number, f: any) => s + (f.monto_usd || 0), 0)
  const totalNetoPrevYear = factsPrevYear.reduce((s: number, f: any) => s + toNeto(f), 0)
  const cobradas = facts.filter((f: any) => f.estado === 'cobrada').length
  const pendCount = facts.filter((f: any) => f.estado === 'pendiente').length
  const cobradoNeto = facts.filter((f: any) => f.estado === 'cobrada').reduce((s: number, f: any) => s + toNeto(f), 0)
  const montoPend = facts.filter((f: any) => f.estado === 'pendiente').reduce((s: number, f: any) => s + toNeto(f), 0)
  const pctCobrado = facts.length ? Math.round((cobradas / facts.length) * 100) : 0
  const pctCobradoMonto = totalNeto ? Math.round((cobradoNeto / totalNeto) * 100) : 0
  const avgTicket = facts.length ? totalNeto / facts.length : 0
  const usdCount = facts.filter((f: any) => f.monto_usd).length
  const usdShare = facts.length ? Math.round((usdCount / facts.length) * 100) : 0
  const yoyNeto = pctChange(totalNeto, totalNetoPrevYear)

  const byMes = new Array(12).fill(0)
  all.filter((c: any) => c.tipo?.startsWith('FACT') && c.estado !== 'anulada' && c.fecha?.startsWith(fYear) && (fUnidad === 'all' || c.persona === fUnidad))
    .forEach((f: any) => {
      const m = parseInt(f.fecha?.slice(5, 7) || '0') - 1
      if (m >= 0 && m < 12) byMes[m] += toNeto(f)
    })

  const cumulative = byMes.reduce((acc: number[], v, i) => {
    acc.push((acc[i - 1] || 0) + v)
    return acc
  }, [])
  const bestMonthValue = Math.max(...byMes)
  const bestMonth = bestMonthValue > 0 ? MESES[byMes.indexOf(bestMonthValue)] : '-'

  const byUnidad: Record<string, number> = {}
  facts.forEach((f: any) => { byUnidad[f.persona] = (byUnidad[f.persona] || 0) + toNeto(f) })
  const unidades = Object.entries(byUnidad).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])

  // Split por punto de venta (default '0002' para filas sin PV cargado)
  const byPV: Record<string, { neto: number; count: number; usd: number }> = {}
  facts.forEach((f: any) => {
    const pv = (f.punto_venta as string) || '0002'
    if (!byPV[pv]) byPV[pv] = { neto: 0, count: 0, usd: 0 }
    byPV[pv].neto  += toNeto(f)
    byPV[pv].count += 1
    byPV[pv].usd   += f.monto_usd || 0
  })
  const pvEntries = Object.entries(byPV).sort((a, b) => b[1].neto - a[1].neto)

  const byTipo: Record<string, number> = {}
  facts.forEach((f: any) => { byTipo[f.tipo] = (byTipo[f.tipo] || 0) + toNeto(f) })

  const byCliente: Record<string, number> = {}
  facts.forEach((f: any) => { byCliente[f.cliente] = (byCliente[f.cliente] || 0) + toNeto(f) })
  const topClientes = Object.entries(byCliente).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const topClientShare = topClientes[0] && totalNeto ? Math.round((topClientes[0][1] / totalNeto) * 100) : 0

  const consultoriaAll = facts.filter((f: any) => f.persona === 'CONSULTORIA')
  const consCobradas = consultoriaAll
    .filter((f: any) => f.estado === 'cobrada')
    .sort((a: any, b: any) => (b.fecha_cobro || b.fecha || '').localeCompare(a.fecha_cobro || a.fecha || ''))
  const consPendientes = consultoriaAll.filter((f: any) => f.estado === 'pendiente')
  const consCobradasARS = consCobradas.reduce((s: number, f: any) => s + (f.monto_ars || 0), 0)
  const consCobradasUSD = consCobradas.filter((f: any) => f.monto_usd).reduce((s: number, f: any) => s + (f.monto_usd || 0), 0)
  const consNetoCobrado = consCobradas.reduce((s: number, f: any) => s + toNeto(f), 0)

  // Quincena breakdown: agrupar consultoriaAll por quincena (1-15 / 16-31)
  const byQuincena: Record<string, { neto: number; count: number }> = {}
  consultoriaAll.forEach((f: any) => {
    if (!f.fecha) return
    const day  = parseInt(f.fecha.slice(8, 10))
    const mon  = f.fecha.slice(5, 7)
    const q    = day <= 15 ? '1' : '2'
    const key  = `${mon}-Q${q}`
    if (!byQuincena[key]) byQuincena[key] = { neto: 0, count: 0 }
    byQuincena[key].neto  += toNeto(f)
    byQuincena[key].count += 1
  })
  const quincenas = Object.entries(byQuincena)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => {
      const [mon, q] = key.split('-Q')
      const mesIdx = parseInt(mon) - 1
      return { label: `${MESES[mesIdx]} ${q === '1' ? '1–15' : '16–31'}`, neto: v.neto, count: v.count }
    })
  const maxQNeto = Math.max(...quincenas.map(q => q.neto), 1)

  const monthLabel = fMes === 'all' ? 'Todos los meses' : MESES[Number(fMes) - 1]
  const unitLabel = fUnidad === 'all' ? 'Todas las unidades' : fUnidad
  const selectedLabel = `${fYear} · ${monthLabel} · ${unitLabel}`
  const activeFilters = [fMes !== 'all', fUnidad !== 'all'].filter(Boolean).length

  useEffect(() => {
    if (loading || typeof window === 'undefined') return
    import('chart.js/auto').then(({ default: Chart }) => {
      const ACCENT = '#C8102E'
      const BLUE = '#60a5fa'
      const GREEN = '#22c55e'
      const AMBER = '#f59e0b'
      const PURPLE = '#a78bfa'
      const TEAL = '#2dd4bf'
      const GRID = 'rgba(255,255,255,0.07)'
      const TEXT = '#a8a8b4'
      const defaults = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(16,16,20,0.96)',
            borderColor: 'rgba(255,255,255,0.12)',
            borderWidth: 1,
            titleColor: '#fff',
            bodyColor: '#d7d7df',
            padding: 10,
          },
        },
      }

      if (barRef.current) {
        barChart.current?.destroy()
        barChart.current = new Chart(barRef.current, {
          type: 'bar',
          data: {
            labels: MESES,
            datasets: [{
              data: byMes.map(v => Math.round(v / 1000000)),
              backgroundColor: byMes.map((_, i) => fMes !== 'all' && String(i + 1).padStart(2, '0') === fMes ? ACCENT : 'rgba(200,16,46,0.42)'),
              borderColor: byMes.map((_, i) => fMes !== 'all' && String(i + 1).padStart(2, '0') === fMes ? '#ff5f78' : ACCENT),
              borderWidth: 1,
              borderRadius: 7,
              borderSkipped: false,
            }],
          },
          options: {
            ...defaults,
            scales: {
              x: { grid: { display: false }, ticks: { color: TEXT, font: { size: 10 } } },
              y: { grid: { color: GRID }, ticks: { color: TEXT, font: { size: 10 }, callback: (v: any) => `$${v}M` } },
            },
            plugins: { ...defaults.plugins, tooltip: { ...defaults.plugins.tooltip, callbacks: { label: (ctx: any) => ` Neto: $${ctx.raw}M` } } },
          },
        })
      }
      if (lineRef.current) {
        lineChart.current?.destroy()
        lineChart.current = new Chart(lineRef.current, {
          type: 'line',
          data: {
            labels: MESES,
            datasets: [{
              data: cumulative.map(v => Math.round(v / 1000000)),
              borderColor: BLUE,
              backgroundColor: 'rgba(96,165,250,0.12)',
              borderWidth: 2,
              fill: true,
              tension: 0.38,
              pointBackgroundColor: '#fff',
              pointBorderColor: BLUE,
              pointBorderWidth: 2,
              pointRadius: 3,
            }],
          },
          options: {
            ...defaults,
            scales: {
              x: { grid: { display: false }, ticks: { color: TEXT, font: { size: 10 } } },
              y: { grid: { color: GRID }, ticks: { color: TEXT, font: { size: 10 }, callback: (v: any) => `$${v}M` } },
            },
          },
        })
      }
      if (donutRef.current) {
        donutChart.current?.destroy()
        donutChart.current = new Chart(donutRef.current, {
          type: 'doughnut',
          data: {
            labels: ['Cobradas', 'Pendientes'],
            datasets: [{
              data: [cobradas, pendCount],
              backgroundColor: ['rgba(34,197,94,0.82)', 'rgba(245,158,11,0.78)'],
              borderColor: ['#22c55e', '#f59e0b'],
              borderWidth: 1,
            }],
          },
          options: {
            ...defaults,
            cutout: '74%',
            plugins: { legend: { display: true, position: 'bottom' as const, labels: { color: TEXT, font: { size: 11 }, padding: 12, boxWidth: 10 } } },
          },
        })
      }
      if (typeRef.current) {
        typeChart.current?.destroy()
        const tipoLabels = Object.keys(byTipo)
        const tipoVals = Object.values(byTipo).map(v => Math.round(v / 1000000))
        const colors = [`${ACCENT}cc`, `${BLUE}cc`, `${AMBER}cc`, `${PURPLE}cc`, `${TEAL}cc`]
        typeChart.current = new Chart(typeRef.current, {
          type: 'doughnut',
          data: {
            labels: tipoLabels,
            datasets: [{ data: tipoVals, backgroundColor: colors.slice(0, tipoLabels.length), borderWidth: 1 }],
          },
          options: {
            ...defaults,
            cutout: '68%',
            plugins: { legend: { display: true, position: 'bottom' as const, labels: { color: TEXT, font: { size: 10 }, padding: 8, boxWidth: 10 } } },
          },
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
    <section className="dashboard-shell">
      <div className="dash-hero">
        <div className="dash-hero-main">
          <div className="dash-eyebrow">
            <span>Panel ejecutivo</span>
            <span className="dash-dot" />
            <span>{selectedLabel}</span>
          </div>
          <div className="dash-hero-title-row">
            <div>
              <h1 className="dash-title">Facturacion y cobranza</h1>
              <p className="dash-subtitle">
                Vista consolidada de facturas, cobros, unidades de negocio y concentracion comercial.
              </p>
            </div>
            <div className="dash-hero-badges">
              <span className="dash-soft-badge">{facts.length} facturas</span>
              <span className={`dash-soft-badge ${pctCobrado >= 75 ? 'success' : pctCobrado >= 45 ? 'warn' : 'danger'}`}>
                {pctCobrado}% cobradas
              </span>
            </div>
          </div>
          <div className="dash-hero-value">
            <span className={hidden ? 'num-hidden' : ''}>{ars(totalNeto)}</span>
            <small style={{ color: 'var(--text-primary)', opacity: 0.75 }}>Facturado neto &nbsp;·&nbsp; Bruto: <span className={hidden ? 'num-hidden' : ''}>{ars(totalBruto)}</span></small>
          </div>
          <div className="dash-hero-meter">
            <div className="dash-meter-track">
              <div className="dash-meter-fill" style={{ width: meterWidth(pctCobradoMonto) }} />
            </div>
            <div className="dash-meter-copy">
              <span>{pctCobradoMonto}% cobrado por monto neto</span>
              <span className={hidden ? 'num-hidden' : ''}>{ars(cobradoNeto)} cobrados</span>
            </div>
          </div>
        </div>

        <div className="dash-control-panel">
          <div className="dash-control-header">
            <span>Filtros</span>
            {activeFilters > 0 && <button className="btn btn-sm" onClick={() => { setFMes('all'); setFUnidad('all') }}>Limpiar</button>}
          </div>
          <div className="dash-filter-grid">
            <label>
              <span>Ano</span>
              <select value={fYear} onChange={e => setFYear(e.target.value)}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <label>
              <span>Mes</span>
              <select value={fMes} onChange={e => setFMes(e.target.value)}>
                <option value="all">Todos</option>
                {MESES.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
              </select>
            </label>
            <label className="wide">
              <span>Unidad</span>
              <select value={fUnidad} onChange={e => setFUnidad(e.target.value)}>
                <option value="all">Todas</option>
                {PERSONAS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          </div>
          <div className="dash-mini-insights">
            <div>
              <span>Ticket promedio</span>
              <strong className={hidden ? 'num-hidden' : ''}>{ars(avgTicket)}</strong>
            </div>
            <div>
              <span>Mejor mes</span>
              <strong>{bestMonth}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="dash-kpi-grid">
        <div className="dash-kpi primary">
          <span className="kpi-kicker">Facturado neto</span>
          <strong className={hidden ? 'num-hidden' : ''} style={{ fontSize: '1.6rem' }}>{ars(totalNeto)}</strong>
          <small>{pctLabel(yoyNeto)}</small>
        </div>
        <div className="dash-kpi">
          <span className="kpi-kicker">IVA estimado</span>
          <strong className={hidden ? 'num-hidden' : ''}>{ars(totalIVA)}</strong>
          <small>sobre {facts.length} comprobantes activos</small>
        </div>
        <div className="dash-kpi info">
          <span className="kpi-kicker">Facturado USD</span>
          <strong className={hidden ? 'num-hidden' : ''}>{usd(totalUSD)}</strong>
          <small>{usdCount} facturas · {usdShare}% del volumen</small>
        </div>
        <div className="dash-kpi warn">
          <span className="kpi-kicker">Pendiente neto</span>
          <strong className={hidden ? 'num-hidden' : ''}>{ars(montoPend)}</strong>
          <small>{pendCount} facturas por cobrar</small>
        </div>
        <div className="dash-kpi success">
          <span className="kpi-kicker">Cobranza</span>
          <strong>{pctCobrado}%</strong>
          <small>{cobradas} cobradas / {facts.length || 0} total</small>
        </div>
      </div>

      <div className="dash-main-grid">
        <div className="card dash-panel wide-panel">
          <div className="card-header">
            <span className="card-title">Facturacion neta mensual</span>
            <span className="card-hint">{fYear} · ARS millones</span>
          </div>
          <div className="dash-chart tall"><canvas ref={barRef} /></div>
        </div>
        <div className="card dash-panel">
          <div className="card-header">
            <span className="card-title">Estado de cobro</span>
            <span className="card-hint">cantidad</span>
          </div>
          <div className="dash-donut-wrap">
            <canvas ref={donutRef} />
            <div className="dash-donut-center">
              <strong>{pctCobrado}%</strong>
              <span>cobradas</span>
            </div>
          </div>
        </div>
      </div>

      <div className="dash-main-grid">
        <div className="card dash-panel wide-panel">
          <div className="card-header">
            <span className="card-title">Acumulado neto anual</span>
            <span className="card-hint">curva de avance</span>
          </div>
          <div className="dash-chart"><canvas ref={lineRef} /></div>
        </div>
        <div className="card dash-panel">
          <div className="card-header">
            <span className="card-title">Por tipo de factura</span>
            <span className="card-hint">ARS millones</span>
          </div>
          <div className="dash-chart compact"><canvas ref={typeRef} /></div>
        </div>
      </div>

      <div className="dash-analysis-grid">
        <div className="card dash-panel">
          <div className="card-header">
            <span className="card-title">Top clientes</span>
            <span className="card-hint">{topClientShare}% top 1</span>
          </div>
          <div className="dash-list">
            {topClientes.length === 0 ? (
              <div className="dash-empty">Sin datos para el filtro actual.</div>
            ) : topClientes.map(([cliente, v], i) => (
              <div key={cliente} className="dash-rank-row">
                <span className="dash-rank">{i + 1}</span>
                <div className="dash-rank-main">
                  <div className="dash-rank-label">
                    <span>{cliente}</span>
                    <strong className={hidden ? 'num-hidden' : ''}>{ars(v)}</strong>
                  </div>
                  <div className="dash-rank-track">
                    <div className="dash-rank-fill" style={{ width: meterWidth(topClientes[0][1] ? Math.round((v / topClientes[0][1]) * 100) : 0) }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card dash-panel">
          <div className="card-header">
            <span className="card-title">Unidades de negocio</span>
            <span className="card-hint">neto</span>
          </div>
          <div className="dash-list">
            {unidades.length === 0 ? (
              <div className="dash-empty">Sin unidades con facturacion.</div>
            ) : unidades.map(([p, v]) => (
              <div key={p} className="dash-unit-row">
                <div className="dash-unit-copy">
                  <span>{p}</span>
                  <strong className={hidden ? 'num-hidden' : ''}>{ars(v)}</strong>
                </div>
                <div className="dash-rank-track">
                  <div className="dash-rank-fill blue" style={{ width: meterWidth(totalNeto ? Math.round((v / totalNeto) * 100) : 0) }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card dash-panel">
          <div className="card-header">
            <span className="card-title">Lectura rapida</span>
            <span className="card-hint">senales</span>
          </div>
          <div className="dash-signal-list">
            <div className="dash-signal">
              <span className="signal-dot success" />
              <div>
                <strong>{pctCobradoMonto}% del neto ya esta cobrado</strong>
                <small className={hidden ? 'num-hidden' : ''}>{ars(cobradoNeto)} sobre {ars(totalNeto)}</small>
              </div>
            </div>
            <div className="dash-signal">
              <span className="signal-dot info" />
              <div>
                <strong>{usdShare}% de las facturas estan en USD</strong>
                <small>{usdCount} operaciones dolarizadas</small>
              </div>
            </div>
            <div className="dash-signal">
              <span className="signal-dot warn" />
              <div>
                <strong>{topClientShare}% concentrado en el principal cliente</strong>
                <small>{topClientes[0]?.[0] || 'Sin cliente principal'}</small>
              </div>
            </div>
            <div className="dash-signal">
              <span className="signal-dot danger" />
              <div>
                <strong>{pendCount} facturas pendientes</strong>
                <small className={hidden ? 'num-hidden' : ''}>{ars(montoPend)} neto por gestionar</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card dash-panel">
        <div className="card-header">
          <span className="card-title">Consultoria · facturas cobradas</span>
          <span className="card-hint">{consCobradas.length} cobradas · {consPendientes.length} pendientes · {fYear}</span>
        </div>
        <div className="dash-consultoria">
          <div className="dash-consultoria-summary">
            <div>
              <span>Cobradas</span>
              <strong className="text-success">{consCobradas.length}</strong>
              <small>de {consultoriaAll.length} facturas</small>
            </div>
            <div>
              <span>Total cobrado neto</span>
              <strong className={hidden ? 'num-hidden' : ''}>{ars(consNetoCobrado)}</strong>
              <small className={hidden ? 'num-hidden' : ''}>Bruto: {ars(consCobradasARS)}</small>
            </div>
            <div>
              <span>Cobrado USD</span>
              <strong className={hidden ? 'num-hidden' : ''}>{usd(consCobradasUSD)}</strong>
              <small>{consCobradas.filter((f: any) => f.monto_usd).length} en dolares</small>
            </div>
          </div>

          {consCobradas.length === 0 ? (
            <div className="dash-empty">Sin facturas de Consultoria cobradas en {fYear}.</div>
          ) : (
            <div className="table-wrap dash-table">
              <table>
                <thead>
                  <tr>
                    <th>Nro.</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Cliente</th>
                    <th>Fecha cobro</th>
                    <th className="text-right">ARS</th>
                    <th className="text-right">USD</th>
                  </tr>
                </thead>
                <tbody>
                  {consCobradas.slice(0, 15).map((f: any) => (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 600 }}>{f.numero || '-'}</td>
                      <td><TipoBadge tipo={f.tipo} /></td>
                      <td><EstadoBadge estado={f.estado} /></td>
                      <td className="dash-client-cell">{f.cliente}</td>
                      <td>{fdate(f.fecha_cobro || f.fecha)}</td>
                      <td className={`text-right text-mono${hidden ? ' num-hidden' : ''}`}>{ars(f.monto_ars)}</td>
                      <td className={`text-right text-mono${hidden ? ' num-hidden' : ''}`}>{usd(f.monto_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {consCobradas.length > 15 && (
                <div className="dash-table-footer">Mostrando 15 mas recientes de {consCobradas.length}</div>
              )}
            </div>
          )}

          {/* ── Quincena breakdown ── */}
          {quincenas.length > 0 && (
            <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
                Neto facturado por quincena — {fYear}
              </div>
              <div className="quincena-list">
                {quincenas.map(q => {
                  const pct = Math.round((q.neto / maxQNeto) * 100)
                  return (
                    <div key={q.label} className="quincena-row">
                      <div className="quincena-label">{q.label}</div>
                      <div className="quincena-track">
                        <div className="quincena-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <div className={`quincena-value${hidden ? ' num-hidden' : ''}`}>{ars(q.neto)}</div>
                      <div className="quincena-count">{q.count} fact.</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card dash-panel">
        <div className="card-header">
          <span className="card-title">Facturado por punto de venta</span>
          <span className="card-hint">{pvEntries.length} PV activos · {fYear}</span>
        </div>
        <div style={{ padding: '14px 16px' }}>
          {pvEntries.length === 0 ? (
            <div className="dash-empty">Sin facturas para {selectedLabel}.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {pvEntries.map(([pv, v]) => {
                const share = totalNeto > 0 ? Math.round((v.neto / totalNeto) * 100) : 0
                return (
                  <div key={pv} className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: pv === '0002' ? '#60a5fa' : '#f59e0b' }} />
                    <div className="metric-label">PV {pv}</div>
                    <div className={`metric-value${hidden ? ' num-hidden' : ''}`}>{ars(v.neto)}</div>
                    <div className="metric-sub">
                      {v.count} comprobantes · {share}% del neto
                      {v.usd > 0 && <> · <span className={hidden ? 'num-hidden' : ''}>{usd(v.usd)}</span></>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
