'use client'
import { useEffect, useState } from 'react'
import { db, supabase, Recibo, Comprobante } from '@/lib/supabase'
import { ars, usd, fdate, montoARS, PERSONAS, today } from '@/lib/utils'
import { TipoBadge, Modal, FG, toast } from '@/components/ui'

/**
 * Alta y edición de recibos.
 *
 * Se movieron desde `OtherPages.tsx` sin tocar una línea de su lógica: la
 * numeración, la búsqueda de facturas pendientes, el vínculo con los
 * comprobantes y el manejo del e-cheq son exactamente los mismos.
 *
 * El motivo del traslado es que la pantalla de Recibos dejó de vivir dentro
 * de ese archivo, y arrastrar 800 líneas de Clientes, Notas de Crédito y
 * Notas de Débito para usar dos modales no tenía sentido.
 */

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

export function NuevoReciboModal({onClose,onSaved}:{onClose:()=>void;onSaved:()=>void}) {
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

export function EditarReciboModal({recibo,onClose,onSaved}:{recibo:Recibo;onClose:()=>void;onSaved:(p:Partial<Recibo>)=>void}) {
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
