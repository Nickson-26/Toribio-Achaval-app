'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { ars, usd, fdate, today } from '@/lib/utils'
import { Spinner, Modal, FG, toast } from '@/components/ui'
import { useHideNumbers } from '@/components/HideNumbers'

type Tab = 'DASHBOARD' | 'EMPRENDIMIENTOS' | 'RESIDENCIAL' | 'COMERCIAL'
type Operacion = 'all' | 'VENTA' | 'ALQUILER'
type FirmoFilter = 'all' | 'PENDIENTE' | 'FIRMADO'

export interface Reserva {
  id: number
  fecha: string
  direccion: string
  broker: string | null
  cliente: string | null
  operacion: string
  unidad: string
  monto_ars: number | null
  monto_usd: number | null
  modo_pago: string | null
  firmo: string
}

const EMPRENDIMIENTOS_UNIDADES = ['EMPRENDIMIENTOS']
const RESIDENCIAL_UNIDADES = ['DPTO DE BÚSQUEDA','PLAT. BELGRANO','PLAT. CABALLITO','PLAT. PALERMO','PLAT. RECOLETA']
const COMERCIAL_UNIDADES = ['CONSULTORIA','LOCALES Y TERRENOS','OFICINAS Y EDIFICIOS']

const UNIDADES_BY_TAB: Record<string, string[]> = {
  EMPRENDIMIENTOS: EMPRENDIMIENTOS_UNIDADES,
  RESIDENCIAL: RESIDENCIAL_UNIDADES,
  COMERCIAL: COMERCIAL_UNIDADES,
}

const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function Reservas(_: any) {
  const [all,        setAll]        = useState<Reserva[]>([])
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState<Tab>('DASHBOARD')
  const [opFilt,     setOpFilt]     = useState<Operacion>('all')
  const [firmoFilt,  setFirmoFilt]  = useState<FirmoFilter>('all')
  const [unidadFilt, setUnidadFilt] = useState('all')
  const [search,     setSearch]     = useState('')
  const [modal,      setModal]      = useState<'new'|'edit'|null>(null)
  const [sel,        setSel]        = useState<Reserva|null>(null)
  const barRef   = useRef<HTMLCanvasElement>(null)
  const barChart = useRef<any>(null)

  const { hidden } = useHideNumbers()

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('reservas').select('*').order('fecha', { ascending: false })
    if (error) { console.error(error); toast('Error cargando reservas') }
    setAll(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Reset unidad filter when tab changes
  useEffect(() => { setUnidadFilt('all') }, [tab])

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta reserva?')) return
    await supabase.from('reservas').delete().eq('id', id)
    toast('Reserva eliminada')
    load()
  }

  function getBaseRows(t: Tab) {
    if (t === 'EMPRENDIMIENTOS') return all.filter(r => EMPRENDIMIENTOS_UNIDADES.includes(r.unidad))
    if (t === 'RESIDENCIAL')     return all.filter(r => !EMPRENDIMIENTOS_UNIDADES.includes(r.unidad) && !COMERCIAL_UNIDADES.includes(r.unidad))
    if (t === 'COMERCIAL')       return all.filter(r => COMERCIAL_UNIDADES.includes(r.unidad))
    return all
  }

  function getTabData(t: Tab) {
    let rows = getBaseRows(t)
    if (t !== 'DASHBOARD') {
      if (unidadFilt !== 'all') rows = rows.filter(r => r.unidad === unidadFilt)
      if (opFilt !== 'all')     rows = rows.filter(r => r.operacion === opFilt)
      if (firmoFilt !== 'all')  rows = rows.filter(r => r.firmo === firmoFilt)
      if (search) rows = rows.filter(r =>
        r.direccion?.toLowerCase().includes(search.toLowerCase()) ||
        r.broker?.toLowerCase().includes(search.toLowerCase()) ||
        r.cliente?.toLowerCase().includes(search.toLowerCase())
      )
    }
    return rows.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
  }

  const tabData = getTabData(tab)

  // Dashboard metrics
  const totalARS  = all.reduce((s, r) => s + (r.monto_ars || 0), 0)
  const totalUSD  = all.reduce((s, r) => s + (r.monto_usd || 0), 0)
  const ventas    = all.filter(r => r.operacion === 'VENTA').length
  const alquis    = all.filter(r => r.operacion === 'ALQUILER').length
  const firmadas  = all.filter(r => r.firmo === 'FIRMADO').length
  const pendCount = all.filter(r => r.firmo === 'PENDIENTE').length

  // By broker
  const byBroker: Record<string, number> = {}
  all.forEach(r => { const b = r.broker || 'Sin broker'; byBroker[b] = (byBroker[b] || 0) + 1 })
  const topBrokers = Object.entries(byBroker).sort((a, b) => b[1] - a[1]).slice(0, 6)

  // Ventas/Alquileres por unidad por mes (para la tabla mensual)
  function getMonthlyByUnidad(rows: Reserva[]) {
    // Get unique unidades in these rows
    const unidades = Array.from(new Set(rows.map(r => r.unidad))).filter(Boolean).sort()
    // Get months that have data
    const mesesConDatos = Array.from(new Set(rows.map(r => r.fecha?.slice(0,7)))).filter(Boolean).sort()

    return { unidades, meses: mesesConDatos }
  }

  // Chart
  useEffect(() => {
    if (tab !== 'DASHBOARD' || loading || typeof window === 'undefined') return
    import('chart.js/auto').then(({ default: Chart }) => {
      if (!barRef.current) return
      barChart.current?.destroy()
      barChart.current = new Chart(barRef.current, {
        type: 'bar',
        data: {
          labels: MESES_CORTOS,
          datasets: [
            {
              label: 'Ventas',
              data: Array.from({length:12}, (_,i) => all.filter(r => r.operacion==='VENTA' && parseInt(r.fecha?.slice(5,7)||'0')-1===i).length),
              backgroundColor: 'rgba(200,16,46,0.7)', borderRadius: 3,
            },
            {
              label: 'Alquileres',
              data: Array.from({length:12}, (_,i) => all.filter(r => r.operacion==='ALQUILER' && parseInt(r.fecha?.slice(5,7)||'0')-1===i).length),
              backgroundColor: 'rgba(96,165,250,0.7)', borderRadius: 3,
            }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#a8a8a8', font: { size: 10 } } },
            y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#a8a8a8', font: { size: 10 } }, beginAtZero: true }
          },
          plugins: { legend: { labels: { color: '#a8a8a8', font: { size: 11 }, padding: 12 } } }
        }
      })
    })
    return () => barChart.current?.destroy()
  }, [tab, loading, all])

  const TABS: { id: Tab; label: string }[] = [
    { id: 'DASHBOARD',       label: '◈ Dashboard' },
    { id: 'EMPRENDIMIENTOS', label: 'Emprendimientos' },
    { id: 'RESIDENCIAL',     label: 'Residencial' },
    { id: 'COMERCIAL',       label: 'Comercial' },
  ]

  // Unidades disponibles para el tab actual
  const unidadesDisponibles = tab !== 'DASHBOARD' ? (UNIDADES_BY_TAB[tab] || []) : []

  return (
    <>
      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Módulo de Reservas</h2>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{all.length} reservas registradas · {firmadas} firmadas</p>
        </div>
        {tab !== 'DASHBOARD' && (
          <button className="btn btn-primary" style={{ background: '#1a6bc8', borderColor: '#1a6bc8' }}
            onClick={() => setModal('new')}>+ Nueva reserva</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 20px', fontSize: 13, fontWeight: tab===t.id ? 600 : 400,
            cursor: 'pointer', background: 'none', border: 'none',
            color: tab===t.id ? '#6eb3ff' : 'var(--text-secondary)',
            borderBottom: tab===t.id ? '2px solid #1a6bc8' : '2px solid transparent',
            marginBottom: -1, transition: 'color .1s', whiteSpace: 'nowrap',
          }}>
            {t.label}
            {t.id !== 'DASHBOARD' && (
              <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
                ({getBaseRows(t.id).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* DASHBOARD */}
      {tab === 'DASHBOARD' && (
        loading ? <Spinner /> : <>
          <div className="metrics-grid">
            <div className="metric-card" style={{ borderColor: 'rgba(26,107,200,0.4)', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'#1a6bc8' }} />
              <div className="metric-label">Total Reservas</div>
              <div className="metric-value">{all.length}</div>
              <div className="metric-sub">{ventas} ventas · {alquis} alquileres</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Monto ARS</div>
              <div className={`metric-value${hidden?' num-hidden':''}`}>{ars(totalARS)}</div>
              <div className="metric-sub">reservas en pesos</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Monto USD</div>
              <div className={`metric-value${hidden?' num-hidden':''}`}>{usd(totalUSD)}</div>
              <div className="metric-sub">reservas en dólares</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Firmadas</div>
              <div className="metric-value" style={{ color: firmadas > 0 ? 'var(--success)' : 'var(--text-tertiary)' }}>{firmadas}</div>
              <div className="metric-sub">{pendCount} pendientes</div>
            </div>
          </div>

          <div className="two-col">
            <div className="card">
              <div className="card-header"><span className="card-title">Reservas mensuales 2026</span></div>
              <div style={{ padding: '12px 16px 16px', height: 200 }}>
                <canvas ref={barRef} />
              </div>
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">Top brokers</span></div>
              <div style={{ padding: '12px 16px' }}>
                {topBrokers.map(([broker, count]) => (
                  <div key={broker} className="progress-row" style={{ marginBottom: 8 }}>
                    <span className="progress-label">{broker}</span>
                    <div className="progress-track">
                      <div style={{ height:6, borderRadius:3, background:'#1a6bc8', width:`${Math.round((count/topBrokers[0][1])*100)}%` }} />
                    </div>
                    <span style={{ fontSize:11, color:'var(--text-secondary)', minWidth:30, textAlign:'right' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Resumen por módulo */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:16 }}>
            {(['EMPRENDIMIENTOS','RESIDENCIAL','COMERCIAL'] as Tab[]).map(t => {
              const d = getBaseRows(t)
              const v = d.filter(r=>r.operacion==='VENTA').length
              const a = d.filter(r=>r.operacion==='ALQUILER').length
              const usdT = d.reduce((s,r)=>s+(r.monto_usd||0),0)
              const arsT = d.reduce((s,r)=>s+(r.monto_ars||0),0)
              return (
                <div key={t} className="card" style={{ cursor:'pointer' }} onClick={()=>setTab(t)}>
                  <div className="card-header">
                    <span className="card-title">{t.charAt(0)+t.slice(1).toLowerCase()}</span>
                    <span className="card-hint">{d.length} reservas</span>
                  </div>
                  <div style={{ padding:'12px 16px' }}>
                    <div className="sum-row"><span>Ventas</span><span style={{fontWeight:500}}>{v}</span></div>
                    <div className="sum-row"><span>Alquileres</span><span style={{fontWeight:500}}>{a}</span></div>
                    {arsT > 0 && <div className="sum-row"><span>ARS</span><span className={hidden?'num-hidden':''}>{ars(arsT)}</span></div>}
                    {usdT > 0 && <div className="sum-row"><span>USD</span><span className={hidden?'num-hidden':''}>{usd(usdT)}</span></div>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Tabla mensual por unidad — TODAS LAS UNIDADES */}
          <TablaUnidadMes rows={all} titulo="Ventas y Alquileres por Unidad por Mes" />
        </>
      )}

      {/* LISTING TABS */}
      {tab !== 'DASHBOARD' && (
        <>
          <div className="toolbar">
            <input placeholder="Buscar dirección, broker, cliente…" value={search} onChange={e=>setSearch(e.target.value)} />

            {/* Filtro por unidad — solo si el tab tiene múltiples unidades */}
            {unidadesDisponibles.length > 1 && (
              <select value={unidadFilt} onChange={e=>setUnidadFilt(e.target.value)} style={{ width: 200 }}>
                <option value="all">Todas las unidades</option>
                {unidadesDisponibles.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            )}

            <select value={opFilt} onChange={e=>setOpFilt(e.target.value as Operacion)}>
              <option value="all">Venta + Alquiler</option>
              <option value="VENTA">Solo Ventas</option>
              <option value="ALQUILER">Solo Alquileres</option>
            </select>
            <select value={firmoFilt} onChange={e=>setFirmoFilt(e.target.value as FirmoFilter)}>
              <option value="all">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="FIRMADO">Firmado</option>
            </select>
          </div>

          <div className="metrics-grid" style={{ gridTemplateColumns:'repeat(4,minmax(0,1fr))', marginBottom:16 }}>
            <div className="metric-card" style={{ borderColor:'rgba(26,107,200,0.4)', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'#1a6bc8' }} />
              <div className="metric-label">Total</div>
              <div className="metric-value">{tabData.length}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Ventas</div>
              <div className="metric-value">{tabData.filter(r=>r.operacion==='VENTA').length}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Alquileres</div>
              <div className="metric-value">{tabData.filter(r=>r.operacion==='ALQUILER').length}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Pendientes firma</div>
              <div className="metric-value" style={{ color:'var(--warn)' }}>{tabData.filter(r=>r.firmo==='PENDIENTE').length}</div>
            </div>
          </div>

          {/* Tabla mensual por unidad para este tab */}
          <TablaUnidadMes
            rows={getBaseRows(tab)}
            titulo={`Ventas y Alquileres por Unidad — ${tab.charAt(0)+tab.slice(1).toLowerCase()}`}
          />

          {loading ? <Spinner /> : (
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  {tab.charAt(0)+tab.slice(1).toLowerCase()}
                  {unidadFilt !== 'all' ? ` — ${unidadFilt}` : ''} · {tabData.length} reservas
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th><th>Dirección</th><th>Broker</th><th>Cliente</th>
                      <th>Tipo</th><th>Unidad</th>
                      <th className="text-right">ARS</th><th className="text-right">USD</th>
                      <th>Pago</th><th>Estado</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabData.length === 0 ? (
                      <tr><td colSpan={11} className="empty-row">Sin reservas</td></tr>
                    ) : tabData.map(r => (
                      <tr key={r.id}>
                        <td>{fdate(r.fecha)}</td>
                        <td style={{ maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', fontWeight:500 }}>{r.direccion}</td>
                        <td style={{ fontSize:11.5, color:'var(--text-secondary)' }}>{r.broker || '—'}</td>
                        <td style={{ fontSize:11.5 }}>{r.cliente || '—'}</td>
                        <td><span className={`badge ${r.operacion==='VENTA'?'badge-red':'badge-blue'}`}>{r.operacion}</span></td>
                        <td style={{ fontSize:11, color:'var(--text-tertiary)' }}>{r.unidad}</td>
                        <td className="text-right text-mono">{ars(r.monto_ars)}</td>
                        <td className="text-right text-mono">{usd(r.monto_usd)}</td>
                        <td style={{ fontSize:11 }}>{r.modo_pago}</td>
                        <td><span className={`badge ${r.firmo==='FIRMADO'?'badge-green':'badge-amber'}`}>{r.firmo}</span></td>
                        <td>
                          <div style={{ display:'flex', gap:4 }}>
                            <button className="btn btn-sm" onClick={()=>{setSel(r);setModal('edit')}}>Editar</button>
                            <button className="btn btn-sm btn-danger" onClick={()=>handleDelete(r.id)}>Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {modal==='new' && (
        <ReservaModal tab={tab as any} onClose={()=>setModal(null)} onSaved={()=>{setModal(null);load()}} />
      )}
      {modal==='edit' && sel && (
        <ReservaModal tab={tab as any} reserva={sel} onClose={()=>{setModal(null);setSel(null)}} onSaved={()=>{setModal(null);setSel(null);load()}} />
      )}
    </>
  )
}

// ── Tabla mensual por unidad ──────────────────────────────────
function TablaUnidadMes({ rows, titulo }: { rows: Reserva[]; titulo: string }) {
  const unidades = Array.from(new Set(rows.map(r => r.unidad))).filter(Boolean).sort()
  const meses    = Array.from(new Set(rows.map(r => r.fecha?.slice(0,7)))).filter(Boolean).sort()

  if (!unidades.length || !meses.length) return null

  // Count ventas and alquileres per unidad per mes
  function getCount(unidad: string, mes: string, op: string) {
    return rows.filter(r => r.unidad === unidad && r.fecha?.slice(0,7) === mes && r.operacion === op).length
  }
  function getTotal(unidad: string, op: string) {
    return rows.filter(r => r.unidad === unidad && r.operacion === op).length
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header"><span className="card-title">{titulo}</span></div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: 160 }}>Unidad</th>
              {meses.map(m => (
                <th key={m} className="text-right" colSpan={2} style={{ borderLeft: '1px solid var(--border)' }}>
                  {m.slice(5,7)}/{m.slice(2,4)}
                </th>
              ))}
              <th className="text-right" style={{ borderLeft: '1px solid var(--border)' }} colSpan={2}>Total</th>
            </tr>
            <tr>
              <th style={{ fontSize: 9, color: 'var(--text-tertiary)' }}></th>
              {meses.map(m => (
                <>
                  <th key={`${m}-v`} className="text-right" style={{ fontSize: 9, color: 'var(--danger)', borderLeft: '1px solid var(--border)' }}>V</th>
                  <th key={`${m}-a`} className="text-right" style={{ fontSize: 9, color: 'var(--info)' }}>A</th>
                </>
              ))}
              <th className="text-right" style={{ fontSize: 9, color: 'var(--danger)', borderLeft: '1px solid var(--border)' }}>V</th>
              <th className="text-right" style={{ fontSize: 9, color: 'var(--info)' }}>A</th>
            </tr>
          </thead>
          <tbody>
            {unidades.map(u => (
              <tr key={u}>
                <td style={{ fontWeight: 500, fontSize: 12 }}>{u}</td>
                {meses.map(m => {
                  const v = getCount(u, m, 'VENTA')
                  const a = getCount(u, m, 'ALQUILER')
                  return (
                    <>
                      <td key={`${u}-${m}-v`} className="text-right" style={{ borderLeft: '1px solid var(--border)', color: v > 0 ? 'var(--danger)' : 'var(--text-tertiary)', fontWeight: v > 0 ? 600 : 400 }}>{v || '—'}</td>
                      <td key={`${u}-${m}-a`} className="text-right" style={{ color: a > 0 ? 'var(--info)' : 'var(--text-tertiary)', fontWeight: a > 0 ? 600 : 400 }}>{a || '—'}</td>
                    </>
                  )
                })}
                <td className="text-right" style={{ borderLeft: '1px solid var(--border)', color: 'var(--danger)', fontWeight: 600 }}>{getTotal(u,'VENTA') || '—'}</td>
                <td className="text-right" style={{ color: 'var(--info)', fontWeight: 600 }}>{getTotal(u,'ALQUILER') || '—'}</td>
              </tr>
            ))}
            {/* Totals row */}
            <tr style={{ background: 'var(--bg-secondary)' }}>
              <td style={{ fontWeight: 700, fontSize: 12 }}>TOTAL</td>
              {meses.map(m => {
                const v = rows.filter(r => r.fecha?.slice(0,7)===m && r.operacion==='VENTA').length
                const a = rows.filter(r => r.fecha?.slice(0,7)===m && r.operacion==='ALQUILER').length
                return (
                  <>
                    <td key={`tot-${m}-v`} className="text-right" style={{ borderLeft: '1px solid var(--border)', fontWeight: 700, color: 'var(--danger)' }}>{v || '—'}</td>
                    <td key={`tot-${m}-a`} className="text-right" style={{ fontWeight: 700, color: 'var(--info)' }}>{a || '—'}</td>
                  </>
                )
              })}
              <td className="text-right" style={{ borderLeft: '1px solid var(--border)', fontWeight: 700, color: 'var(--danger)' }}>{rows.filter(r=>r.operacion==='VENTA').length}</td>
              <td className="text-right" style={{ fontWeight: 700, color: 'var(--info)' }}>{rows.filter(r=>r.operacion==='ALQUILER').length}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--text-tertiary)' }}>
        <span style={{ color: 'var(--danger)', fontWeight: 600 }}>V</span> = Ventas &nbsp;·&nbsp;
        <span style={{ color: 'var(--info)', fontWeight: 600 }}>A</span> = Alquileres
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────
function ReservaModal({ tab, reserva, onClose, onSaved }: {
  tab: 'EMPRENDIMIENTOS'|'RESIDENCIAL'|'COMERCIAL'
  reserva?: Reserva; onClose: ()=>void; onSaved: ()=>void
}) {
  const isEdit = !!reserva
  const [saving,  setSaving]  = useState(false)
  const [fecha,   setFecha]   = useState(reserva?.fecha || today())
  const [dir,     setDir]     = useState(reserva?.direccion || '')
  const [broker,  setBroker]  = useState(reserva?.broker || '')
  const [cliente, setCliente] = useState(reserva?.cliente || '')
  const [op,      setOp]      = useState(reserva?.operacion || 'VENTA')
  const [unidad,  setUnidad]  = useState(reserva?.unidad || '')
  const [arsV,    setArs]     = useState(String(reserva?.monto_ars || ''))
  const [usdV,    setUsd]     = useState(String(reserva?.monto_usd || ''))
  const [pago,    setPago]    = useState(reserva?.modo_pago || 'EFECTIVO')
  const [firmo,   setFirmo]   = useState(reserva?.firmo || 'PENDIENTE')

  const unidades = UNIDADES_BY_TAB[tab] || [tab]

  async function save() {
    if (!dir.trim()) { toast('La dirección es obligatoria'); return }
    setSaving(true)
    try {
      const payload = {
        fecha, direccion: dir.trim(),
        broker: broker.trim() || null, cliente: cliente.trim() || null,
        operacion: op, unidad: unidad || unidades[0],
        monto_ars: arsV ? parseFloat(arsV) : null,
        monto_usd: usdV ? parseFloat(usdV) : null,
        modo_pago: pago, firmo,
      }
      if (isEdit && reserva) {
        await supabase.from('reservas').update(payload).eq('id', reserva.id)
        toast('✓ Reserva actualizada')
      } else {
        await supabase.from('reservas').insert(payload)
        toast('✓ Reserva creada')
      }
      onSaved()
    } catch (e: any) {
      toast('Error: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  return (
    <Modal
      title={isEdit ? `Editar — ${reserva?.direccion?.slice(0,30)}` : `Nueva reserva — ${tab.charAt(0)+tab.slice(1).toLowerCase()}`}
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" style={{ background:'#1a6bc8', borderColor:'#1a6bc8' }} onClick={save} disabled={saving}>
          {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear reserva'}
        </button>
      </>}
    >
      <div className="form-grid">
        <FG label="Fecha *"><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} /></FG>
        <FG label="Operación *">
          <select value={op} onChange={e=>setOp(e.target.value)}>
            <option value="VENTA">Venta</option>
            <option value="ALQUILER">Alquiler</option>
          </select>
        </FG>
        <FG label="Dirección *" full>
          <input placeholder="Ej: Av. Santa Fe 1234 3° A" value={dir} onChange={e=>setDir(e.target.value)} />
        </FG>
        <FG label="Broker"><input placeholder="Nombre del broker" value={broker} onChange={e=>setBroker(e.target.value)} /></FG>
        <FG label="Cliente"><input placeholder="Nombre del cliente" value={cliente} onChange={e=>setCliente(e.target.value)} /></FG>
        <FG label="Unidad">
          <select value={unidad} onChange={e=>setUnidad(e.target.value)}>
            {unidades.map(u=><option key={u} value={u}>{u}</option>)}
          </select>
        </FG>
        <FG label="Forma de pago">
          <select value={pago} onChange={e=>setPago(e.target.value)}>
            {['EFECTIVO','TRANSFERENCIA','CHEQUE','OTRO'].map(p=><option key={p}>{p}</option>)}
          </select>
        </FG>
        <FG label="Monto ARS"><input type="number" min="0" placeholder="0" value={arsV} onChange={e=>setArs(e.target.value)} /></FG>
        <FG label="Monto USD"><input type="number" min="0" placeholder="0" value={usdV} onChange={e=>setUsd(e.target.value)} /></FG>
        <FG label="Estado firma">
          <select value={firmo} onChange={e=>setFirmo(e.target.value)}>
            <option value="PENDIENTE">Pendiente</option>
            <option value="FIRMADO">Firmado</option>
          </select>
        </FG>
      </div>
    </Modal>
  )
}
