'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ars, usd, fdate, today } from '@/lib/utils'
import { Spinner, Modal, FG, toast } from '@/components/ui'
import { useHideNumbers } from '@/components/HideNumbers'

type Tab = 'DASHBOARD' | 'EMPRENDIMIENTOS' | 'RESIDENCIAL' | 'COMERCIAL'
type Operacion = 'all' | 'VENTA' | 'ALQUILER'
type FirmoFilter = 'all' | 'PENDIENTE' | 'FIRMADO'
type Periodo = 'semana' | 'mes' | 'trimestre' | 'anio' | 'all'

export interface Reserva {
  id: number
  proa_codigo: string | null
  tipo_inmueble: string | null
  direccion: string
  precio_publicado: number | null
  operacion: string
  precio_reserva: number | null
  estado_reserva: string | null
  modo_pago: string | null
  // legacy
  fecha: string
  broker: string | null
  cliente: string | null
  unidad: string
  monto_ars: number | null
  monto_usd: number | null
  firmo: string
}

const EMPRENDIMIENTOS_UNIDADES = ['EMPRENDIMIENTOS']
const RESIDENCIAL_UNIDADES = [
  'PLAT. PALERMO','PLAT. BELGRANO','PLAT. CABALLITO','PLAT. RECOLETA',
  'PLAT. BARILOCHE','PLAT. ANGOSTURA','PLAT. PILAR','PLAT. CANNING',
  'DPTO DE BÚSQUEDA',
]
const COMERCIAL_UNIDADES = ['OFICINAS Y EDIFICIOS','LOCALES Y TERRENOS','CONSULTORIA','INDUSTRIA','TAP']

const UNIDADES_BY_TAB: Record<string, string[]> = {
  EMPRENDIMIENTOS: EMPRENDIMIENTOS_UNIDADES,
  RESIDENCIAL: RESIDENCIAL_UNIDADES,
  COMERCIAL: COMERCIAL_UNIDADES,
}

const MESES = [
  {num:'01',label:'Enero'},{num:'02',label:'Febrero'},{num:'03',label:'Marzo'},
  {num:'04',label:'Abril'},{num:'05',label:'Mayo'},{num:'06',label:'Junio'},
  {num:'07',label:'Julio'},{num:'08',label:'Agosto'},{num:'09',label:'Septiembre'},
  {num:'10',label:'Octubre'},{num:'11',label:'Noviembre'},{num:'12',label:'Diciembre'},
]

export default function Reservas(_: any) {
  const [all,        setAll]        = useState<Reserva[]>([])
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState<Tab>('DASHBOARD')
  const [opFilt,     setOpFilt]     = useState<Operacion>('all')
  const [firmoFilt,  setFirmoFilt]  = useState<FirmoFilter>('all')
  const [unidadFilt, setUnidadFilt] = useState('all')
  const [mesFilt,    setMesFilt]    = useState('all')
  const [anioFilt,   setAnioFilt]   = useState('2026')
  const [periodo,    setPeriodo]    = useState<Periodo>('mes')
  const [search,     setSearch]     = useState('')
  const [modal,      setModal]      = useState<'new'|'edit'|null>(null)
  const [sel,        setSel]        = useState<Reserva|null>(null)
  const [exporting,  setExporting]  = useState(false)
  const [importing,  setImporting]  = useState(false)

  const { hidden } = useHideNumbers()

  async function importProaExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const resp = await fetch('/api/reservas/import-excel', { method: 'POST', body: fd })
      const json = await resp.json()
      if (json.ok) {
        toast(`✓ ${json.updated} reservas actualizadas con Precio Reserva`)
        load()
      } else {
        toast('Error al importar: ' + (json.error || 'desconocido'))
      }
    } catch {
      toast('Error al importar')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  async function exportToSheets() {
    setExporting(true)
    try {
      const resp = await fetch('/api/reservas/export-sheets', { method: 'POST' })
      const json = await resp.json()
      if (json.url) {
        window.open(json.url, '_blank')
        toast('Sheet creado con ' + json.total + ' reservas')
      } else {
        toast('Error al exportar: ' + (json.error || 'desconocido'))
      }
    } catch {
      toast('Error al exportar')
    } finally {
      setExporting(false)
    }
  }

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('reservas').select('*').order('fecha', { ascending: false })
    if (error) toast('Error cargando reservas')
    setAll(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  useEffect(() => { setUnidadFilt('all') }, [tab])

  // Compute dashRows based on selected period
  function getPeriodoRows(rows: Reserva[]): Reserva[] {
    const now = new Date()
    if (periodo === 'semana') {
      const day = now.getDay() === 0 ? 6 : now.getDay() - 1 // Monday=0
      const mon = new Date(now); mon.setDate(now.getDate() - day); mon.setHours(0,0,0,0)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23,59,59,999)
      const from = mon.toISOString().slice(0,10)
      const to   = sun.toISOString().slice(0,10)
      return rows.filter(r => r.fecha >= from && r.fecha <= to)
    }
    if (periodo === 'mes') {
      const y = now.getFullYear().toString()
      const m = String(now.getMonth() + 1).padStart(2,'0')
      return rows.filter(r => r.fecha?.startsWith(`${y}-${m}`))
    }
    if (periodo === 'trimestre') {
      const y = now.getFullYear()
      const q = Math.floor(now.getMonth() / 3)
      const mStart = q * 3
      const months = [0,1,2].map(i => `${y}-${String(mStart + i + 1).padStart(2,'0')}`)
      return rows.filter(r => months.some(m => r.fecha?.startsWith(m)))
    }
    if (periodo === 'anio') {
      return rows.filter(r => r.fecha?.startsWith(now.getFullYear().toString()))
    }
    return rows // 'all'
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta reserva?')) return
    await supabase.from('reservas').delete().eq('id', id)
    toast('Reserva eliminada'); load()
  }

  function getBaseRows(t: Tab) {
    let rows = all
    if (t === 'EMPRENDIMIENTOS') rows = all.filter(r => EMPRENDIMIENTOS_UNIDADES.includes(r.unidad))
    else if (t === 'RESIDENCIAL') rows = all.filter(r => !EMPRENDIMIENTOS_UNIDADES.includes(r.unidad) && !COMERCIAL_UNIDADES.includes(r.unidad))
    else if (t === 'COMERCIAL')   rows = all.filter(r => COMERCIAL_UNIDADES.includes(r.unidad))
    return rows
  }

  // Apply all filters
  function applyFilters(rows: Reserva[]) {
    if (anioFilt !== 'all')    rows = rows.filter(r => r.fecha?.startsWith(anioFilt))
    if (mesFilt !== 'all')     rows = rows.filter(r => r.fecha?.slice(5,7) === mesFilt)
    if (unidadFilt !== 'all')  rows = rows.filter(r => r.unidad === unidadFilt)
    if (opFilt !== 'all')      rows = rows.filter(r => r.operacion === opFilt)
    if (firmoFilt !== 'all')   rows = rows.filter(r => r.firmo === firmoFilt)
    if (search) rows = rows.filter(r =>
      r.direccion?.toLowerCase().includes(search.toLowerCase()) ||
      r.broker?.toLowerCase().includes(search.toLowerCase()) ||
      r.cliente?.toLowerCase().includes(search.toLowerCase())
    )
    return rows.sort((a,b) => (b.fecha||'').localeCompare(a.fecha||''))
  }

  const tabData = applyFilters(getBaseRows(tab))

  // Dashboard: filtered by period selector
  const dashRows = getPeriodoRows(all)
  const empRows  = dashRows.filter(r => EMPRENDIMIENTOS_UNIDADES.includes(r.unidad))
  const resRows  = dashRows.filter(r => RESIDENCIAL_UNIDADES.includes(r.unidad))
  const comRows  = dashRows.filter(r => COMERCIAL_UNIDADES.includes(r.unidad))

  function sumaARS(rows: Reserva[]) { return rows.reduce((s,r) => s + (r.monto_ars||0), 0) }
  function sumaUSD(rows: Reserva[]) { return rows.reduce((s,r) => s + (r.monto_usd||0), 0) }

  const TABS = [
    { id: 'DASHBOARD' as Tab,       label: '◈ Dashboard' },
    { id: 'EMPRENDIMIENTOS' as Tab,  label: 'Emprendimientos' },
    { id: 'RESIDENCIAL' as Tab,      label: 'Residencial' },
    { id: 'COMERCIAL' as Tab,        label: 'Comercial' },
  ]

  const unidadesDisponibles = tab !== 'DASHBOARD' ? (UNIDADES_BY_TAB[tab] || []) : []

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Módulo de Reservas</h2>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{all.length} reservas registradas</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn"
            style={{ background: '#0f9d58', borderColor: '#0f9d58', color: '#fff' }}
            onClick={exportToSheets}
            disabled={exporting}
          >
            {exporting ? '⏳ Exportando...' : '📊 Exportar a Sheets'}
          </button>
          <label
            className="btn"
            style={{ background: importing ? '#555' : '#7b2d8b', borderColor: '#7b2d8b', color: '#fff', cursor: 'pointer' }}
          >
            {importing ? '⏳ Importando...' : '📥 Importar Excel PROA'}
            <input type="file" accept=".xlsx" style={{ display: 'none' }} onChange={importProaExcel} disabled={importing} />
          </label>
          {tab !== 'DASHBOARD' && (
            <button className="btn btn-primary" style={{ background:'#1a6bc8', borderColor:'#1a6bc8' }} onClick={() => setModal('new')}>
              + Nueva reserva
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', marginBottom:20 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'10px 20px', fontSize:13, fontWeight: tab===t.id ? 600 : 400,
            cursor:'pointer', background:'none', border:'none',
            color: tab===t.id ? '#6eb3ff' : 'var(--text-secondary)',
            borderBottom: tab===t.id ? '2px solid #1a6bc8' : '2px solid transparent',
            marginBottom:-1, whiteSpace:'nowrap',
          }}>
            {t.label}
            {t.id !== 'DASHBOARD' && (
              <span style={{ marginLeft:6, fontSize:11, color:'var(--text-tertiary)' }}>
                ({getBaseRows(t.id).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === 'DASHBOARD' && (
        loading ? <Spinner /> : <>
          {/* Selector de período */}
          <div className="dash-filters" style={{ marginBottom:20, alignItems:'center' }}>
            {(['semana','mes','trimestre','anio','all'] as Periodo[]).map(p => {
              const labels: Record<Periodo,string> = { semana:'Esta semana', mes:'Este mes', trimestre:'Este trimestre', anio:'Este año', all:'Todo' }
              return (
                <button
                  key={p}
                  className={`btn btn-sm${periodo===p?' btn-primary':''}`}
                  style={periodo===p ? { background:'#1a6bc8', borderColor:'#1a6bc8', color:'#fff' } : {}}
                  onClick={() => setPeriodo(p)}
                >{labels[p]}</button>
              )
            })}
          </div>

          {/* KPIs por unidad de negocio */}
          <div className="metrics-grid" style={{ marginBottom:20 }}>
            <div className="metric-card" style={{ borderColor:'rgba(26,107,200,0.4)', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'#1a6bc8' }}/>
              <div className="metric-label">Total Reservas</div>
              <div className={`metric-value${hidden?' num-hidden':''}`} style={{ fontSize:16 }}>{ars(sumaARS(dashRows))}</div>
              <div className={`metric-sub${hidden?' num-hidden':''}`}>{usd(sumaUSD(dashRows))} · {dashRows.length} reservas</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Emprendimientos</div>
              <div className={`metric-value${hidden?' num-hidden':''}`} style={{ fontSize:16 }}>{ars(sumaARS(empRows))}</div>
              <div className={`metric-sub${hidden?' num-hidden':''}`}>{usd(sumaUSD(empRows))} · {empRows.length} res.</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Residencial</div>
              <div className={`metric-value${hidden?' num-hidden':''}`} style={{ fontSize:16 }}>{ars(sumaARS(resRows))}</div>
              <div className={`metric-sub${hidden?' num-hidden':''}`}>{usd(sumaUSD(resRows))} · {resRows.length} res.</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Comercial</div>
              <div className={`metric-value${hidden?' num-hidden':''}`} style={{ fontSize:16 }}>{ars(sumaARS(comRows))}</div>
              <div className={`metric-sub${hidden?' num-hidden':''}`}>{usd(sumaUSD(comRows))} · {comRows.length} res.</div>
            </div>
          </div>

          {/* 3 tablas con montos */}
          <ResumenTable titulo="Emprendimientos" rows={empRows} unidades={EMPRENDIMIENTOS_UNIDADES} hidden={hidden} />
          <ResumenTable titulo="Residencial — Plataformas" rows={resRows} unidades={RESIDENCIAL_UNIDADES} hidden={hidden} />
          <ResumenTable titulo="Comercial" rows={comRows} unidades={COMERCIAL_UNIDADES} hidden={hidden} />
        </>
      )}

      {/* ── LISTADO ── */}
      {tab !== 'DASHBOARD' && (
        <>
          <div className="toolbar">
            <input placeholder="Buscar dirección, broker, cliente…" value={search} onChange={e=>setSearch(e.target.value)} />
            <select value={anioFilt} onChange={e=>setAnioFilt(e.target.value)}>
              <option value="all">Todos los años</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
            <select value={mesFilt} onChange={e=>setMesFilt(e.target.value)}>
              <option value="all">Todos los meses</option>
              {MESES.map(m=><option key={m.num} value={m.num}>{m.label}</option>)}
            </select>
            {unidadesDisponibles.length > 1 && (
              <select value={unidadFilt} onChange={e=>setUnidadFilt(e.target.value)}>
                <option value="all">Todas las unidades</option>
                {unidadesDisponibles.map(u=><option key={u} value={u}>{u}</option>)}
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
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'#1a6bc8' }}/>
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

          {loading ? <Spinner /> : (
            <div className="card">
              <div className="card-header">
                <span className="card-title">{tabData.length} reservas</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Código PROA</th>
                      <th>Tipo</th>
                      <th>Dirección</th>
                      <th className="text-right">Precio Publicado</th>
                      <th>Estado Reserva</th>
                      <th className="text-right">Precio Reserva</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabData.length === 0 ? (
                      <tr><td colSpan={7} className="empty-row">Sin reservas</td></tr>
                    ) : tabData.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontSize:11, color:'var(--text-tertiary)', fontFamily:'monospace' }}>{r.proa_codigo||'—'}</td>
                        <td style={{ fontSize:11.5, color:'var(--text-secondary)' }}>{r.tipo_inmueble||'—'}</td>
                        <td style={{ maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', fontWeight:500 }}>{r.direccion}</td>
                        <td className={`text-right text-mono${hidden?' num-hidden':''}`} style={{ fontSize:12 }}>
                          {r.precio_publicado ? usd(r.precio_publicado) : '—'}
                        </td>
                        <td>
                          <span className={`badge ${r.estado_reserva==='Reservada'?'badge-green': r.firmo==='FIRMADO'?'badge-green':'badge-amber'}`}>
                            {r.estado_reserva || r.firmo || '—'}
                          </span>
                        </td>
                        <td className={`text-right text-mono${hidden?' num-hidden':''}`} style={{ fontWeight:700, fontSize:13 }}>
                          {r.precio_reserva ? usd(r.precio_reserva) : (r.monto_usd ? usd(r.monto_usd) : r.monto_ars ? ars(r.monto_ars) : '—')}
                        </td>
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

      {modal==='new' && <ReservaModal tab={tab as any} onClose={()=>setModal(null)} onSaved={()=>{setModal(null);load()}} />}
      {modal==='edit' && sel && <ReservaModal tab={tab as any} reserva={sel} onClose={()=>{setModal(null);setSel(null)}} onSaved={()=>{setModal(null);setSel(null);load()}} />}
    </>
  )
}

// ── Tabla resumen por unidad (montos) ────────────────────────
function ResumenTable({ titulo, rows, unidades, hidden }: {
  titulo: string; rows: Reserva[]; unidades: string[]; hidden?: boolean
}) {
  if (!rows.length) return null

  function uARS(unidad: string) {
    return rows.filter(r => r.unidad === unidad).reduce((s,r) => s + (r.monto_ars||0), 0)
  }
  function uUSD(unidad: string) {
    return rows.filter(r => r.unidad === unidad).reduce((s,r) => s + (r.monto_usd||0), 0)
  }
  function uCount(unidad: string) {
    return rows.filter(r => r.unidad === unidad).length
  }

  const totalARS = rows.reduce((s,r) => s + (r.monto_ars||0), 0)
  const totalUSD = rows.reduce((s,r) => s + (r.monto_usd||0), 0)

  const unidadesConDatos = unidades.filter(u => uCount(u) > 0)
  if (!unidadesConDatos.length) return null

  return (
    <div className="card" style={{ marginBottom:20 }}>
      <div className="card-header">
        <span className="card-title">{titulo}</span>
        <span className="card-hint">{rows.length} reservas</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ minWidth:180 }}>Sub-unidad</th>
              <th className="text-right">Reservas</th>
              <th className="text-right">Monto ARS</th>
              <th className="text-right">Monto USD</th>
              <th className="text-right" style={{ fontSize:10, color:'var(--text-tertiary)' }}>% del total</th>
            </tr>
          </thead>
          <tbody>
            {unidadesConDatos.map(u => {
              const arsVal = uARS(u)
              const usdVal = uUSD(u)
              const cnt    = uCount(u)
              const share  = totalARS > 0 && arsVal > 0 ? Math.round((arsVal / totalARS) * 100) : (totalUSD > 0 && usdVal > 0 ? Math.round((usdVal / totalUSD) * 100) : 0)
              return (
                <tr key={u}>
                  <td style={{ fontWeight:500, fontSize:12 }}>{u}</td>
                  <td className="text-right" style={{ color:'var(--text-secondary)', fontSize:12 }}>{cnt}</td>
                  <td className={`text-right text-mono${hidden?' num-hidden':''}`} style={{ fontWeight: arsVal>0?600:400, color: arsVal>0?'var(--text-primary)':'var(--text-tertiary)' }}>
                    {arsVal > 0 ? ars(arsVal) : '—'}
                  </td>
                  <td className={`text-right text-mono${hidden?' num-hidden':''}`} style={{ fontWeight: usdVal>0?600:400, color: usdVal>0?'var(--info)':'var(--text-tertiary)' }}>
                    {usdVal > 0 ? usd(usdVal) : '—'}
                  </td>
                  <td className="text-right" style={{ fontSize:11 }}>
                    {share > 0 ? (
                      <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'flex-end' }}>
                        <div style={{ width:48, height:4, background:'var(--bg-tertiary)', borderRadius:2, overflow:'hidden' }}>
                          <div style={{ width:`${share}%`, height:'100%', background:'#1a6bc8', borderRadius:2 }} />
                        </div>
                        <span style={{ color:'var(--text-tertiary)', minWidth:28 }}>{share}%</span>
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ background:'var(--bg-secondary)', borderTop:'1px solid var(--border)' }}>
              <td style={{ fontWeight:700, fontSize:12 }}>TOTAL</td>
              <td className="text-right" style={{ fontWeight:700 }}>{rows.length}</td>
              <td className={`text-right text-mono${hidden?' num-hidden':''}`} style={{ fontWeight:700 }}>{totalARS > 0 ? ars(totalARS) : '—'}</td>
              <td className={`text-right text-mono${hidden?' num-hidden':''}`} style={{ fontWeight:700, color:'var(--info)' }}>{totalUSD > 0 ? usd(totalUSD) : '—'}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}


// ── Modal ─────────────────────────────────────────────────────
function ReservaModal({ tab, reserva, onClose, onSaved }: {
  tab: 'EMPRENDIMIENTOS'|'RESIDENCIAL'|'COMERCIAL'
  reserva?: Reserva; onClose:()=>void; onSaved:()=>void
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
        broker: broker.trim()||null, cliente: cliente.trim()||null,
        operacion: op, unidad: unidad||unidades[0],
        monto_ars: arsV?parseFloat(arsV):null,
        monto_usd: usdV?parseFloat(usdV):null,
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
      toast('Error: '+(e.message||''))
    } finally { setSaving(false) }
  }

  return (
    <Modal
      title={isEdit ? `Editar — ${reserva?.direccion?.slice(0,30)}` : `Nueva reserva — ${tab.charAt(0)+tab.slice(1).toLowerCase()}`}
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" style={{ background:'#1a6bc8', borderColor:'#1a6bc8' }} onClick={save} disabled={saving}>
          {saving?'Guardando…':isEdit?'Guardar cambios':'Crear reserva'}
        </button>
      </>}
    >
      <div className="form-grid">
        <FG label="Fecha *"><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></FG>
        <FG label="Operación *">
          <select value={op} onChange={e=>setOp(e.target.value)}>
            <option value="VENTA">Venta</option>
            <option value="ALQUILER">Alquiler</option>
          </select>
        </FG>
        <FG label="Dirección *" full><input placeholder="Ej: Av. Santa Fe 1234 3° A" value={dir} onChange={e=>setDir(e.target.value)}/></FG>
        <FG label="Broker"><input placeholder="Nombre del broker" value={broker} onChange={e=>setBroker(e.target.value)}/></FG>
        <FG label="Cliente"><input placeholder="Nombre del cliente" value={cliente} onChange={e=>setCliente(e.target.value)}/></FG>
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
        <FG label="Monto ARS"><input type="number" min="0" placeholder="0" value={arsV} onChange={e=>setArs(e.target.value)}/></FG>
        <FG label="Monto USD"><input type="number" min="0" placeholder="0" value={usdV} onChange={e=>setUsd(e.target.value)}/></FG>
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
