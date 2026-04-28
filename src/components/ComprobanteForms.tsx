'use client'
import { useState, useEffect } from 'react'
import { db, Comprobante } from '@/lib/supabase'
import { Modal, FG, toast } from '@/components/ui'
import { PERSONAS, TODOS_TIPOS, today, buildComprobanteId } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const IVA_RATE = 0.21

// ── Nueva Factura ─────────────────────────────────────────────────────────────
export function NuevoComprobanteModal({
  onClose, onSaved, clientes
}: {
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
  // Money fields
  const [netoStr,  setNeto]     = useState('')
  const [ivaStr,   setIvaStr]   = useState('')
  const [totalStr, setTotal]    = useState('')
  const [usdStr,   setUsd]      = useState('')
  const [tcStr,    setTc]       = useState('')
  const [errors,   setErrors]   = useState<Record<string, boolean>>({})

  const isB      = tipo === 'FACT B'
  const isUSD    = !!usdStr && !totalStr && !netoStr
  const needsTC  = !!usdStr

  // Auto-calculate when neto changes (FACT A / C / E)
  useEffect(() => {
    if (isB) return
    const n = parseFloat(netoStr)
    if (!isNaN(n) && n > 0) {
      const iva   = Math.round(n * IVA_RATE * 100) / 100
      const total = Math.round((n + iva) * 100) / 100
      setIvaStr(String(iva))
      setTotal(String(total))
    } else if (!netoStr) {
      setIvaStr('')
      setTotal('')
    }
  }, [netoStr, isB])

  // Auto-calc neto from total (FACT B — no IVA)
  useEffect(() => {
    if (!isB) return
    setIvaStr('')
    setNeto('')
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

      const monto_ars  = isB
        ? (totalStr ? parseFloat(totalStr) : null)
        : (totalStr ? parseFloat(totalStr) : null)
      const monto_usd  = usdStr  ? parseFloat(usdStr)  : null
      const tipo_cambio = tcStr  ? parseFloat(tcStr)   : null
      const neto_ars   = !isB && netoStr ? parseFloat(netoStr) : null
      const iva_val    = !isB && ivaStr  ? parseFloat(ivaStr)  : null

      const payload: Omit<Comprobante, 'created_at'> = {
        id, tipo, numero: nextNum, fecha,
        cliente: cliente.trim(), persona, concepto: concepto.trim(),
        monto_ars, monto_usd, tipo_cambio,
        neto_ars, neto_usd: null, iva: iva_val,
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
    <Modal
      title="Nueva Factura / Comprobante"
      onClose={onClose}
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
          <input
            className={errors.cliente ? 'error' : ''}
            value={cliente}
            onChange={e => { setCliente(e.target.value); setErrors(p => ({...p, cliente: false})) }}
            placeholder="Razón social"
            list="cl-list"
          />
          <datalist id="cl-list">{clientes.map(c => <option key={c} value={c} />)}</datalist>
        </FG>
        <FG label="Persona / Unidad *">
          <select value={persona} onChange={e => setPersona(e.target.value)}>
            {PERSONAS.map(p => <option key={p}>{p}</option>)}
          </select>
        </FG>
        <FG label="Tipo de cambio (si es en USD)">
          <input type="number" min="0" step="0.01" placeholder="Ej: 1470" value={tcStr} onChange={e => setTc(e.target.value)} />
        </FG>

        <hr className="form-divider" />

        {/* USD fields */}
        <FG label="Monto USD (si aplica)">
          <input type="number" min="0" step="0.01" placeholder="0" value={usdStr} onChange={e => setUsd(e.target.value)} />
        </FG>

        <div /> {/* spacer */}

        {/* ARS fields — different for B vs A */}
        {isB ? (
          <>
            <FG label="Total ARS *">
              <input type="number" min="0" step="0.01" placeholder="0" value={totalStr} onChange={e => setTotal(e.target.value)} />
            </FG>
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 0 0', gridColumn: '2' }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Factura B — no lleva IVA</span>
            </div>
          </>
        ) : (
          <>
            <FG label="Neto ARS *">
              <input type="number" min="0" step="0.01" placeholder="Ingresá el neto" value={netoStr} onChange={e => setNeto(e.target.value)} />
              <span className="calc-hint">El IVA y el total se calculan solos</span>
            </FG>
            <FG label="IVA 21% (calculado)">
              <input type="number" readOnly value={ivaStr} placeholder="—" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }} />
            </FG>
            <FG label="Total con IVA (calculado)" full>
              <input type="number" readOnly value={totalStr} placeholder="—" style={{ background: 'var(--bg-secondary)', fontWeight: 500 }} />
            </FG>
          </>
        )}

        <FG label="Concepto *" full>
          <textarea
            className={errors.concepto ? 'error' : ''}
            rows={3}
            placeholder="Descripción detallada del servicio…"
            value={concepto}
            onChange={e => { setConcepto(e.target.value); setErrors(p => ({...p, concepto: false})) }}
          />
        </FG>
      </div>
    </Modal>
  )
}

// ── Editar ────────────────────────────────────────────────────────────────────
export function EditarComprobanteModal({
  comp, onClose, onSaved
}: {
  comp: Comprobante
  onClose: () => void
  onSaved: (c: Comprobante) => void
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
  const [reciboId,   setReciboId]   = useState(String(comp.recibo_id || ''))
  const [fechaCobro, setFechaCobro] = useState(comp.fecha_cobro || '')
  const [concepto,   setConcepto]   = useState(comp.concepto || '')

  // Auto-calc IVA on neto change
  useEffect(() => {
    if (comp.tipo === 'FACT B') return
    const n = parseFloat(netoStr)
    if (!isNaN(n) && n > 0) {
      const iva   = Math.round(n * IVA_RATE * 100) / 100
      const total = Math.round((n + iva) * 100) / 100
      setIva(String(iva))
      setArs(String(total))
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

  const isB = comp.tipo === 'FACT B'

  return (
    <Modal
      title={`Editar — ${comp.id}`}
      onClose={onClose}
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
            <FG label="IVA (calculado)"><input type="number" readOnly value={ivaStr} /></FG>
            <FG label="Total ARS (calculado)"><input type="number" readOnly value={arsStr} /></FG>
          </>
        )}
        <FG label="N° Recibo"><input type="number" value={reciboId} onChange={e => setReciboId(e.target.value)} placeholder="—" /></FG>
        <FG label="Fecha cobro"><input type="date" value={fechaCobro} onChange={e => setFechaCobro(e.target.value)} /></FG>
        <FG label="Concepto" full><textarea rows={3} value={concepto} onChange={e => setConcepto(e.target.value)} /></FG>
      </div>
    </Modal>
  )
}

// ── Marcar cobrada ────────────────────────────────────────────────────────────
export function MarcarCobradaModal({
  comp, nextReciboId, onClose, onSaved
}: {
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
        nro_fact: comp.id,  // ID completo ej: FC-A-4086 o FC-B-4070
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
    <Modal
      title={`Registrar cobro — ${comp.id}`}
      onClose={onClose}
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
