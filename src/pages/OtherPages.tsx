'use client'
import { useEffect, useState, useCallback } from 'react'
import { db, Recibo, Comprobante } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { ars, usd, fdate, montoARS, PERSONAS, today, downloadCSV, MESES, TODOS_TIPOS } from '@/lib/utils'
import { TipoBadge, Spinner, Modal, FG, toast } from '@/components/ui'

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
        <button className="btn" onClick={()=>downloadCSV([['N° Recibo','Fecha','Cliente','N° Fact.','Persona','Forma pago','ARS','USD'],...data.map(r=>[r.id,r.fecha,r.cliente,r.nro_fact,r.persona,r.forma_pago,r.monto_ars,r.monto_usd])],'recibos.csv')}>↓ CSV</button>
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
                    <td className="text-dim">{r.nro_fact||'—'}</td>
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

function NuevoReciboModal({onClose,onSaved}:{onClose:()=>void;onSaved:()=>void}) {
  const [saving,setSaving]=useState(false)
  const [fecha,setFecha]=useState(today())
  const [cliente,setCliente]=useState('')
  const [tipoFact,setTipoFact]=useState('FACT A')
  const [nroFact,setNroFact]=useState('')
  const [persona,setPersona]=useState(PERSONAS[0])
  const [pago,setPago]=useState('transferencia')
  const [arsV,setArs]=useState('')
  const [usdV,setUsd]=useState('')

  const tipoMap: Record<string,string> = {
    'FACT A':'FC-A','FACT B':'FC-B','FACT DE CREDITO':'FC-FC',
    'FACT E':'FC-E','NC A':'NC-A','NC B':'NC-B'
  }
  const fullFactId = nroFact.trim() ? `${tipoMap[tipoFact]}-${nroFact.trim()}` : null

  async function save() {
    if (!cliente.trim()) return toast('El cliente es obligatorio')
    setSaving(true)
    try {
      const { data: last } = await supabase.from('recibos').select('id').order('id',{ascending:false}).limit(1)
      const nextId = last&&last[0] ? last[0].id+1 : 19200
      await db.createRecibo({ id:nextId, fecha, cliente:cliente.trim(), nro_fact:fullFactId, persona, forma_pago:pago, monto_ars:arsV?parseFloat(arsV):null, monto_usd:usdV?parseFloat(usdV):null, retencion:null, nro_echeq:null })
      toast(`✓ Recibo ${nextId} guardado`)
      onSaved()
    } catch(e:any) { toast('Error: '+(e.message||'')) } finally { setSaving(false) }
  }

  return (
    <Modal title="Nuevo Recibo" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Guardando…':'Guardar'}</button></>}>
      <div className="form-grid">
        <FG label="Fecha *"><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></FG>
        <FG label="Cliente *" full><input value={cliente} onChange={e=>setCliente(e.target.value)} placeholder="Razón social"/></FG>
        <FG label="Tipo de factura">
          <select value={tipoFact} onChange={e=>setTipoFact(e.target.value)}>
            {['FACT A','FACT B','FACT DE CREDITO','FACT E','NC A','NC B'].map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </FG>
        <FG label="N° Factura">
          <input value={nroFact} onChange={e=>setNroFact(e.target.value)} placeholder="Ej: 4086"/>
          {nroFact && <span className="calc-hint">ID: {tipoMap[tipoFact]}-{nroFact}</span>}
        </FG>
        <FG label="Persona / Unidad"><select value={persona} onChange={e=>setPersona(e.target.value)}>{PERSONAS.map(p=><option key={p}>{p}</option>)}</select></FG>
        <FG label="Forma de pago"><select value={pago} onChange={e=>setPago(e.target.value)}>{['transferencia','cheque','e-cheq','efectivo'].map(p=><option key={p}>{p}</option>)}</select></FG>
        <div/>
        <FG label="Cobrado ARS"><input type="number" min="0" step="0.01" placeholder="0" value={arsV} onChange={e=>setArs(e.target.value)}/></FG>
        <FG label="Cobrado USD"><input type="number" min="0" step="0.01" placeholder="0" value={usdV} onChange={e=>setUsd(e.target.value)}/></FG>
      </div>
    </Modal>
  )
}

function EditarReciboModal({recibo,onClose,onSaved}:{recibo:Recibo;onClose:()=>void;onSaved:(p:Partial<Recibo>)=>void}) {
  const [fecha,setFecha]=useState(recibo.fecha||'')
  const [cliente,setCliente]=useState(recibo.cliente||'')
  const [nroFact,setNroFact]=useState(recibo.nro_fact||'')
  const [persona,setPersona]=useState(recibo.persona||PERSONAS[0])
  const [pago,setPago]=useState(recibo.forma_pago||'transferencia')
  const [arsV,setArs]=useState(String(recibo.monto_ars||''))
  const [usdV,setUsd]=useState(String(recibo.monto_usd||''))

  return (
    <Modal title={`Editar Recibo ${recibo.id}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={()=>onSaved({fecha,cliente:cliente.trim(),nro_fact:nroFact||null,persona,forma_pago:pago,monto_ars:arsV?parseFloat(arsV):null,monto_usd:usdV?parseFloat(usdV):null})}>Guardar</button></>}>
      <div className="form-grid">
        <FG label="Fecha"><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></FG>
        <FG label="Cliente"><input value={cliente} onChange={e=>setCliente(e.target.value)}/></FG>
        <FG label="N° Factura"><input value={nroFact} onChange={e=>setNroFact(e.target.value)}/></FG>
        <FG label="Persona"><select value={persona} onChange={e=>setPersona(e.target.value)}>{PERSONAS.map(p=><option key={p}>{p}</option>)}</select></FG>
        <FG label="Forma de pago"><select value={pago} onChange={e=>setPago(e.target.value)}>{['transferencia','cheque','e-cheq','efectivo'].map(p=><option key={p}>{p}</option>)}</select></FG>
        <div/>
        <FG label="ARS"><input type="number" value={arsV} onChange={e=>setArs(e.target.value)}/></FG>
        <FG label="USD"><input type="number" value={usdV} onChange={e=>setUsd(e.target.value)}/></FG>
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
    const {error}=await supabase.from('comprobantes').delete().eq('id',id)
    if(error){toast('Error al eliminar');return}
    toast(`${id} eliminada`); load()
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
              <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Persona</th><th className="text-right">Neto</th><th className="text-right">IVA</th><th className="text-right">Total ARS</th><th>Concepto</th><th></th></tr></thead>
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

  useEffect(()=>{
    const n=parseFloat(neto)
    if(!isNaN(n)&&n>0){setIva(String(Math.round(n*0.21*100)/100));setArs(String(Math.round(n*1.21*100)/100))}
    else{setIva('');setArs('')}
  },[neto])

  async function save() {
    if(!cliente.trim()) return toast('El cliente es obligatorio')
    setSaving(true)
    try {
      const {data:last}=await supabase.from('comprobantes').select('numero').eq('tipo',tipo).order('numero',{ascending:false}).limit(1)
      const nextNum=last&&last[0]?(last[0].numero??400)+1:401
      const id=`${tipo.replace(/\s/g,'-')}-${nextNum}`
      await supabase.from('comprobantes').insert({id,tipo,numero:nextNum,fecha,cliente:cliente.trim(),persona,concepto:concepto.trim(),monto_ars:arsV?parseFloat(arsV):null,neto_ars:neto?parseFloat(neto):null,iva:iva?parseFloat(iva):null,estado:'emitida'})
      toast(`✓ ${id} creada`); onSaved()
    } catch(e:any){toast('Error: '+(e.message||''))} finally{setSaving(false)}
  }

  return (
    <Modal title="Nueva Nota de Crédito" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Guardando…':'Guardar'}</button></>}>
      <div className="form-grid">
        <FG label="Tipo"><select value={tipo} onChange={e=>setTipo(e.target.value)}>{['NC A','NC B','NC FACT DE CREDITO'].map(t=><option key={t}>{t}</option>)}</select></FG>
        <FG label="Fecha"><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></FG>
        <FG label="Cliente *" full><input value={cliente} onChange={e=>setCliente(e.target.value)} placeholder="Razón social" list="nc-cl"/><datalist id="nc-cl">{clientes.map(c=><option key={c} value={c}/>)}</datalist></FG>
        <FG label="Persona"><select value={persona} onChange={e=>setPersona(e.target.value)}>{PERSONAS.map(p=><option key={p}>{p}</option>)}</select></FG>
        <div/>
        <FG label="Neto ARS"><input type="number" placeholder="0" value={neto} onChange={e=>setNeto(e.target.value)}/><span className="calc-hint">IVA y total se calculan solos</span></FG>
        <FG label="IVA (calculado)"><input readOnly value={iva} placeholder="—"/></FG>
        <FG label="Total ARS (calculado)" full><input readOnly value={arsV} placeholder="—"/></FG>
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

  useEffect(()=>{
    const n=parseFloat(neto)
    if(!isNaN(n)&&n>0){setIva(String(Math.round(n*0.21*100)/100));setArs(String(Math.round(n*1.21*100)/100))}
  },[neto])

  return (
    <Modal title={`Editar ${comp.id}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={()=>onSaved({fecha,cliente:cliente.trim(),persona,neto_ars:neto?parseFloat(neto):null,iva:iva?parseFloat(iva):null,monto_ars:arsV?parseFloat(arsV):null,concepto:concepto.trim()})}>Guardar</button></>}>
      <div className="form-grid">
        <FG label="Fecha"><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></FG>
        <FG label="Cliente"><input value={cliente} onChange={e=>setCliente(e.target.value)}/></FG>
        <FG label="Persona"><select value={persona} onChange={e=>setPersona(e.target.value)}>{PERSONAS.map(p=><option key={p}>{p}</option>)}</select></FG>
        <div/>
        <FG label="Neto"><input type="number" value={neto} onChange={e=>setNeto(e.target.value)}/></FG>
        <FG label="IVA (calculado)"><input readOnly value={iva}/></FG>
        <FG label="Total (calculado)" full><input readOnly value={arsV}/></FG>
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
  const [modal,setModal]=useState<'edit'|null>(null)
  const [sel,setSel]=useState<Comprobante|null>(null)

  const load=()=>{ setLoading(true); db.getComprobantes().then(rows=>{setData(rows.filter(r=>r.tipo.startsWith('ND')));setLoading(false)}) }
  useEffect(()=>{load()},[])

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
      <div className="card-header"><span className="card-title">Notas de Débito ({data.length})</span></div>
      {loading?<Spinner/>:data.length===0?(
        <div className="empty-row">Sin notas de débito registradas</div>
      ):(
        <div className="table-wrap">
          <table>
            <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Persona</th><th className="text-right">ARS</th><th className="text-right">USD</th><th>Concepto</th><th></th></tr></thead>
            <tbody>
              {data.map(f=>(
                <tr key={f.id}>
                  <td style={{fontWeight:500}}>{f.id}</td>
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
