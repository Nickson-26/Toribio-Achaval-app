'use client'
import { useState, useEffect } from 'react'
import { db, Comprobante } from '@/lib/supabase'
import { Modal, FG, toast } from '@/components/ui'
import { PERSONAS, TODOS_TIPOS, today, buildComprobanteId, PUNTOS_VENTA, PUNTO_VENTA_DEFAULT } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const IVA_RATE = 0.21

// ── Helper: obtener próximo número de recibo ───────────────────
async function getNextReciboId(): Promise<number> {
  const { data } = await supabase
    .from('recibos')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
  return data && data[0] ? data[0].id + 1 : 19200
}

// ── Nueva Factura ──────────────────────────────────────────────
export function NuevoComprobanteModal({ onClose, onSaved, clientes }: {
  onClose: () => void
  onSaved: (c: Comprobante) => void
  clientes: string[]
}) {
  const [saving,     setSaving]     = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [tipo,       setTipo]       = useState('FACT A')
  const [fecha,      setFecha]      = useState(today())
  const [cliente,    setCliente]    = useState('')
  const [persona,    setPersona]    = useState(PERSONAS[0])
  const [pv,         setPv]         = useState<string>(PUNTO_VENTA_DEFAULT)
  const [concepto,   setConcepto]   = useState('')
  const [netoARS,    setNetoARS]    = useState('')
  const [ivaARS,     setIvaARS]     = useState('')
  const [totalARS,   setTotalARS]   = useState('')
  const [netoUSD,    setNetoUSD]    = useState('')
  const [ivaUSD,     setIvaUSD]     = useState('')
  const [totalUSD,   setTotalUSD]   = useState('')
  const [tcStr,      setTc]         = useState('')
  const [errors,     setErrors]     = useState<Record<string, boolean>>({})

  const isB    = tipo === 'FACT B'
  const hasUSD = !!netoUSD || !!totalUSD

  useEffect(() => {
    if (isB || !netoARS) { setIvaARS(''); setTotalARS(''); return }
    const n = parseFloat(netoARS)
    if (!isNaN(n) && n > 0) {
      const iva = Math.round(n * IVA_RATE * 100) / 100
      setIvaARS(String(iva))
      setTotalARS(String(Math.round((n + iva) * 100) / 100))
    }
  }, [netoARS, isB])

  useEffect(() => {
    if (isB || !netoUSD) { setIvaUSD(''); setTotalUSD(''); return }
    const n = parseFloat(netoUSD)
    if (!isNaN(n) && n > 0) {
      const iva = Math.round(n * IVA_RATE * 10000) / 10000
      setIvaUSD(String(iva))
      setTotalUSD(String(Math.round((n + iva) * 10000) / 10000))
    }
  }, [netoUSD, isB])

  useEffect(() => {
    if (isB) { setIvaARS(''); setIvaUSD(''); setNetoARS(''); setNetoUSD('') }
  }, [isB])

  async function handlePDFImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setExtracting(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/extract-invoice', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pdfBase64: base64 }),
      })
      if (!res.ok) {
        const err = await res.json().catch(()=>({error:'Error desconocido'}))
        toast('Error al extraer datos: ' + (err.error || res.statusText))
        return
      }
      const data = await res.json()
      // Pre-completar campos del formulario
      if (data.tipo && TODOS_TIPOS.includes(data.tipo)) setTipo(data.tipo)
      if (data.fecha)       setFecha(data.fecha)
      if (data.cliente)     setCliente(data.cliente)
      if (data.concepto)    setConcepto(data.concepto)
      if (data.punto_venta && PUNTOS_VENTA.includes(data.punto_venta)) setPv(data.punto_venta)
      if (data.tipo_cambio) setTc(String(data.tipo_cambio))
      const esB = (data.tipo || tipo) === 'FACT B'
      if (esB) {
        if (data.total_ars) setTotalARS(String(data.total_ars))
        if (data.total_usd) setTotalUSD(String(data.total_usd))
      } else {
        if (data.neto_ars)  setNetoARS(String(data.neto_ars))   // useEffect auto-calcula IVA y total
        if (data.neto_usd)  setNetoUSD(String(data.neto_usd))
      }
      toast('✓ Datos extraídos — revisá y confirmá antes de guardar')
    } catch (err: any) {
      toast('Error: ' + (err.message || 'no se pudo procesar el PDF'))
    } finally {
      setExtracting(false)
      e.target.value = ''
    }
  }

  async function handleSave() {
    const errs: Record<string, boolean> = {}
    if (!cliente.trim())  errs.cliente  = true
    if (!concepto.trim()) errs.concepto = true
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      // Numeración independiente por (tipo, punto_venta).
      // PV 0002 sigue la serie histórica; PV nuevos arrancan desde 1.
      const { data: last } = await supabase
        .from('comprobantes')
        .select('numero')
        .eq('tipo', tipo)
        .eq('punto_venta', pv)
        .order('numero', { ascending: false })
        .limit(1)
      const nextNum = last && last[0]
        ? (last[0].numero ?? 0) + 1
        : (pv === '0002' ? 4001 : 1)
      const id = buildComprobanteId(tipo, nextNum, pv)
      const tc = tcStr ? parseFloat(tcStr) : null
      const monto_usd = hasUSD && !isB ? (totalUSD ? parseFloat(totalUSD) : null) : null
      const neto_usd  = hasUSD && !isB ? (netoUSD  ? parseFloat(netoUSD)  : null) : null
      const monto_ars = isB
        ? (totalARS ? parseFloat(totalARS) : null)
        : hasUSD && tc ? (monto_usd ? Math.round(monto_usd * tc * 100) / 100 : null)
        : (totalARS ? parseFloat(totalARS) : null)
      const neto_ars = !isB
        ? hasUSD && tc && neto_usd ? Math.round(neto_usd * tc * 100) / 100
        : (netoARS ? parseFloat(netoARS) : null) : null
      const iva_ars = !isB
        ? hasUSD && tc && ivaUSD ? Math.round(parseFloat(ivaUSD) * tc * 100) / 100
        : (ivaARS ? parseFloat(ivaARS) : null) : null

      const payload: Omit<Comprobante, 'created_at'> = {
        id, tipo, numero: nextNum, fecha,
        cliente: cliente.trim(), persona, concepto: concepto.trim(),
        monto_ars, monto_usd, tipo_cambio: tc,
        neto_ars, neto_usd, iva: iva_ars,
        arba_ars: null, arba_usd: null,
        estado: tipo.startsWith('FACT') ? 'pendiente' : 'emitida',
        recibo_id: null, fecha_cobro: null,
        punto_venta: pv,
      }
      const saved = await db.createComprobante(payload)
      onSaved(saved)
      toast(`✓ ${id} guardada`)
    } catch (e: any) {
      toast('Error: ' + (e.message || 'No se pudo guardar'))
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Nueva Factura / Comprobante" onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </>}>
      {/* ── Importar desde PDF ── */}
      <div style={{padding:'14px 22px 0',display:'flex',alignItems:'center',gap:10,borderBottom:'1px solid var(--border)',paddingBottom:14}}>
        <label style={{cursor:extracting?'wait':'pointer',display:'inline-flex',alignItems:'center',gap:6,padding:'6px 12px',background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',fontSize:13,fontWeight:500,color:extracting?'var(--text-tertiary)':'var(--text-primary)',transition:'all .15s'}}>
          {extracting ? '⏳ Procesando PDF…' : '📎 Importar datos desde PDF'}
          <input type="file" accept=".pdf" style={{display:'none'}} disabled={extracting} onChange={handlePDFImport}/>
        </label>
        <span style={{fontSize:11,color:'var(--text-tertiary)'}}>
          {extracting ? 'Claude está leyendo el PDF…' : 'Subí una factura AFIP/ARCA y el formulario se completa solo'}
        </span>
      </div>
      <div className="form-grid">
        <FG label="Tipo *">
          <select value={tipo} onChange={e => setTipo(e.target.value)}>
            {TODOS_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FG>
        <FG label="Fecha *">
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        </FG>
        <FG label="Cliente *" full>
          <input className={errors.cliente ? 'error' : ''} value={cliente}
            onChange={e => { setCliente(e.target.value); setErrors(p => ({...p, cliente: false})) }}
            placeholder="Razón social" list="cl-list" />
          <datalist id="cl-list">{clientes.map(c => <option key={c} value={c} />)}</datalist>
        </FG>
        <FG label="Persona / Unidad *">
          <select value={persona} onChange={e => setPersona(e.target.value)}>
            {PERSONAS.map(p => <option key={p}>{p}</option>)}
          </select>
        </FG>
        <FG label="Punto de Venta *">
          <select value={pv} onChange={e => setPv(e.target.value)}>
            {PUNTOS_VENTA.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </FG>
        <FG label="Tipo de cambio (si es en USD)">
          <input type="number" min="0" step="0.01" placeholder="Ej: 1470" value={tcStr}
            onChange={e => setTc(e.target.value)} />
        </FG>
        <hr className="form-divider" />
        {isB ? (
          <>
            <FG label="Total ARS">
              <input type="number" min="0" step="0.01" placeholder="0" value={totalARS}
                onChange={e => setTotalARS(e.target.value)} />
            </FG>
            <FG label="Total USD">
              <input type="number" min="0" step="0.0001" placeholder="0" value={totalUSD}
                onChange={e => setTotalUSD(e.target.value)} />
            </FG>
            <div className="form-group full">
              <span className="calc-hint" style={{ color: 'var(--info)' }}>Factura B — no lleva IVA</span>
            </div>
          </>
        ) : (
          <>
            <FG label="Neto ARS">
              <input type="number" min="0" step="0.01" placeholder="Ingresá el neto en ARS" value={netoARS}
                onChange={e => setNetoARS(e.target.value)} />
              <span className="calc-hint">IVA y total se calculan solos</span>
            </FG>
            <FG label="Neto USD">
              <input type="number" min="0" step="0.0001" placeholder="Ingresá el neto en USD" value={netoUSD}
                onChange={e => setNetoUSD(e.target.value)} />
              <span className="calc-hint">IVA USD se calcula solo</span>
            </FG>
            <FG label="IVA ARS (calculado)"><input readOnly value={ivaARS} placeholder="—" /></FG>
            <FG label="IVA USD (calculado)"><input readOnly value={ivaUSD} placeholder="—" /></FG>
            <FG label="Total ARS (calculado)"><input readOnly value={totalARS} placeholder="—" style={{ fontWeight: 500 }} /></FG>
            <FG label="Total USD (calculado)"><input readOnly value={totalUSD} placeholder="—" style={{ fontWeight: 500 }} /></FG>
          </>
        )}
        <FG label="Concepto *" full>
          <textarea className={errors.concepto ? 'error' : ''} rows={3}
            placeholder="Descripción detallada del servicio…" value={concepto}
            onChange={e => { setConcepto(e.target.value); setErrors(p => ({...p, concepto: false})) }} />
        </FG>
      </div>
    </Modal>
  )
}

// ── Editar ─────────────────────────────────────────────────────
export function EditarComprobanteModal({ comp, onClose, onSaved }: {
  comp: Comprobante; onClose: () => void; onSaved: (c: Comprobante) => void
}) {
  const [saving,     setSaving]     = useState(false)
  const [fecha,      setFecha]      = useState(comp.fecha || '')
  const [estado,     setEstado]     = useState(comp.estado)
  const [cliente,    setCliente]    = useState(comp.cliente || '')
  const [persona,    setPersona]    = useState(comp.persona || '')
  const [pv,         setPv]         = useState<string>(comp.punto_venta || PUNTO_VENTA_DEFAULT)
  const [tcStr,      setTc]         = useState(String(comp.tipo_cambio || ''))
  const [arsStr,     setArs]        = useState(String(comp.monto_ars || ''))
  const [usdStr,     setUsd]        = useState(String(comp.monto_usd || ''))
  const [netoStr,    setNeto]       = useState(String(comp.neto_ars || ''))
  const [ivaStr,     setIva]        = useState(String(comp.iva || ''))
  const [netoUSD,    setNetoUSD]    = useState(String(comp.neto_usd || ''))
  const [ivaUSD,     setIvaUSD]     = useState('')
  const [totalUSD,   setTotalUSD]   = useState(String(comp.monto_usd || ''))
  const [reciboId,   setReciboId]   = useState(String(comp.recibo_id || ''))
  const [fechaCobro, setFechaCobro] = useState(comp.fecha_cobro || '')
  const [concepto,   setConcepto]   = useState(comp.concepto || '')
  const isB = comp.tipo === 'FACT B'
  const isUSD = !!usdStr || !!netoUSD || !!totalUSD

  // Recalcula IVA y Total ARS a partir del Neto ARS (sólo para facturas no-B)
  useEffect(() => {
    if (isB) return
    const n = parseFloat(netoStr)
    if (!isNaN(n) && n > 0) {
      const iva = Math.round(n * IVA_RATE * 100) / 100
      setIva(String(iva))
      setArs(String(Math.round((n + iva) * 100) / 100))
    } else if (netoStr === '') {
      // si limpio el neto, no toco el total ARS (puede haberse cargado manual)
    }
  }, [netoStr, isB])

  // Recalcula IVA y Total USD a partir del Neto USD (sólo para facturas no-B)
  useEffect(() => {
    if (isB) return
    const n = parseFloat(netoUSD)
    if (!isNaN(n) && n > 0) {
      const iva = Math.round(n * IVA_RATE * 10000) / 10000
      setIvaUSD(String(iva))
      setTotalUSD(String(Math.round((n + iva) * 10000) / 10000))
      setUsd(String(Math.round((n + iva) * 10000) / 10000))
    }
  }, [netoUSD, isB])

  async function handleSave() {
    setSaving(true)
    try {
      const saved = await db.updateComprobante(comp.id, {
        fecha, estado, cliente: cliente.trim(), persona,
        punto_venta: pv,
        tipo_cambio: tcStr     ? parseFloat(tcStr)     : null,
        monto_ars:   arsStr    ? parseFloat(arsStr)    : null,
        monto_usd:   (totalUSD || usdStr) ? parseFloat(totalUSD || usdStr) : null,
        neto_ars:    netoStr   ? parseFloat(netoStr)   : null,
        neto_usd:    netoUSD   ? parseFloat(netoUSD)   : null,
        iva:         ivaStr    ? parseFloat(ivaStr)    : null,
        recibo_id:   reciboId  ? parseInt(reciboId)    : null,
        fecha_cobro: fechaCobro || null,
        concepto:    concepto.trim(),
      })
      onSaved(saved)
      toast('✓ Cambios guardados')
    } catch (e: any) {
      toast('Error: ' + (e.message || 'No se pudo guardar'))
    } finally { setSaving(false) }
  }

  return (
    <Modal title={`Editar ${comp.tipo} — ${comp.id}`} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </>}>
      <div className="form-grid">
        {/* ───── Datos generales ───── */}
        <div className="form-section">Datos generales <span className="form-section-pill">{comp.tipo}</span></div>
        <FG label="Fecha"><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></FG>
        <FG label="Estado">
          <select value={estado} onChange={e => setEstado(e.target.value as any)}>
            {['pendiente','cobrada','anulada','emitida'].map(s => <option key={s}>{s}</option>)}
          </select>
        </FG>
        <FG label="Cliente" full><input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Razón social" /></FG>
        <FG label="Persona / Unidad">
          <select value={persona} onChange={e => setPersona(e.target.value)}>
            {PERSONAS.map(p => <option key={p}>{p}</option>)}
          </select>
        </FG>
        <FG label="Punto de Venta">
          <select value={pv} onChange={e => setPv(e.target.value)}>
            {PUNTOS_VENTA.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </FG>
        <FG label="Tipo de cambio">
          <input type="number" min="0" step="0.01" value={tcStr} onChange={e => setTc(e.target.value)} placeholder="Sólo si la factura es en USD" />
          {isUSD && !tcStr && <span className="calc-hint" style={{color:'var(--warn)'}}>⚠ Falta TC para convertir a ARS</span>}
        </FG>

        {/* ───── Montos ARS ───── */}
        <div className="form-section">Montos en pesos {isB && <span className="form-section-pill">Fact B — sin IVA</span>}</div>
        {isB ? (
          <FG label="Total ARS" full>
            <input type="number" min="0" step="0.01" value={arsStr} onChange={e => setArs(e.target.value)} placeholder="0" />
          </FG>
        ) : (
          <>
            <FG label="Neto ARS">
              <input type="number" min="0" step="0.01" value={netoStr} onChange={e => setNeto(e.target.value)} placeholder="—" />
              <span className="calc-hint">IVA y Total se recalculan al cambiar este campo</span>
            </FG>
            <FG label="Total ARS">
              <input type="number" min="0" step="0.01" value={arsStr} onChange={e => setArs(e.target.value)} placeholder="—" style={{fontWeight:500}} />
              <span className="calc-hint">Editable si querés ajustar manualmente</span>
            </FG>
            <FG label="IVA ARS (calculado)"><input readOnly value={ivaStr} placeholder="—" /></FG>
          </>
        )}

        {/* ───── Montos USD (opcional) ───── */}
        <div className="form-section">Montos en dólares <span className="form-section-pill" style={{background:'var(--info-bg)',color:'var(--info)'}}>opcional</span></div>
        {isB ? (
          <FG label="Total USD" full>
            <input type="number" min="0" step="0.0001" value={totalUSD} onChange={e => { setTotalUSD(e.target.value); setUsd(e.target.value) }} placeholder="0" />
          </FG>
        ) : (
          <>
            <FG label="Neto USD">
              <input type="number" min="0" step="0.0001" value={netoUSD} onChange={e => setNetoUSD(e.target.value)} placeholder="—" />
              <span className="calc-hint">IVA y Total USD se recalculan</span>
            </FG>
            <FG label="Total USD">
              <input type="number" min="0" step="0.0001" value={totalUSD} onChange={e => { setTotalUSD(e.target.value); setUsd(e.target.value) }} placeholder="—" style={{fontWeight:500}} />
            </FG>
            <FG label="IVA USD (calculado)"><input readOnly value={ivaUSD} placeholder="—" /></FG>
          </>
        )}

        {/* ───── Cobro ───── */}
        <div className="form-section">Datos de cobro</div>
        <FG label="N° Recibo"><input type="number" value={reciboId} onChange={e => setReciboId(e.target.value)} placeholder="—" /></FG>
        <FG label="Fecha de cobro"><input type="date" value={fechaCobro} onChange={e => setFechaCobro(e.target.value)} /></FG>

        {/* ───── Concepto ───── */}
        <div className="form-section">Concepto</div>
        <FG label="Detalle del servicio" full><textarea rows={3} value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Descripción detallada…" /></FG>
      </div>
    </Modal>
  )
}

// ── Marcar cobrada ─────────────────────────────────────────────
export function MarcarCobradaModal({ comp, nextReciboId, onClose, onSaved }: {
  comp: Comprobante; nextReciboId: number
  onClose: () => void; onSaved: () => void
}) {
  const [saving,    setSaving]    = useState(false)
  const [fecha,     setFecha]     = useState(today())
  const [nroRecibo, setNroRecibo] = useState('')
  const [pago,      setPago]      = useState('transferencia')
  const [echeq,     setEcheq]     = useState('')
  const [loadingN,  setLoadingN]  = useState(true)
  const [existente, setExistente] = useState(false)

  // Load next recibo ID dynamically from DB
  useEffect(() => {
    getNextReciboId().then(n => {
      setNroRecibo(String(n))
      setLoadingN(false)
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const rId = parseInt(nroRecibo)
      if (!rId) { toast('Ingresá un número de recibo válido'); setSaving(false); return }

      // Step 1: upsert recibo FIRST (FK requires recibo to exist before linking)
      const reciboData = {
        id: rId,
        fecha,
        cliente:    comp.cliente,
        nro_fact:   comp.id,
        persona:    comp.persona,
        monto_ars:  comp.monto_ars,
        monto_usd:  comp.monto_usd,
        forma_pago: existente ? 'transferencia' : pago,
        retencion:  null,
        nro_echeq:  existente ? null : (echeq || null),
      }
      const { error: reciboError } = await supabase
        .from('recibos')
        .upsert(reciboData, { onConflict: 'id', ignoreDuplicates: true })

      if (reciboError) {
        throw new Error('Error al registrar recibo: ' + reciboError.message)
      }

      // Step 2: now mark factura as cobrada (recibo already exists, FK satisfied)
      await db.updateComprobante(comp.id, {
        estado: 'cobrada',
        recibo_id: rId,
        fecha_cobro: fecha,
      })

      toast(existente
        ? `✓ Factura ${comp.id} vinculada al Recibo ${rId}`
        : `✓ Cobro registrado — Recibo ${rId}`
      )

      onSaved()
    } catch (e: any) {
      toast('Error: ' + (e.message || 'No se pudo registrar'))
    } finally { setSaving(false) }
  }

  return (
    <Modal title={`Registrar cobro — ${comp.id}`} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || loadingN}>
          {saving ? 'Guardando…' : 'Marcar cobrada'}
        </button>
      </>}>
      <div className="form-grid">
        <FG label="Fecha de cobro *">
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        </FG>
        <FG label="N° Recibo *">
          <input
            type="number"
            value={nroRecibo}
            onChange={e => setNroRecibo(e.target.value)}
            placeholder={loadingN ? 'Cargando…' : ''}
          />
          <span className="calc-hint">Número sugerido basado en el último recibo</span>
        </FG>
        <FG label=" " full>
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer', color:'var(--text-secondary)' }}>
            <input type="checkbox" checked={existente} onChange={e => setExistente(e.target.checked)} style={{ width:14, height:14 }} />
            Usar recibo existente (no crear uno nuevo)
          </label>
        </FG>
        <FG label="Forma de pago">
          <select value={pago} onChange={e => setPago(e.target.value)}>
            {['transferencia','cheque','e-cheq','efectivo'].map(p => <option key={p}>{p}</option>)}
          </select>
        </FG>
        <FG label="N° E-Cheq (si aplica)">
          <input placeholder="—" value={echeq} onChange={e => setEcheq(e.target.value)} />
        </FG>
      </div>
    </Modal>
  )
}
