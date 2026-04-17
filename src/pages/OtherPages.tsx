'use client'
import { useEffect, useState, useCallback } from 'react'
import { db, Recibo, Comprobante } from '@/lib/supabase'
import { ars, usd, fdate, montoARS, PERSONAS, today, downloadCSV, MESES } from '@/lib/utils'
import { TipoBadge, Spinner, Modal, FG, toast } from '@/components/ui'

// ══════════════════════════════════════════════════════════════
// RECIBOS
// ══════════════════════════════════════════════════════════════
export function Recibos(_: any) {
  const [data,    setData]    = useState<Recibo[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [modal,   setModal]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await db.getRecibos(search || undefined)) }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  const totARS = data.reduce((s, r) => s + (r.monto_ars || 0), 0)
  const totUSD = data.reduce((s, r) => s + (r.monto_usd || 0), 0)

  function handleExport() {
    const rows: (string|number|null)[][] = [['N° Recibo','Fecha','Cliente','N° Fact.','Persona','Forma pago','ARS','USD']]
    data.forEach(r => rows.push([r.id, r.fecha, r.cliente, r.nro_fact, r.persona, r.forma_pago, r.monto_ars, r.monto_usd]))
    downloadCSV(rows, 'recibos_toribio_achaval.csv')
  }

  return (
    <>
      <div className="toolbar">
        <input placeholder="Buscar cliente, N° recibo…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn" onClick={handleExport}>↓ CSV</button>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Nuevo recibo</button>
      </div>

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
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
                <th className="text-right">ARS</th><th className="text-right">USD</th>
              </tr></thead>
              <tbody>
                {data.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500, color: 'var(--accent)' }}>{r.id}</td>
                    <td>{fdate(r.fecha)}</td>
                    <td>{r.cliente}</td>
                    <td className="text-dim">{r.nro_fact || '—'}</td>
                    <td className="text-dim" style={{ fontSize: 11.5 }}>{r.persona}</td>
                    <td><span className="badge badge-gray">{r.forma_pago || '—'}</span></td>
                    <td className="text-right text-mono" style={{ fontWeight: 500 }}>{ars(r.monto_ars)}</td>
                    <td className="text-right text-mono">{usd(r.monto_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <NuevoReciboModal onClose={() => setModal(false)} onSaved={() => { setModal(false); load() }} />}
    </>
  )
}

function NuevoReciboModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [fecha,    setFecha]    = useState(today())
  const [cliente,  setCliente]  = useState('')
  const [nroFact,  setNroFact]  = useState('')
  const [persona,  setPersona]  = useState(PERSONAS[0])
  const [pago,     setPago]     = useState('transferencia')
  const [arsV,     setArs]      = useState('')
  const [usdV,     setUsd]      = useState('')

  async function save() {
    if (!cliente.trim()) return toast('El cliente es obligatorio')
    setSaving(true)
    try {
      const { data: last } = await import('@/lib/supabase').then(m =>
        m.supabase.from('recibos').select('id').order('id', { ascending: false }).limit(1)
      )
      const nextId = last && last[0] ? last[0].id + 1 : 19200
      await db.createRecibo({
        id: nextId, fecha, cliente: cliente.trim(),
        nro_fact: nroFact || null, persona, forma_pago: pago,
        monto_ars: arsV ? parseFloat(arsV) : null,
        monto_usd: usdV ? parseFloat(usdV) : null,
        retencion: null, nro_echeq: null,
      })
      toast(`✓ Recibo ${nextId} guardado`)
      onSaved()
    } catch (e: any) {
      toast('Error: ' + (e.message || 'No se pudo guardar'))
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Nuevo Recibo" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Guardando…':'Guardar recibo'}</button></>}>
      <div className="form-grid">
        <FG label="Fecha *"><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></FG>
        <FG label="Cliente *" full><input value={cliente} onChange={e=>setCliente(e.target.value)} placeholder="Razón social"/></FG>
        <FG label="N° Factura"><input value={nroFact} onChange={e=>setNroFact(e.target.value)} placeholder="Ej: 4070"/></FG>
        <FG label="Persona / Unidad"><select value={persona} onChange={e=>setPersona(e.target.value)}>{PERSONAS.map(p=><option key={p}>{p}</option>)}</select></FG>
        <FG label="Forma de pago"><select value={pago} onChange={e=>setPago(e.target.value)}>{['transferencia','cheque','e-cheq','efectivo'].map(p=><option key={p}>{p}</option>)}</select></FG>
        <FG label="placeholder"> <input style={{display:'none'}}/> </FG>
        <FG label="Cobrado ARS"><input type="number" min="0" step="0.01" placeholder="0" value={arsV} onChange={e=>setArs(e.target.value)}/></FG>
        <FG label="Cobrado USD"><input type="number" min="0" step="0.01" placeholder="0" value={usdV} onChange={e=>setUsd(e.target.value)}/></FG>
      </div>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════════
// CLIENTES
// ══════════════════════════════════════════════════════════════
export function Clientes(_: any) {
  const [data,    setData]    = useState<Comprobante[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    db.getComprobantes().then(rows => { setData(rows); setLoading(false) })
  }, [])

  const map: Record<string, { nombre: string; docs: number; ars: number; usd: number; personas: Set<string>; ultimo: string }> = {}
  data.forEach(f => {
    if (!f.cliente || f.cliente === 'ANULADO') return
    if (!map[f.cliente]) map[f.cliente] = { nombre: f.cliente, docs: 0, ars: 0, usd: 0, personas: new Set(), ultimo: '' }
    map[f.cliente].docs++
    map[f.cliente].ars += f.monto_ars || 0
    map[f.cliente].usd += f.monto_usd || 0
    map[f.cliente].personas.add(f.persona)
    if ((f.fecha||'') > map[f.cliente].ultimo) map[f.cliente].ultimo = f.fecha
  })
  let clientes = Object.values(map).sort((a, b) => b.ars - a.ars)
  if (search) clientes = clientes.filter(c => c.nombre.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <div className="toolbar">
        <input placeholder="Buscar cliente…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">Clientes ({clientes.length})</span></div>
        {loading ? <Spinner /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Cliente</th><th>Personas / Unidades</th><th>Comprobantes</th><th className="text-right">Total ARS</th><th className="text-right">Total USD</th><th>Último</th></tr></thead>
              <tbody>
                {clientes.map(c => (
                  <tr key={c.nombre}>
                    <td style={{ fontWeight: 500 }}>{c.nombre}</td>
                    <td>{Array.from(c.personas).filter(Boolean).map(p => <span key={p} className="badge badge-gray" style={{ marginRight: 3 }}>{p}</span>)}</td>
                    <td style={{ textAlign: 'center' }}>{c.docs}</td>
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
  const [data, setData] = useState<Comprobante[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)

  const load = () => {
    setLoading(true)
    db.getComprobantes().then(rows => {
      setData(rows.filter(r => r.tipo.startsWith('NC')))
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [])

  const total = data.reduce((s, f) => s + (f.monto_ars || 0), 0)

  return (
    <>
      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Nueva NC</button>
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Notas de Crédito ({data.length})</span>
          <span className="card-hint text-danger">Total: -{ars(total)}</span>
        </div>
        {loading ? <Spinner /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Persona</th><th className="text-right">Neto</th><th className="text-right">IVA</th><th className="text-right">Total ARS</th><th>Concepto</th></tr></thead>
              <tbody>
                {data.length === 0 ? <tr><td colSpan={9} className="empty-row">Sin notas de crédito</td></tr> :
                  data.map(f => (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 500, color: 'var(--danger)' }}>{f.id}</td>
                      <td>{fdate(f.fecha)}</td>
                      <td>{f.cliente}</td>
                      <td><TipoBadge tipo={f.tipo} /></td>
                      <td className="text-dim" style={{ fontSize: 11.5 }}>{f.persona}</td>
                      <td className="text-right text-mono">{ars(f.neto_ars)}</td>
                      <td className="text-right text-mono">{ars(f.iva)}</td>
                      <td className="text-right text-mono" style={{ fontWeight: 500 }}>{ars(f.monto_ars)}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 11.5, color: 'var(--text-secondary)' }}>{f.concepto}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {modal && (
        <NuevoComprobanteModal
          clientes={data.map(d => d.cliente).filter(Boolean)}
          tipoDefault="NC A"
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); load() }}
        />
      )}
    </>
  )
}

function NuevoComprobanteModal({ onClose, onSaved, clientes, tipoDefault }: {
  onClose: () => void; onSaved: () => void; clientes: string[]; tipoDefault?: string
}) {
  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <div style={{ fontSize: 15, fontWeight: 600 }}>Nuevo Comprobante</div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: 20, color: 'var(--text-secondary)', fontSize: 13 }}>
          Usá el botón "Nueva factura" del menú superior para crear cualquier tipo de comprobante.
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Entendido</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// NOTAS DE DÉBITO
// ══════════════════════════════════════════════════════════════
export function NotasDebito(_: any) {
  const [data, setData] = useState<Comprobante[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    db.getComprobantes().then(rows => { setData(rows.filter(r => r.tipo.startsWith('ND'))); setLoading(false) })
  }, [])

  return (
    <div className="card">
      <div className="card-header"><span className="card-title">Notas de Débito ({data.length})</span></div>
      {loading ? <Spinner /> : data.length === 0 ? (
        <div className="empty-row">Sin notas de débito registradas en 2026</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Persona</th><th className="text-right">Monto ARS</th><th className="text-right">Monto USD</th><th>Concepto</th></tr></thead>
            <tbody>
              {data.map(f => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 500 }}>{f.id}</td>
                  <td>{fdate(f.fecha)}</td><td>{f.cliente}</td>
                  <td><TipoBadge tipo={f.tipo} /></td>
                  <td className="text-dim">{f.persona}</td>
                  <td className="text-right text-mono">{ars(f.monto_ars)}</td>
                  <td className="text-right text-mono">{usd(f.monto_usd)}</td>
                  <td style={{ fontSize: 11.5 }}>{f.concepto}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// RESUMEN ANUAL
// ══════════════════════════════════════════════════════════════
export function Resumen(_: any) {
  const [comps, setComps] = useState<Comprobante[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { db.getComprobantes().then(rows => { setComps(rows); setLoading(false) }) }, [])

  if (loading) return <Spinner />

  const facts = comps.filter(c => c.tipo.startsWith('FACT') && c.estado !== 'anulada')
  const ncs   = comps.filter(c => c.tipo.startsWith('NC'))

  const byTipo: Record<string, { ars: number; usd: number; count: number }> = {}
  facts.forEach(f => {
    if (!byTipo[f.tipo]) byTipo[f.tipo] = { ars: 0, usd: 0, count: 0 }
    byTipo[f.tipo].ars   += f.monto_ars || 0
    byTipo[f.tipo].usd   += f.monto_usd || 0
    byTipo[f.tipo].count++
  })

  const byMes: Record<string, { ars: number; usd: number }> = {}
  facts.forEach(f => {
    const k = f.fecha?.slice(0,7) || 'N/A'
    if (!byMes[k]) byMes[k] = { ars: 0, usd: 0 }
    byMes[k].ars += f.monto_ars || 0
    byMes[k].usd += f.monto_usd || 0
  })

  const byPers: Record<string, { ars: number; usd: number; count: number }> = {}
  facts.forEach(f => {
    if (!byPers[f.persona]) byPers[f.persona] = { ars: 0, usd: 0, count: 0 }
    byPers[f.persona].ars   += montoARS(f)
    byPers[f.persona].usd   += f.monto_usd || 0
    byPers[f.persona].count++
  })

  const totalARS = Object.values(byTipo).reduce((s, v) => s + v.ars, 0)
  const totalNC  = ncs.reduce((s, f) => s + (f.monto_ars || 0), 0)

  return (
    <>
      <div className="two-col">
        <div className="card">
          <div className="card-header"><span className="card-title">Por tipo de comprobante</span></div>
          <div style={{ padding: '14px 16px' }}>
            {Object.entries(byTipo).map(([tipo, v]) => (
              <div key={tipo} className="sum-row">
                <span><TipoBadge tipo={tipo} /></span>
                <span style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span className="text-mono">{ars(v.ars)}</span>
                  {v.usd > 0 && <span className="text-mono text-dim">{usd(v.usd)}</span>}
                  <span className="text-dim" style={{ fontSize: 11 }}>{v.count} docs</span>
                </span>
              </div>
            ))}
            <div className="sum-row" style={{ marginTop: 8 }}>
              <span style={{ fontWeight: 600 }}>Total Facturado ARS</span>
              <span className="text-mono" style={{ fontWeight: 600 }}>{ars(totalARS)}</span>
            </div>
            <div className="sum-row">
              <span className="text-danger">— Notas de Crédito</span>
              <span className="text-mono text-danger">-{ars(totalNC)}</span>
            </div>
            <div className="sum-row" style={{ fontSize: 15 }}>
              <span style={{ fontWeight: 600 }}>Neto Facturado</span>
              <span className="text-mono text-success" style={{ fontWeight: 600 }}>{ars(totalARS - totalNC)}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Por mes</span></div>
          <div style={{ padding: '14px 16px' }}>
            {Object.entries(byMes).sort().map(([mes, v]) => (
              <div key={mes} className="sum-row">
                <span>{mes}</span>
                <span style={{ display: 'flex', gap: 12 }}>
                  <span className="text-mono">{ars(v.ars)}</span>
                  {v.usd > 0 && <span className="text-mono text-dim">{usd(v.usd)}</span>}
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
            <thead><tr><th>Persona / Unidad</th><th style={{ textAlign: 'center' }}>Facturas</th><th className="text-right">Total ARS</th><th className="text-right">Total USD</th><th className="text-right">% del total</th></tr></thead>
            <tbody>
              {Object.entries(byPers).sort((a, b) => b[1].ars - a[1].ars).map(([p, v]) => (
                <tr key={p}>
                  <td style={{ fontWeight: 500 }}>{p}</td>
                  <td style={{ textAlign: 'center' }}>{v.count}</td>
                  <td className="text-right text-mono">{ars(v.ars)}</td>
                  <td className="text-right text-mono">{v.usd > 0 ? usd(v.usd) : '—'}</td>
                  <td className="text-right">{totalARS > 0 ? Math.round((v.ars / totalARS) * 100) : 0}%</td>
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
