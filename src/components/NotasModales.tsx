'use client'
import { useEffect, useState } from 'react'
import { db, supabase, Comprobante } from '@/lib/supabase'
import { ars, fdate, PERSONAS, today, TODOS_TIPOS, PUNTOS_VENTA, PUNTO_VENTA_DEFAULT } from '@/lib/utils'
import { Modal, FG, toast } from '@/components/ui'
import { discriminaIVA, desdeNeto } from '@/lib/fiscal'

/**
 * Alta y edición de notas de crédito.
 *
 * Se movieron desde `OtherPages.tsx` SIN TOCAR una línea de su lógica: el
 * cálculo de neto/IVA con `discriminaIVA` y `desdeNeto`, la numeración, el
 * punto de venta, y —lo más delicado— la anulación de la factura asociada al
 * emitir la nota. Eso último es una regla fiscal, no una decisión de
 * pantalla, y no se toca en esta fase.
 *
 * El traslado existe porque la pantalla de Documentos dejó de vivir dentro de
 * `OtherPages.tsx`, que se retiró.
 */

export function NuevoNCModal({onClose,onSaved,clientes}:{onClose:()=>void;onSaved:()=>void;clientes:string[]}) {
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

export function EditarNCModal({comp,onClose,onSaved}:{comp:Comprobante;onClose:()=>void;onSaved:(p:Partial<Comprobante>)=>void}) {
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
