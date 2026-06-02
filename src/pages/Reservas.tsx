'use client'
import { useEffect, useState } from 'react'
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
  const [search,     setSearch]     = useState('')
  const [modal,      setModal]      = useState<'new'|'edit'|null>(null)
  const [sel,        setSel]        = useState<Reserva|null>(null)
  const [exporting,  setExporting]  = useState(false)

  const { hidden } = useHideNumbers()

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

  // Dashboard: use only year filter for overview
  const dashRows = anioFilt !== 'all' ? all.filter(r => r.fecha?.startsWith(anioFilt)) : all
  const empRows  = dashRows.filter(r => EMPRENDIMIENTOS_UNIDADES.includes(r.unidad))
  const resRows  = dashRows.filter(r => !EMPRENDIMIENTOS_UNIDADES.includes(r.unidad) && !COMERCIAL_UNIDADES.includes(r.unidad))
  const comRows  = dashRows.filter(r => COMERCIAL_UNIDADES.includes(r.unidad))

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
        {tab !== 'DASHBOARD' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn"
              style={{ background: '#0f9d58', borderColor: '#0f9d58', color: '#fff' }}
              onClick={exportToSheets}
              disabled={exporting}
            >
              {exporting ? '⏳ Exportando...' : '📊 Exportar a Sheets'}
            </button>
            <button className="btn btn-primary" style={{ background:'#1a6bc8', borderColor:'#1a6bc8' }} onClick={() => setModal('new')}>
              + Nueva reserva
            </button>
          </div>
        )}
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
          {/* Filtros del dashboard */}
          <div className="dash-filters" style={{ marginBottom:20 }}>
            <label>Año</label>
            <select value={anioFilt} onChange={e => setAnioFilt(e.target.value)}>
              <option value="all">Todos</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
            <span className="filter-sep"/>
            <label>Mes</label>
            <select value={mesFilt} onChange={e => setMesFilt(e.target.value)}>
              <option value="all">Todos</option>
              {MESES.map(m => <option key={m.num} value={m.num}>{m.label}</option>)}
            </select>
            {(mesFilt !== 'all') && (
              <button className="btn btn-sm" onClick={() => setMesFilt('all')}>Limpiar</button>
            )}
          </div>

          {/* KPIs */}
          <div className="metrics-grid" style={{ marginBottom:20 }}>
            <div className="metric-card" style={{ borderColor:'rgba(26,107,200,0.4)', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'#1a6bc8' }}/>
              <div className="metric-label">Total Reservas</div>
              <div className="metric-value">{dashRows.length}</div>
              <div className="metric-sub">{dashRows.filter(r=>r.operacion==='VENTA').length} ventas · {dashRows.filter(r=>r.operacion==='ALQUILER').length} alquileres</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Emprendimientos</div>
              <div className="metric-value">{empRows.length}</div>
              <div className="metric-sub">{empRows.filter(r=>r.operacion==='VENTA').length}V · {empRows.filter(r=>r.operacion==='ALQUILER').length}A</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Residencial</div>
              <div className="metric-value">{resRows.length}</div>
              <div className="metric-sub">{resRows.filter(r=>r.operacion==='VENTA').length}V · {resRows.filter(r=>r.operacion==='ALQUILER').length}A</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Comercial</div>
              <div className="metric-value">{comRows.length}</div>
              <div className="metric-sub">{comRows.filter(r=>r.operacion==='VENTA').length}V · {comRows.filter(r=>r.operacion==='ALQUILER').length}A</div>
            </div>
          </div>

          {/* 3 tablas */}
          <ResumenTable titulo="Emprendimientos" rows={empRows} unidades={EMPRENDIMIENTOS_UNIDADES} mesFilt={mesFilt} />
          <ResumenTable titulo="Residencial — Plataformas" rows={resRows} unidades={RESIDENCIAL_UNIDADES} mesFilt={mesFilt} />
          <ResumenTable titulo="Comercial" rows={comRows} unidades={COMERCIAL_UNIDADES} mesFilt={mesFilt} />
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
                        <td style={{ maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', fontWeight:500 }}>{r.direccion}</td>
                        <td style={{ fontSize:11.5, color:'var(--text-secondary)' }}>{r.broker||'—'}</td>
                        <td style={{ fontSize:11.5 }}>{r.cliente||'—'}</td>
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

      {modal==='new' && <ReservaModal tab={tab as any} onClose={()=>setModal(null)} onSaved={()=>{setModal(null);load()}} />}
      {modal==='edit' && sel && <ReservaModal tab={tab as any} reserva={sel} onClose={()=>{setModal(null);setSel(null)}} onSaved={()=>{setModal(null);setSel(null);load()}} />}
    </>
  )
}

// ── Tabla resumen por unidad ──────────────────────────────────
function ResumenTable({ titulo, rows, unidades, mesFilt }: {
  titulo: string; rows: Reserva[]; unidades: string[]; mesFilt: string
}) {
  if (!rows.length) return null

  // Get months that have data
  const mesesConDatos = Array.from(new Set(rows.map(r => r.fecha?.slice(0,7)))).filter(Boolean).sort()
  const mesesFiltrados = mesFilt !== 'all'
    ? mesesConDatos.filter(m => m?.slice(5,7) === mesFilt)
    : mesesConDatos

  function count(unidad: string, mes: string, op: string) {
    return rows.filter(r => r.unidad===unidad && r.fecha?.slice(0,7)===mes && r.operacion===op).length
  }
  function countAll(unidad: string, op: string) {
    return rows.filter(r => r.unidad===unidad && r.operacion===op).length
  }

  return (
    <div className="card" style={{ marginBottom:20 }}>
      <div className="card-header">
        <span className="card-title">{titulo}</span>
        <span className="card-hint">
          {rows.filter(r=>r.operacion==='VENTA').length} ventas · {rows.filter(r=>r.operacion==='ALQUILER').length} alquileres
        </span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ minWidth:160 }}>Unidad</th>
              {mesesFiltrados.map(m => (
                <th key={m} className="text-right" colSpan={2}
                  style={{ borderLeft:'1px solid var(--border)', fontSize:10 }}>
                  {m?.slice(5,7)}/{m?.slice(2,4)}
                </th>
              ))}
              <th className="text-right" colSpan={2} style={{ borderLeft:'1px solid var(--border)', background:'var(--bg-tertiary)', fontSize:10 }}>
                TOTAL
              </th>
            </tr>
            <tr>
              <th style={{ fontSize:9 }}></th>
              {mesesFiltrados.map(m => (<>
                <th key={`${m}v`} style={{ fontSize:9, color:'var(--danger)', borderLeft:'1px solid var(--border)', textAlign:'right' }}>V</th>
                <th key={`${m}a`} style={{ fontSize:9, color:'var(--info)', textAlign:'right' }}>A</th>
              </>))}
              <th style={{ fontSize:9, color:'var(--danger)', borderLeft:'1px solid var(--border)', textAlign:'right', background:'var(--bg-tertiary)' }}>V</th>
              <th style={{ fontSize:9, color:'var(--info)', textAlign:'right', background:'var(--bg-tertiary)' }}>A</th>
            </tr>
          </thead>
          <tbody>
            {unidades.map(u => {
              const totalV = countAll(u,'VENTA')
              const totalA = countAll(u,'ALQUILER')
              if (totalV + totalA === 0) return null
              return (
                <tr key={u}>
                  <td style={{ fontWeight:500, fontSize:12 }}>{u}</td>
                  {mesesFiltrados.map(m => {
                    const v = count(u, m!, 'VENTA')
                    const a = count(u, m!, 'ALQUILER')
                    return (<>
                      <td key={`${u}${m}v`} className="text-right" style={{ borderLeft:'1px solid var(--border)', color: v>0?'var(--danger)':'var(--text-tertiary)', fontWeight: v>0?600:400 }}>{v||'—'}</td>
                      <td key={`${u}${m}a`} className="text-right" style={{ color: a>0?'var(--info)':'var(--text-tertiary)', fontWeight: a>0?600:400 }}>{a||'—'}</td>
                    </>)
                  })}
                  <td className="text-right" style={{ borderLeft:'1px solid var(--border)', color:'var(--danger)', fontWeight:700, background:'var(--bg-secondary)' }}>{totalV||'—'}</td>
                  <td className="text-right" style={{ color:'var(--info)', fontWeight:700, background:'var(--bg-secondary)' }}>{totalA||'—'}</td>
                </tr>
              )
            })}
            <tr style={{ background:'var(--bg-secondary)' }}>
              <td style={{ fontWeight:700, fontSize:12 }}>TOTAL</td>
              {mesesFiltrados.map(m => {
                const v = rows.filter(r=>r.fecha?.slice(0,7)===m&&r.operacion==='VENTA').length
                const a = rows.filter(r=>r.fecha?.slice(0,7)===m&&r.operacion==='ALQUILER').length
                return (<>
                  <td key={`tot${m}v`} className="text-right" style={{ borderLeft:'1px solid var(--border)', fontWeight:700, color:'var(--danger)' }}>{v||'—'}</td>
                  <td key={`tot${m}a`} className="text-right" style={{ fontWeight:700, color:'var(--info)' }}>{a||'—'}</td>
                </>)
              })}
              <td className="text-right" style={{ borderLeft:'1px solid var(--border)', fontWeight:700, color:'var(--danger)' }}>{rows.filter(r=>r.operacion==='VENTA').length}</td>
              <td className="text-right" style={{ fontWeight:700, color:'var(--info)' }}>{rows.filter(r=>r.operacion==='ALQUILER').length}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ padding:'6px 16px', fontSize:11, color:'var(--text-tertiary)' }}>
        <span style={{ color:'var(--danger)', fontWeight:600 }}>V</span> = Ventas &nbsp;·&nbsp;
        <span style={{ color:'var(--info)', fontWeight:600 }}>A</span> = Alquileres
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
