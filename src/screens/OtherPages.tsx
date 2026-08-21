'use client'
import { useEffect, useState, useCallback } from 'react'
import { db, Recibo, Comprobante } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { ars, usd, fdate, montoARS, PERSONAS, today, downloadCSV, MESES, TODOS_TIPOS, PUNTOS_VENTA, PUNTO_VENTA_DEFAULT } from '@/lib/utils'
import { TipoBadge, Spinner, Modal, FG, toast } from '@/components/ui'
import { discriminaIVA, desdeNeto } from '@/lib/fiscal'

// ══════════════════════════════════════════════════════════════
// RECIBOS
// ══════════════════════════════════════════════════════════════
export function Recibos(_: any) {
  const [data,    setData]    = useState<Recibo[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [modal,   setModal]   = useState<'new'|'edit'|null>(null)
  const [sel,     setSel]     = useState<Recibo|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await db.getRecibos(search || undefined)) }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: number) {
    if (!confirm(`¿Eliminar recibo ${id}? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase.from('recibos').delete().eq('id', id)
    if (error) { toast('Error al eliminar'); return }
    toast(`Recibo ${id} eliminado`)
    load()
  }

  async function handleSaveEdit(patch: Partial<Recibo>) {
    if (!sel) return
    const { error } = await supabase.from('recibos').update(patch).eq('id', sel.id)
    if (error) { toast('Error al guardar'); return }
    toast('✓ Recibo actualizado')
    setModal(null); setSel(null); load()
  }

  const totARS = data.reduce((s,r)=>s+(r.monto_ars||0),0)
  const totUSD = data.reduce((s,r)=>s+(r.monto_usd||0),0)

  return (
    <>
      <div className="toolbar">
        <input placeholder="Buscar cliente, N° recibo…" value={search} onChange={e=>setSearch(e.target.value)} />
        <button className="btn" onClick={()=>downloadCSV([['N° Recibo','Fecha','Cliente','Facturas','Persona','Forma pago','ARS','USD'],...data.map(r=>[r.id,r.fecha,r.cliente,r.recibo_comprobantes?.length?r.recibo_comprobantes.map(rc=>rc.comprobante_id).join(' | '):r.nro_fact,r.persona,r.forma_pago,r.monto_ars,r.monto_usd])],'recibos.csv')}>↓ CSV</button>
        <button className="btn btn-primary" onClick={()=>setModal('new')}>+ Nuevo recibo</button>
      </div>
      <div className="metrics-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}>
        <div className="metric-card"><div className="metric-label">Total recibos</div><div className="metric-value">{data.length}</div></div>
        <div className="metric-card"><div className="metric-label">Cobrado ARS</div><div className="metric-value">{ars(totARS)}</div></div>
        <div className="metric-card"><div className="metric-label">Cobrado USD</div><div className="metric-value">{usd(totUSD)}</div></div>
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">Recibos ({data.length})</span></div>
        {loading ? <Spinner /> : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>N° Recibo</th><th>Fecha</th><th>Cliente</th><th>N° Fact.</th>
                <th>Persona</th><th>Forma pago</th>
                <th className="text-right">ARS</th><th className="text-right">USD</th><th></th>
              </tr></thead>
              <tbody>
                {data.map(r=>(
                  <tr key={r.id}>
                    <td style={{fontWeight:500,color:'var(--accent-text)'}}>{r.id}</td>
                    <td>{fdate(r.fecha)}</td><td>{r.cliente}</td>
                    <td className="text-dim" style={{fontSize:11}}>
                      {r.recibo_comprobantes && r.recibo_comprobantes.length > 0
                        ? r.recibo_comprobantes.length === 1
                          ? r.recibo_comprobantes[0].comprobante_id
                          : <span title={r.recibo_comprobantes.map(rc=>rc.comprobante_id).join('\n')}>
                              {r.recibo_comprobantes[0].comprobante_id}{' '}
                              <span style={{color:'var(--accent-text)',fontWeight:600}}>+{r.recibo_comprobantes.length-1}</span>
                            </span>
                        : r.nro_fact || '—'}
                    </td>
                    <td className="text-dim" style={{fontSize:11.5}}>{r.persona}</td>
                    <td><span className="badge badge-gray">{r.forma_pago||'—'}</span></td>
                    <td className="text-right text-mono" style={{fontWeight:500}}>{ars(r.monto_ars)}</td>
                    <td className="text-right text-mono">{usd(r.monto_usd)}</td>
                    <td>
                      <div style={{display:'flex',gap:4}}>
                        <button className="btn btn-sm" onClick={()=>{setSel(r);setModal('edit')}}>Editar</button>
                        <button className="btn btn-sm btn-danger" onClick={()=>handleDelete(r.id)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {modal==='new' && <NuevoReciboModal onClose={()=>setModal(null)} onSaved={()=>{setModal(null);load()}} />}
      {modal==='edit' && sel && <EditarReciboModal recibo={sel} onClose={()=>{setModal(null);setSel(null)}} onSaved={handleSaveEdit} />}
    </>
  )
}

// ── Multi-select de facturas pendientes ───────────────────────
function FacturasMultiSelect({
  selected, onAdd, onRemove
}: {
  selected: Comprobante[]
  onAdd: (c: Comprobante) => void
  onRemove: (id: string) => void
}) {
  const [query,    setQuery]    = useState('')
  const [options,  setOptions]  = useState<Comprobante[]>([])
  const [open,     setOpen]     = useState(false)
  const [fetching, setFetching] = useState(false)
  const [hovId,    setHovId]    = useState<string|null>(null)

  useEffect(() => {
    setFetching(true)
    const t = setTimeout(async () => {
      let q = supabase
        .from('comprobantes')
        .select('id,tipo,numero,fecha,cliente,monto_ars,monto_usd,persona,punto_venta')
        .eq('estado', 'pendiente')
        .order('fecha', { ascending: false })
        .limit(30)
      if (query.trim()) q = q.or(`cliente.ilike.%${query}%,id.ilike.%${query}%`)
      const { data } = await q
      setOptions((data || []) as Comprobante[])
      setFetching(false)
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  return (
    <div style={{position:'relative'}}>
      {/* Chips de facturas seleccionadas */}
      {selected.length > 0 && (
        <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:8}}>
          {selected.map(c => (
            <span key={c.id} style={{display:'inline-flex',alignItems:'center',gap:4,background:'var(--accent-bg)',color:'var(--accent-text)',borderRadius:'var(--radius-sm)',padding:'3px 8px',fontSize:12,fontFamily:'var(--font-mono)'}}>
              {c.id}
              <span style={{fontFamily:'sans-serif',color:'var(--text-secondary)',fontSize:11,marginLeft:2}}>
                {c.monto_ars ? ars(c.monto_ars) : usd(c.monto_usd)}
              </span>
              <button onMouseDown={e=>{e.preventDefault();onRemove(c.id)}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-secondary)',padding:'0 2px',fontSize:14,lineHeight:1,fontFamily:'sans-serif'}}>×</button>
            </span>
          ))}
        </div>
      )}
      {/* Input de búsqueda */}
      <input
        value={query}
        onChange={e=>setQuery(e.target.value)}
        onFocus={()=>setOpen(true)}
        onBlur={()=>setTimeout(()=>setOpen(false),150)}
        placeholder={selected.length===0 ? 'Buscar factura pendiente por N° o cliente…' : 'Agregar otra factura…'}
      />
      {/* Dropdown */}
      {open && (
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'var(--bg-primary)',border:'1px solid var(--border)',borderRadius:'var(--radius)',zIndex:200,maxHeight:230,overflowY:'auto',boxShadow:'0 4px 24px rgba(0,0,0,.2)'}}>
          {fetching ? (
            <div style={{padding:'10px 14px',fontSize:12,color:'var(--text-tertiary)'}}>Buscando…</div>
          ) : options.length === 0 ? (
            <div style={{padding:'10px 14px',fontSize:12,color:'var(--text-tertiary)'}}>
              {query ? `Sin resultados para "${query}"` : 'Sin facturas pendientes'}
            </div>
          ) : options.map(c => {
            const isSel = selected.some(s=>s.id===c.id)
            return (
              <div
                key={c.id}
                onMouseDown={e=>{e.preventDefault();if(!isSel)onAdd(c)}}
                onMouseEnter={()=>setHovId(c.id)}
                onMouseLeave={()=>setHovId(null)}
                style={{
                  padding:'8px 14px',
                  cursor:isSel?'default':'pointer',
                  display:'flex',
                  justifyContent:'space-between',
                  alignItems:'center',
                  borderBottom:'1px solid var(--border)',
                  background:isSel?'var(--bg-secondary)':hovId===c.id?'var(--bg-secondary)':'transparent',
                  opacity:isSel?.65:1,
                }}
              >
                <span>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:11.5,fontWeight:600,color:'var(--accent-text)'}}>{c.id}</span>
                  <span style={{color:'var(--text-secondary)',marginLeft:8,fontSize:12}}>{c.cliente}</span>
                  <span style={{color:'var(--text-tertiary)',marginLeft:6,fontSize:11}}>{c.fecha}</span>
                </span>
                <span style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:12,fontWeight:500}}>
                    {c.monto_ars ? ars(c.monto_ars) : usd(c.monto_usd)}
                  </span>
                  {isSel && <span style={{color:'var(--success)',fontSize:13}}>✓</span>}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NuevoReciboModal({onClose,onSaved}:{onClose:()=>void;onSaved:()=>void}) {
  const [saving,       setSaving]       = useState(false)
  const [fecha,        setFecha]        = useState(today())
  const [cliente,      setCliente]      = useState('')
  const [persona,      setPersona]      = useState(PERSONAS[0])
  const [pago,         setPago]         = useState('transferencia')
  const [echeq,        setEcheq]        = useState('')
  const [arsV,         setArs]          = useState('')
  const [usdV,         setUsd]          = useState('')
  const [selectedComps,setSelectedComps]= useState<Comprobante[]>([])

  // Auto-completa cliente, persona y montos al seleccionar facturas
  useEffect(() => {
    if (selectedComps.length === 0) return
    if (!cliente && selectedComps[0]?.cliente) setCliente(selectedComps[0].cliente)
    if (persona === PERSONAS[0] && selectedComps[0]?.persona) setPersona(selectedComps[0].persona)
    const totalArs = selectedComps.reduce((s,c)=>s+(c.monto_ars||0),0)
    const totalUsd = selectedComps.reduce((s,c)=>s+(c.monto_usd||0),0)
    if (totalArs > 0) setArs(String(Math.round(totalArs*100)/100))
    if (totalUsd > 0) setUsd(String(Math.round(totalUsd*10000)/10000))
  }, [selectedComps]) // eslint-disable-line react-hooks/exhaustive-deps

  function addComp(c:Comprobante) { setSelectedComps(prev=>prev.some(s=>s.id===c.id)?prev:[...prev,c]) }
  function removeComp(id:string)  { setSelectedComps(prev=>prev.filter(c=>c.id!==id)) }

  async function save() {
    if (!cliente.trim()) return toast('El cliente es obligatorio')
    setSaving(true)
    try {
      const { data: last } = await supabase.from('recibos').select('id').order('id',{ascending:false}).limit(1)
      const nextId = last&&last[0] ? last[0].id+1 : 19200
      const comprobanteIds = selectedComps.map(c=>c.id)
      await db.createReciboConFacturas(
        {
          id: nextId, fecha,
          cliente: cliente.trim(),
          nro_fact: comprobanteIds[0] || null,  // primer ID para backward compat
          persona,
          forma_pago: pago,
          monto_ars: arsV ? parseFloat(arsV) : null,
          monto_usd: usdV ? parseFloat(usdV) : null,
          retencion: null,
          nro_echeq: echeq || null,
        },
        comprobanteIds
      )
      const msg = comprobanteIds.length > 1
        ? `✓ Recibo ${nextId} guardado — ${comprobanteIds.length} facturas cobradas`
        : `✓ Recibo ${nextId} guardado`
      toast(msg)
      onSaved()
    } catch(e:any) { toast('Error: '+(e.message||'')) } finally { setSaving(false) }
  }

  return (
    <Modal title="Nuevo Recibo" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Guardando…':'Guardar'}</button></>}>
      <div className="form-grid">
        <FG label="Fecha *"><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></FG>
        <FG label="Forma de pago">
          <select value={pago} onChange={e=>setPago(e.target.value)}>
            {['transferencia','cheque','e-cheq','efectivo'].map(p=><option key={p}>{p}</option>)}
          </select>
        </FG>
        <FG label="Facturas incluidas" full>
          <FacturasMultiSelect selected={selectedComps} onAdd={addComp} onRemove={removeComp}/>
          {selectedComps.length > 0 && (
            <span className="calc-hint">
              {selectedComps.length} factura{selectedComps.length>1?'s':''} seleccionada{selectedComps.length>1?'s':''} — montos auto-calculados (editables)
            </span>
          )}
        </FG>
        <FG label="Cliente *" full>
          <input value={cliente} onChange={e=>setCliente(e.target.value)} placeholder="Razón social"/>
        </FG>
        <FG label="Persona / Unidad">
          <select value={persona} onChange={e=>setPersona(e.target.value)}>
            {PERSONAS.map(p=><option key={p}>{p}</option>)}
          </select>
        </FG>
        {(pago==='cheque'||pago==='e-cheq') && (
          <FG label="N° E-Cheq / Cheque" full>
            <input value={echeq} onChange={e=>setEcheq(e.target.value)} placeholder="—"/>
          </FG>
        )}
        <FG label="Cobrado ARS">
          <input type="number" min="0" step="0.01" placeholder="0" value={arsV} onChange={e=>setArs(e.target.value)}/>
        </FG>
        <FG label="Cobrado USD">
          <input type="number" min="0" step="0.01" placeholder="0" value={usdV} onChange={e=>setUsd(e.target.value)}/>
        </FG>
      </div>
    </Modal>
  )
}

function EditarReciboModal({recibo,onClose,onSaved}:{recibo:Recibo;onClose:()=>void;onSaved:(p:Partial<Recibo>)=>void}) {
  const [saving,setSaving]=useState(false)
  const [fecha,setFecha]=useState(recibo.fecha||'')
  const [cliente,setCliente]=useState(recibo.cliente||'')
  const [nroFact,setNroFact]=useState(recibo.nro_fact||'')
  const [persona,setPersona]=useState(recibo.persona||PERSONAS[0])
  const [pago,setPago]=useState(recibo.forma_pago||'transferencia')
  const [arsV,setArs]=useState(String(recibo.monto_ars||''))
  const [usdV,setUsd]=useState(String(recibo.monto_usd||''))
  const [echeq,setEcheq]=useState(recibo.nro_echeq || '')

  function handleSave() {
    if (!cliente.trim()) { toast('El cliente es obligatorio'); return }
    setSaving(true)
    try {
      onSaved({
        fecha,
        cliente: cliente.trim(),
        nro_fact: nroFact.trim() || null,
        persona,
        forma_pago: pago,
        monto_ars: arsV ? parseFloat(arsV) : null,
        monto_usd: usdV ? parseFloat(usdV) : null,
        nro_echeq: echeq.trim() || null,
      })
    } finally { setSaving(false) }
  }

  return (
    <Modal title={`Editar Recibo ${recibo.id}`} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'Guardando…':'Guardar cambios'}</button>
      </>}>
      <div className="form-grid">
        {/* Datos generales */}
        <div className="form-section">Datos generales</div>
        <FG label="Fecha"><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></FG>
        <FG label="N° Factura asociada">
          <input value={nroFact} onChange={e=>setNroFact(e.target.value)} placeholder="Ej: FC-A-4086"/>
        </FG>
        <FG label="Cliente *" full><input value={cliente} onChange={e=>setCliente(e.target.value)} placeholder="Razón social"/></FG>
        <FG label="Persona / Unidad">
          <select value={persona} onChange={e=>setPersona(e.target.value)}>
            {PERSONAS.map(p=><option key={p}>{p}</option>)}
          </select>
        </FG>
        <FG label="Forma de pago">
          <select value={pago} onChange={e=>setPago(e.target.value)}>
            {['transferencia','cheque','e-cheq','efectivo'].map(p=><option key={p}>{p}</option>)}
          </select>
        </FG>
        {(pago==='cheque' || pago==='e-cheq') && (
          <FG label="N° E-Cheq / Cheque" full>
            <input value={echeq} onChange={e=>setEcheq(e.target.value)} placeholder="—"/>
          </FG>
        )}

        {/* Montos cobrados */}
        <div className="form-section">Montos cobrados</div>
        <FG label="Cobrado ARS">
          <input type="number" min="0" step="0.01" value={arsV} onChange={e=>setArs(e.target.value)} placeholder="0"/>
        </FG>
        <FG label="Cobrado USD">
          <input type="number" min="0" step="0.01" value={usdV} onChange={e=>setUsd(e.target.value)} placeholder="0"/>
        </FG>
      </div>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════════
// CLIENTES
// ══════════════════════════════════════════════════════════════
export function Clientes(_: any) {
  const [data,setData]=useState<Comprobante[]>([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')

  useEffect(()=>{ db.getComprobantes().then(rows=>{setData(rows);setLoading(false)}) },[])

  const map: Record<string,{nombre:string;docs:number;ars:number;usd:number;personas:Set<string>;ultimo:string}> = {}
  data.forEach(f=>{
    if(!f.cliente||f.cliente==='ANULADO') return
    if(!map[f.cliente]) map[f.cliente]={nombre:f.cliente,docs:0,ars:0,usd:0,personas:new Set(),ultimo:''}
    map[f.cliente].docs++
    map[f.cliente].ars+=f.monto_ars||0
    map[f.cliente].usd+=f.monto_usd||0
    map[f.cliente].personas.add(f.persona)
    if((f.fecha||'')>map[f.cliente].ultimo) map[f.cliente].ultimo=f.fecha||''
  })
  let clientes=Object.values(map).sort((a,b)=>b.ars-a.ars)
  if(search) clientes=clientes.filter(c=>c.nombre.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <div className="toolbar">
        <input placeholder="Buscar cliente…" value={search} onChange={e=>setSearch(e.target.value)} />
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">Clientes ({clientes.length})</span></div>
        {loading?<Spinner/>:(
          <div className="table-wrap">
            <table>
              <thead><tr><th>Cliente</th><th>Personas / Unidades</th><th>Comprobantes</th><th className="text-right">Total ARS</th><th className="text-right">Total USD</th><th>Último</th></tr></thead>
              <tbody>
                {clientes.map(c=>(
                  <tr key={c.nombre}>
                    <td style={{fontWeight:500}}>{c.nombre}</td>
                    <td>{Array.from(c.personas).filter(Boolean).map(p=><span key={p} className="badge badge-gray" style={{marginRight:3}}>{p}</span>)}</td>
                    <td style={{textAlign:'center'}}>{c.docs}</td>
                    <td className="text-right text-mono">{ars(c.ars)}</td>
                    <td className="text-right text-mono">{usd(c.usd)}</td>
                    <td className="text-dim">{fdate(c.ultimo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// NOTAS DE CRÉDITO
// ══════════════════════════════════════════════════════════════
export function NotasCredito(_: any) {
  const [data,setData]=useState<Comprobante[]>([])
  const [loading,setLoading]=useState(true)
  const [modal,setModal]=useState<'new'|'edit'|null>(null)
  const [sel,setSel]=useState<Comprobante|null>(null)

  const load=()=>{ setLoading(true); db.getComprobantes().then(rows=>{setData(rows.filter(r=>r.tipo.startsWith('NC')));setLoading(false)}) }
  useEffect(()=>{load()},[])

  async function handleDelete(id:string) {
    if(!confirm(`¿Eliminar ${id}?`)) return
    const nc = data.find(f=>f.id===id)
    const {error}=await supabase.from('comprobantes').delete().eq('id',id)
    if(error){toast('Error al eliminar');return}
    if(nc?.factura_asociada_id) {
      await supabase.from('comprobantes').update({estado:'emitida'}).eq('id',nc.factura_asociada_id)
      toast(`✓ NC eliminada — factura ${nc.factura_asociada_id} restaurada a emitida`)
    } else {
      toast(`${id} eliminada`)
    }
    load()
  }

  async function handleSaveEdit(id:string,patch:Partial<Comprobante>) {
    const {error}=await supabase.from('comprobantes').update(patch).eq('id',id)
    if(error){toast('Error al guardar');return}
    toast('✓ Guardado'); setModal(null); setSel(null); load()
  }

  const total=data.reduce((s,f)=>s+(f.monto_ars||0),0)

  return (
    <>
      <div className="toolbar">
        <button className="btn btn-primary" onClick={()=>setModal('new')}>+ Nueva NC</button>
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Notas de Crédito ({data.length})</span>
          <span className="card-hint text-danger">Total: -{ars(total)}</span>
        </div>
        {loading?<Spinner/>:(
          <div className="table-wrap">
            <table>
              <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Persona</th><th className="text-right">Neto</th><th className="text-right">IVA</th><th className="text-right">Total ARS</th><th>Concepto</th><th>Factura anulada</th><th></th></tr></thead>
              <tbody>
                {data.length===0?<tr><td colSpan={10} className="empty-row">Sin notas de crédito</td></tr>:
                  data.map(f=>(
                    <tr key={f.id}>
                      <td style={{fontWeight:500,color:'var(--danger)'}}>{f.id}</td>
                      <td>{fdate(f.fecha)}</td><td>{f.cliente}</td>
                      <td><TipoBadge tipo={f.tipo}/></td>
                      <td className="text-dim" style={{fontSize:11.5}}>{f.persona}</td>
                      <td className="text-right text-mono">{ars(f.neto_ars)}</td>
                      <td className="text-right text-mono">{ars(f.iva)}</td>
                      <td className="text-right text-mono" style={{fontWeight:500}}>{ars(f.monto_ars)}</td>
                      <td style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',fontSize:11.5,color:'var(--text-secondary)'}}>{f.concepto}</td>
                      <td>{f.factura_asociada_id?<span style={{color:'var(--danger)',fontWeight:500,fontSize:11}}>{f.factura_asociada_id}</span>:null}</td>
                      <td>
                        <div style={{display:'flex',gap:4}}>
                          <button className="btn btn-sm" onClick={()=>{setSel(f);setModal('edit')}}>Editar</button>
                          <button className="btn btn-sm btn-danger" onClick={()=>handleDelete(f.id)}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {modal==='new'&&<NuevoNCModal onClose={()=>setModal(null)} onSaved={()=>{setModal(null);load()}} clientes={data.map(d=>d.cliente).filter(Boolean)}/>}
      {modal==='edit'&&sel&&<EditarNCModal comp={sel} onClose={()=>{setModal(null);setSel(null)}} onSaved={(patch)=>handleSaveEdit(sel.id,patch)}/>}
    </>
  )
}

function NuevoNCModal({onClose,onSaved,clientes}:{onClose:()=>void;onSaved:()=>void;clientes:string[]}) {
  const [saving,setSaving]=useState(false)
  const [tipo,setTipo]=useState('NC A')
  const [fecha,setFecha]=useState(today())
  const [cliente,setCliente]=useState('')
  const [persona,setPersona]=useState(PERSONAS[0])
  const [arsV,setArs]=useState('')
  const [neto,setNeto]=useState('')
  const [iva,setIva]=useState('')
  const [concepto,setConcepto]=useState('')
  const [facturaId,setFacturaId]=useState('')
  const [facturas,setFacturas]=useState<Comprobante[]>([])

  useEffect(()=>{
    supabase.from('comprobantes').select('id,tipo,cliente,fecha,monto_ars,neto_ars,persona,estado').in('tipo',['FACT A','FACT B','FACT DE CREDITO','FACT E']).order('numero',{ascending:false}).limit(200).then(({data})=>setFacturas((data||[]) as Comprobante[]))
  },[])

  // El cálculo depende del TIPO. NC B y NC FACT DE CREDITO no discriminan IVA:
  // el total ingresado es la base. Antes esto aplicaba 21% a los tres tipos.
  const llevaIVA = discriminaIVA(tipo)

  useEffect(()=>{
    if(!llevaIVA){ setIva(''); return }
    const n=parseFloat(neto)
    if(!isNaN(n)&&n>0){const r=desdeNeto(tipo,n);setIva(String(r.iva));setArs(String(r.total))}
    else{setIva('');setArs('')}
  },[neto,tipo,llevaIVA])

  // Al pasar a un tipo sin IVA, el "neto" deja de tener sentido: se limpia para
  // que el usuario cargue el total directo y no queden restos del cálculo.
  useEffect(()=>{ if(!llevaIVA){ setNeto(''); setIva('') } },[llevaIVA])

  useEffect(()=>{
    const fid=facturaId.trim()
    if(!fid) return
    const f=facturas.find(x=>x.id===fid)
    if(f){setCliente(f.cliente||'')}
    if(f){setPersona(f.persona||PERSONAS[0])}
  },[facturaId,facturas])

  async function save() {
    setSaving(true)
    try {
      const {data:last}=await supabase.from('comprobantes').select('numero').eq('tipo',tipo).order('numero',{ascending:false}).limit(1)
      const nextNum=last&&last[0]?(last[0].numero??400)+1:401
      const id=`${tipo.replace(/\s/g,'-')}-${nextNum}`
      const fid=facturaId.trim()||null
      await supabase.from('comprobantes').insert({id,tipo,numero:nextNum,fecha,cliente:cliente.trim(),persona,concepto:concepto.trim(),monto_ars:arsV?parseFloat(arsV):null,neto_ars:neto?parseFloat(neto):null,iva:iva?parseFloat(iva):null,estado:'emitida',factura_asociada_id:fid})
      if(fid){await supabase.from('comprobantes').update({estado:'anulada'}).eq('id',fid)}
      toast(`✓ ${id} creada${fid?' — anula '+fid:''}`); onSaved()
    } catch(e:any){toast('Error: '+(e.message||''))} finally{setSaving(false)}
  }

  return (
    <Modal title="Nueva Nota de Crédito" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Guardando…':'Guardar'}</button></>}>
      <div className="form-grid">
        <FG label="Tipo"><select value={tipo} onChange={e=>setTipo(e.target.value)}>{['NC A','NC B','NC FACT DE CREDITO'].map(t=><option key={t}>{t}</option>)}</select></FG>
        <FG label="Fecha"><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></FG>
        <FG label="Factura a anular" full>
          <input value={facturaId} onChange={e=>setFacturaId(e.target.value)} placeholder="Buscar o ingresar ID de factura…" list="nc-fact-list"/>
          <datalist id="nc-fact-list">{facturas.map(f=><option key={f.id} value={f.id}>{f.id} — {f.cliente} ({fdate(f.fecha)}){f.estado==='anulada'?' ⚠ ya anulada':''}</option>)}</datalist>
          <span style={{fontSize:11,color:'var(--text-secondary)'}}>Seleccioná la factura que esta NC cancela (opcional)</span>
        </FG>
        {cliente&&<FG label="Cliente" full><input readOnly value={cliente} style={{background:'var(--bg-secondary)',opacity:0.8}}/></FG>}
        <FG label="Persona"><select value={persona} onChange={e=>setPersona(e.target.value)}>{PERSONAS.map(p=><option key={p}>{p}</option>)}</select></FG>
        <div/>
        {llevaIVA ? (<>
          <FG label="Neto ARS"><input type="number" placeholder="0" value={neto} onChange={e=>setNeto(e.target.value)}/><span className="calc-hint">IVA y total se calculan solos</span></FG>
          <FG label="IVA (calculado)"><input readOnly value={iva} placeholder="—"/></FG>
          <FG label="Total ARS (calculado)" full><input readOnly value={arsV} placeholder="—"/></FG>
        </>) : (
          <FG label="Total ARS" full>
            <input type="number" placeholder="0" value={arsV} onChange={e=>setArs(e.target.value)}/>
            <span className="calc-hint">{tipo} no discrimina IVA — se carga el total</span>
          </FG>
        )}
        <FG label="Concepto" full><textarea rows={2} value={concepto} onChange={e=>setConcepto(e.target.value)}/></FG>
      </div>
    </Modal>
  )
}

function EditarNCModal({comp,onClose,onSaved}:{comp:Comprobante;onClose:()=>void;onSaved:(p:Partial<Comprobante>)=>void}) {
  const [fecha,setFecha]=useState(comp.fecha||'')
  const [cliente,setCliente]=useState(comp.cliente||'')
  const [persona,setPersona]=useState(comp.persona||PERSONAS[0])
  const [neto,setNeto]=useState(String(comp.neto_ars||''))
  const [iva,setIva]=useState(String(comp.iva||''))
  const [arsV,setArs]=useState(String(comp.monto_ars||''))
  const [concepto,setConcepto]=useState(comp.concepto||'')

  const llevaIVA = discriminaIVA(comp.tipo)
  // `tocado` evita el bug anterior: el efecto corría al MONTAR y pisaba iva y
  // monto_ars con neto*0.21 y neto*1.21 aunque el usuario no tocara nada, así
  // que abrir y guardar una NC B le inventaba un 21% de IVA.
  const [tocado,setTocado]=useState(false)

  useEffect(()=>{
    if(!tocado||!llevaIVA) return
    const n=parseFloat(neto)
    if(!isNaN(n)&&n>0){const r=desdeNeto(comp.tipo,n);setIva(String(r.iva));setArs(String(r.total))}
  },[neto,tocado,llevaIVA,comp.tipo])

  return (
    <Modal title={`Editar ${comp.id}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={()=>onSaved({fecha,cliente:cliente.trim(),persona,neto_ars:neto?parseFloat(neto):null,iva:iva?parseFloat(iva):null,monto_ars:arsV?parseFloat(arsV):null,concepto:concepto.trim()})}>Guardar</button></>}>
      <div className="form-grid">
        <FG label="Fecha"><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></FG>
        <FG label="Cliente"><input value={cliente} onChange={e=>setCliente(e.target.value)}/></FG>
        <FG label="Persona"><select value={persona} onChange={e=>setPersona(e.target.value)}>{PERSONAS.map(p=><option key={p}>{p}</option>)}</select></FG>
        <div/>
        {llevaIVA ? (<>
          <FG label="Neto"><input type="number" value={neto} onChange={e=>{setTocado(true);setNeto(e.target.value)}}/></FG>
          <FG label="IVA (calculado)"><input readOnly value={iva}/></FG>
          <FG label="Total (calculado)" full><input readOnly value={arsV}/></FG>
        </>) : (
          <FG label="Total ARS" full>
            <input type="number" value={arsV} onChange={e=>setArs(e.target.value)}/>
            <span className="calc-hint">{comp.tipo} no discrimina IVA — se carga el total</span>
          </FG>
        )}
        <FG label="Concepto" full><textarea rows={2} value={concepto} onChange={e=>setConcepto(e.target.value)}/></FG>
      </div>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════════
// NOTAS DE DÉBITO
// ══════════════════════════════════════════════════════════════
export function NotasDebito(_: any) {
  const [data,setData]=useState<Comprobante[]>([])
  const [loading,setLoading]=useState(true)
  const [fPV,setFPV]=useState<'all'|string>('all')
  const [modal,setModal]=useState<'edit'|null>(null)
  const [sel,setSel]=useState<Comprobante|null>(null)

  const load=()=>{ setLoading(true); db.getComprobantes().then(rows=>{setData(rows.filter(r=>r.tipo.startsWith('ND')));setLoading(false)}) }
  useEffect(()=>{load()},[])

  const rows = data.filter(f => fPV === 'all' ? true : (f.punto_venta || '0002') === fPV)

  async function handleDelete(id:string) {
    if(!confirm(`¿Eliminar ${id}?`)) return
    await supabase.from('comprobantes').delete().eq('id',id)
    toast(`${id} eliminada`); load()
  }

  async function handleSaveEdit(id:string,patch:Partial<Comprobante>) {
    await supabase.from('comprobantes').update(patch).eq('id',id)
    toast('✓ Guardado'); setModal(null); setSel(null); load()
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Notas de Débito ({rows.length})</span>
        <select value={fPV} onChange={e => setFPV(e.target.value)} style={{ width: 130 }}>
          <option value="all">Todos los PV</option>
          {PUNTOS_VENTA.map(p => <option key={p} value={p}>PV {p}</option>)}
        </select>
      </div>
      {loading?<Spinner/>:rows.length===0?(
        <div className="empty-row">Sin notas de débito registradas</div>
      ):(
        <div className="table-wrap">
          <table>
            <thead><tr><th>N°</th><th>PV</th><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Persona</th><th className="text-right">ARS</th><th className="text-right">USD</th><th>Concepto</th><th></th></tr></thead>
            <tbody>
              {rows.map(f=>(
                <tr key={f.id}>
                  <td style={{fontWeight:500}}>{f.id}</td>
                  <td style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-tertiary)'}}>{f.punto_venta || '0002'}</td>
                  <td>{fdate(f.fecha)}</td><td>{f.cliente}</td>
                  <td><TipoBadge tipo={f.tipo}/></td>
                  <td className="text-dim">{f.persona}</td>
                  <td className="text-right text-mono">{ars(f.monto_ars)}</td>
                  <td className="text-right text-mono">{usd(f.monto_usd)}</td>
                  <td style={{fontSize:11.5}}>{f.concepto}</td>
                  <td>
                    <div style={{display:'flex',gap:4}}>
                      <button className="btn btn-sm" onClick={()=>{setSel(f);setModal('edit')}}>Editar</button>
                      <button className="btn btn-sm btn-danger" onClick={()=>handleDelete(f.id)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal==='edit'&&sel&&(
        <Modal title={`Editar ${sel.id}`} onClose={()=>{setModal(null);setSel(null)}} footer={<><button className="btn" onClick={()=>{setModal(null);setSel(null)}}>Cancelar</button></>}>
          <div style={{padding:'16px 20px',color:'var(--text-secondary)',fontSize:13}}>Edición disponible desde Supabase para Notas de Débito.</div>
        </Modal>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// RESUMEN
// ══════════════════════════════════════════════════════════════
export function Resumen(_: any) {
  const [comps,setComps]=useState<Comprobante[]>([])
  const [loading,setLoading]=useState(true)
  useEffect(()=>{db.getComprobantes().then(rows=>{setComps(rows);setLoading(false)})},[])

  if(loading) return <Spinner/>

  const facts=comps.filter(c=>c.tipo.startsWith('FACT')&&c.estado!=='anulada')
  const ncs=comps.filter(c=>c.tipo.startsWith('NC'))

  const byTipo:Record<string,{ars:number;usd:number;count:number}>= {}
  facts.forEach(f=>{ if(!byTipo[f.tipo])byTipo[f.tipo]={ars:0,usd:0,count:0}; byTipo[f.tipo].ars+=montoARS(f); byTipo[f.tipo].usd+=f.monto_usd||0; byTipo[f.tipo].count++ })

  const byMes:Record<string,{ars:number;usd:number}>= {}
  facts.forEach(f=>{ const k=f.fecha?.slice(0,7)||'N/A'; if(!byMes[k])byMes[k]={ars:0,usd:0}; byMes[k].ars+=montoARS(f); byMes[k].usd+=f.monto_usd||0 })

  const byPers:Record<string,{ars:number;usd:number;count:number}>= {}
  facts.forEach(f=>{ if(!byPers[f.persona])byPers[f.persona]={ars:0,usd:0,count:0}; byPers[f.persona].ars+=montoARS(f); byPers[f.persona].usd+=f.monto_usd||0; byPers[f.persona].count++ })

  const totalARSNativo = facts.filter(f=>!f.monto_usd).reduce((s,f)=>s+(f.monto_ars||0),0)
  const totalUSDNativo = facts.reduce((s,f)=>s+(f.monto_usd||0),0)
  const totalARS=Object.values(byTipo).reduce((s,v)=>s+v.ars,0)
  const totalNC=ncs.reduce((s,f)=>s+montoARS(f),0)
  const totalNeto = totalARS - totalNC

  return (
    <>
      <div className="metrics-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}>
        <div className="metric-card"><div className="metric-label">Facturado ARS</div><div className="metric-value">{ars(totalARSNativo)}</div></div>
        <div className="metric-card"><div className="metric-label">Facturado USD</div><div className="metric-value">{usd(totalUSDNativo)}</div></div>
        <div className="metric-card"><div className="metric-label">Total TOTAL (ARS)</div><div className="metric-value">{ars(totalARS)}</div><div className="metric-label" style={{marginTop:4,fontSize:11}}>Neto: {ars(totalNeto)}</div></div>
      </div>
      <div className="two-col">
        <div className="card">
          <div className="card-header"><span className="card-title">Por tipo de comprobante</span></div>
          <div style={{padding:'14px 16px'}}>
            {Object.entries(byTipo).map(([tipo,v])=>(
              <div key={tipo} className="sum-row">
                <span><TipoBadge tipo={tipo}/></span>
                <span style={{display:'flex',gap:16,alignItems:'center'}}>
                  <span className="text-mono">{ars(v.ars)}</span>
                  {v.usd>0&&<span className="text-mono text-dim">{usd(v.usd)}</span>}
                  <span className="text-dim" style={{fontSize:11}}>{v.count} docs</span>
                </span>
              </div>
            ))}
            <div className="sum-row" style={{marginTop:8}}><span style={{fontWeight:600}}>Total Facturado (ARS, USD convertidos)</span><span className="text-mono" style={{fontWeight:600}}>{ars(totalARS)}</span></div>
            <div className="sum-row"><span className="text-danger">— Notas de Crédito</span><span className="text-mono text-danger">-{ars(totalNC)}</span></div>
            <div className="sum-row" style={{fontSize:15}}><span style={{fontWeight:600}}>Neto Facturado</span><span className="text-mono text-success" style={{fontWeight:600}}>{ars(totalNeto)}</span></div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Por mes</span></div>
          <div style={{padding:'14px 16px'}}>
            {Object.entries(byMes).sort().map(([mes,v])=>(
              <div key={mes} className="sum-row">
                <span>{mes}</span>
                <span style={{display:'flex',gap:12}}>
                  <span className="text-mono">{ars(v.ars)}</span>
                  {v.usd>0&&<span className="text-mono text-dim">{usd(v.usd)}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">Por persona / unidad de negocio</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Persona / Unidad</th><th style={{textAlign:'center'}}>Facturas</th><th className="text-right">Total ARS</th><th className="text-right">Total USD</th><th className="text-right">% del total</th></tr></thead>
            <tbody>
              {Object.entries(byPers).sort((a,b)=>b[1].ars-a[1].ars).map(([p,v])=>(
                <tr key={p}>
                  <td style={{fontWeight:500}}>{p}</td>
                  <td style={{textAlign:'center'}}>{v.count}</td>
                  <td className="text-right text-mono">{ars(v.ars)}</td>
                  <td className="text-right text-mono">{v.usd>0?usd(v.usd):'—'}</td>
                  <td className="text-right">{totalARS>0?Math.round((v.ars/totalARS)*100):0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default Recibos
