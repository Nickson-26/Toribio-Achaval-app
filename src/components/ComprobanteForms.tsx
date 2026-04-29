'use client'
import { useState, useEffect } from 'react'
import { db, Comprobante } from '@/lib/supabase'
import { Modal, FG, toast } from '@/components/ui'
import { PERSONAS, TODOS_TIPOS, today, buildComprobanteId } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const IVA_RATE = 0.21

// ── Nueva Factura ──────────────────────────────────────────────────────────────
export function NuevoComprobanteModal({ onClose, onSaved, clientes }: {
  onClose: () => void
  onSaved: (c: Comprobante) => void
  clientes: string[]
}) {
  const [saving,   setSaving]   = useState(false)
  const [tipo,     setTipo]     = useState('FACT A')
  const [fecha,    setFecha]    = useState(today())
  const [cliente,  setCliente]  = useState('')
  const [persona,  setPersona]  = useState(PERSONAS[0])
  const [concepto, setConcepto] = useState('')
  const [netoARS,  setNetoARS]  = useState('')
  const [ivaARS,   setIvaARS]   = useState('')
  const [totalARS, setTotalARS] = useState('')
  const [netoUSD,  setNetoUSD]  = useState('')
  const [ivaUSD,   setIvaUSD]   = useState('')
  const [totalUSD, setTotalUSD] = useState('')
  const [tcStr,    setTc]       = useState('')
  const [errors,   setErrors]   = useState<Record<string, boolean>>({})

  const isB    = tipo === 'FACT B'
  const hasUSD = !!netoUSD || !!totalUSD

  // Auto-calc ARS IVA from neto ARS
  useEffect(() => {
    if (isB || !netoARS) { setIvaARS(''); setTotalARS(''); return }
    const n = parseFloat(netoARS)
    if (!isNaN(n) && n > 0) {
      const iva   = Math.round(n * IVA_RATE * 100) / 100
      setIvaARS(String(iva))
      setTotalARS(String(Math.round((n + iva) * 100) / 100))
    }
  }, [netoARS, isB])

  // Auto-calc USD IVA from neto USD
  useEffect(() => {
    if (isB || !netoUSD) { setIvaUSD(''); setTotalUSD(''); return }
    const n = parseFloat(netoUSD)
    if (!isNaN(n) && n > 0) {
      const iva   = Math.round(n * IVA_RATE * 10000) / 10000
      setIvaUSD(String(iva))
      setTotalUSD(String(Math.round((n + iva) * 10000) / 10000))
    }
  }, [netoUSD, isB])

  // When tipo changes to B, clear IVA fields
  useEffect(() => {
    if (isB) { setIvaARS(''); setIvaUSD(''); setNetoARS(''); setNetoUSD('') }
  }, [isB])

  async function handleSave() {
    const errs: Record<string, boolean> = {}
    if (!cliente.trim())  errs.cliente  = true
    if (!concepto.trim()) errs.concepto = true
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      const { data: last } = await supabase
        .from('comprobantes').select('numero').eq('tipo', tipo)
        .order('numero', { ascending: false }).limit(1)
      const nextNum = last && last[0] ? (last[0].numero ?? 4000) + 1 : 4001
      const id = buildComprobanteId(tipo, nextNum)

      const tc = tcStr ? parseFloat(tcStr) : null

      // If USD, convert to ARS using TC for storage
      const monto_usd   = hasUSD && !isB ? (totalUSD ? parseFloat(totalUSD) : null) : null
      const neto_usd    = hasUSD && !isB ? (netoUSD  ? parseFloat(netoUSD)  : null) : null
      const monto_ars   = isB
        ? (totalARS ? parseFloat(totalARS) : null)
        : hasUSD && tc
          ? (monto_usd ? Math.round(monto_usd * tc * 100) / 100 : null)
          : (totalARS ? parseFloat(totalARS) : null)
      const neto_ars    = !isB
        ? hasUSD && tc && neto_usd
          ? Math.round(neto_usd * tc * 100) / 100
          : (netoARS ? parseFloat(netoARS) : null)
        : null
      const iva_ars     = !isB
        ? hasUSD && tc && ivaUSD
          ? Math.round(parseFloat(ivaUSD) * tc * 100) / 100
          : (ivaARS ? parseFloat(ivaARS) : null)
        : null

      const payload: Omit<Comprobante, 'created_at'> = {
        id, tipo, numero: nextNum, fecha,
        cliente: cliente.trim(), persona, concepto: concepto.trim(),
        monto_ars, monto_usd, tipo_cambio: tc,
        neto_ars, neto_usd, iva: iva_ars,
        arba_ars: null, arba_usd: null,
        estado: tipo.startsWith('FACT') ? 'pendiente' : 'emitida',
        recibo_id: null, fecha_cobro: null,
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
      </>}
    >
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
        <FG label="Tipo de cambio (si es en USD)">
          <input type="number" min="0" step="0.01" placeholder="Ej: 1470" value={tcStr}
            onChange={e => setTc(e.target.value)} />
        </FG>

        <hr className="form-divider" />

        {isB ? (
          /* FACT B — solo total, sin IVA */
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
              <span className="calc-hint" style={{ color: 'var(--info)' }}>
                Factura B — no lleva IVA
              </span>
            </div>
          </>
        ) : (
          /* FACT A / FCE / E — neto + IVA calculado */
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
            <FG label="IVA ARS (calculado)">
              <input readOnly value={ivaARS} placeholder="—" />
            </FG>
            <FG label="IVA USD (calculado)">
              <input readOnly value={ivaUSD} placeholder="—" />
            </FG>
            <FG label="Total ARS (calculado)">
              <input readOnly value={totalARS} placeholder="—" style={{ fontWeight: 500 }} />
            </FG>
            <FG label="Total USD (calculado)">
              <input readOnly value={totalUSD} placeholder="—" style={{ fontWeight: 500 }} />
            </FG>
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

// ── Editar ─────────────────────────────────────────────────────────────────────
export function EditarComprobanteModal({ comp, onClose, onSaved }: {
  comp: Comprobante; onClose: () => void; onSaved: (c: Comprobante) => void
}) {
  const [saving,     setSaving]     = useState(false)
  const [fecha,      setFecha]      = useState(comp.fecha || '')
  const [estado,     setEstado]     = useState(comp.estado)
  const [cliente,    setCliente]    = useState(comp.cliente || '')
  const [persona,    setPersona]    = useState(comp.persona || '')
  const [tcStr,      setTc]         = useState(String(comp.tipo_cambio || ''))
  const [arsStr,     setArs]        = useState(String(comp.monto_ars || ''))
  const [usdStr,     setUsd]        = useState(String(comp.monto_usd || ''))
  const [netoStr,    setNeto]       = useState(String(comp.neto_ars || ''))
  const [ivaStr,     setIva]        = useState(String(comp.iva || ''))
  const [netoUSD,    setNetoUSD]    = useState(String(comp.neto_usd || ''))
  const [reciboId,   setReciboId]   = useState(String(comp.recibo_id || ''))
  const [fechaCobro, setFechaCobro] = useState(comp.fecha_cobro || '')
  const [concepto,   setConcepto]   = useState(comp.concepto || '')

  const isB = comp.tipo === 'FACT B'

  useEffect(() => {
    if (isB) return
    const n = parseFloat(netoStr)
    if (!isNaN(n) && n > 0) {
      const iva   = Math.round(n * IVA_RATE * 100) / 100
      setIva(String(iva))
      setArs(String(Math.round((n + iva) * 100) / 100))
    }
  }, [netoStr])

  async function handleSave() {
    setSaving(true)
    try {
      const saved = await db.updateComprobante(comp.id, {
        fecha, estado, cliente: cliente.trim(), persona,
        tipo_cambio: tcStr     ? parseFloat(tcStr)     : null,
        monto_ars:   arsStr    ? parseFloat(arsStr)    : null,
        monto_usd:   usdStr    ? parseFloat(usdStr)    : null,
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
    <Modal title={`Editar — ${comp.id}`} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </>}
    >
      <div className="form-grid">
        <FG label="Fecha"><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></FG>
        <FG label="Estado">
          <select value={estado} onChange={e => setEstado(e.target.value as any)}>
            {['pendiente','cobrada','anulada','emitida'].map(s => <option key={s}>{s}</option>)}
          </select>
        </FG>
        <FG label="Cliente" full><input value={cliente} onChange={e => setCliente(e.target.value)} /></FG>
        <FG label="Persona / Unidad">
          <select value={persona} onChange={e => setPersona(e.target.value)}>
            {PERSONAS.map(p => <option key={p}>{p}</option>)}
          </select>
        </FG>
        <FG label="Tipo de cambio"><input type="number" value={tcStr} onChange={e => setTc(e.target.value)} placeholder="—" /></FG>
        <FG label="Monto USD"><input type="number" value={usdStr} onChange={e => setUsd(e.target.value)} placeholder="—" /></FG>
        {isB ? (
          <FG label="Total ARS"><input type="number" value={arsStr} onChange={e => setArs(e.target.value)} /></FG>
        ) : (
          <>
            <FG label="Neto ARS">
              <input type="number" value={netoStr} onChange={e => setNeto(e.target.value)} placeholder="—" />
              <span className="calc-hint">IVA y total se recalculan solos</span>
            </FG>
            <FG label="Neto USD"><input type="number" value={netoUSD} onChange={e => setNetoUSD(e.target.value)} placeholder="—" /></FG>
            <FG label="IVA ARS (calculado)"><input readOnly value={ivaStr} /></FG>
            <FG label="Total ARS (calculado)"><input readOnly value={arsStr} /></FG>
          </>
        )}
        <FG label="N° Recibo"><input type="number" value={reciboId} onChange={e => setReciboId(e.target.value)} placeholder="—" /></FG>
        <FG label="Fecha cobro"><input type="date" value={fechaCobro} onChange={e => setFechaCobro(e.target.value)} /></FG>
        <FG label="Concepto" full><textarea rows={3} value={concepto} onChange={e => setConcepto(e.target.value)} /></FG>
      </div>
    </Modal>
  )
}

// ── Marcar cobrada ─────────────────────────────────────────────────────────────
export function MarcarCobradaModal({ comp, nextReciboId, onClose, onSaved }: {
  comp: Comprobante; nextReciboId: number
  onClose: () => void; onSaved: () => void
}) {
  const [saving,    setSaving]    = useState(false)
  const [fecha,     setFecha]     = useState(today())
  const [nroRecibo, setNroRecibo] = useState(String(nextReciboId))
  const [pago,      setPago]      = useState('transferencia')
  const [echeq,     setEcheq]     = useState('')

  async function handleSave() {
    setSaving(true)
    try {
      const rId = parseInt(nroRecibo) || nextReciboId
      await db.updateComprobante(comp.id, { estado: 'cobrada', recibo_id: rId, fecha_cobro: fecha })
      await db.createRecibo({
        id: rId, fecha, cliente: comp.cliente,
        nro_fact: comp.id,
        persona: comp.persona,
        monto_ars: comp.monto_ars, monto_usd: comp.monto_usd,
        forma_pago: pago, retencion: null,
        nro_echeq: echeq || null,
      })
      toast(`✓ Cobro registrado — Recibo ${rId}`)
      onSaved()
    } catch (e: any) {
      toast('Error: ' + (e.message || 'No se pudo registrar'))
    } finally { setSaving(false) }
  }

  return (
    <Modal title={`Registrar cobro — ${comp.id}`} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Marcar cobrada'}
        </button>
      </>}
    >
      <div className="form-grid">
        <FG label="Fecha de cobro *"><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></FG>
        <FG label="N° Recibo *"><input type="number" value={nroRecibo} onChange={e => setNroRecibo(e.target.value)} /></FG>
        <FG label="Forma de pago">
          <select value={pago} onChange={e => setPago(e.target.value)}>
            {['transferencia','cheque','e-cheq','efectivo'].map(p => <option key={p}>{p}</option>)}
          </select>
        </FG>
        <FG label="N° E-Cheq (si aplica)"><input placeholder="—" value={echeq} onChange={e => setEcheq(e.target.value)} /></FG>
      </div>
    </Modal>
  )
}
