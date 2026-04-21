'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { db, Comprobante } from '@/lib/supabase'
import { ars, usd, fdate, PERSONAS, today } from '@/lib/utils'
import { TipoBadge, Spinner, Modal, FG, toast } from '@/components/ui'

type Tab = 'NC A' | 'NC B'

export default function NotasCredito(_: any) {
  const [data,    setData]    = useState<Comprobante[]>([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<Tab>('NC A')
  const [modal,   setModal]   = useState<'new'|'edit'|null>(null)
  const [sel,     setSel]     = useState<Comprobante|null>(null)

  const load = () => {
    setLoading(true)
    db.getComprobantes().then(rows => {
      setData(rows.filter(r => r.tipo === 'NC A' || r.tipo === 'NC B'))
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    if (!confirm(`¿Eliminar ${id}?`)) return
    await supabase.from('comprobantes').delete().eq('id', id)
    toast(`${id} eliminada`)
    load()
  }

  async function handleSaveEdit(id: string, patch: Partial<Comprobante>) {
    await supabase.from('comprobantes').update(patch).eq('id', id)
    toast('✓ Guardado')
    setModal(null); setSel(null); load()
  }

  const tabData = data
    .filter(f => f.tipo === tab)
    .sort((a, b) => (b.numero || 0) - (a.numero || 0))

  const total = tabData.reduce((s, f) => s + (f.monto_ars || 0), 0)
  const totalUSD = tabData.reduce((s, f) => s + (f.monto_usd || 0), 0)

  return (
    <>
      {/* Tabs */}
      <div className="fact-tabs">
        {(['NC A', 'NC B'] as Tab[]).map(t => (
          <button
            key={t}
            className={`fact-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            Notas de Crédito {t.split(' ')[1]}
            {tab === t && tabData.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
                ({tabData.length})
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => setModal('new')}>+ Nueva NC {tab.split(' ')[1]}</button>
      </div>

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginBottom: 16 }}>
        <div className="metric-card accent">
          <div className="metric-label">Total NC {tab.split(' ')[1]}</div>
          <div className="metric-value text-danger">-{ars(total)}</div>
          <div className="metric-sub">{tabData.length} notas</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total USD</div>
          <div className="metric-value">{usd(totalUSD)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Promedio por NC</div>
          <div className="metric-value">{tabData.length ? ars(total / tabData.length) : '—'}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Notas de Crédito {tab.split(' ')[1]} — ordenadas por número</span>
        </div>
        {loading ? <Spinner /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>N°</th><th>Fecha</th><th>Cliente</th><th>Persona</th>
                  {tab === 'NC A' && <th className="text-right">Neto</th>}
                  {tab === 'NC A' && <th className="text-right">IVA</th>}
                  <th className="text-right">Total ARS</th>
                  <th className="text-right">USD</th>
                  <th>Concepto</th><th></th>
                </tr>
              </thead>
              <tbody>
                {tabData.length === 0 ? (
                  <tr><td colSpan={10} className="empty-row">Sin notas de crédito {tab.split(' ')[1]}</td></tr>
                ) : tabData.map(f => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600, color: 'var(--danger)' }}>{f.numero}</td>
                    <td>{fdate(f.fecha)}</td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.cliente}</td>
                    <td className="text-dim" style={{ fontSize: 11.5 }}>{f.persona}</td>
                    {tab === 'NC A' && <td className="text-right text-mono">{ars(f.neto_ars)}</td>}
                    {tab === 'NC A' && <td className="text-right text-mono">{ars(f.iva)}</td>}
                    <td className="text-right text-mono" style={{ fontWeight: 500, color: 'var(--danger)' }}>-{ars(f.monto_ars)}</td>
                    <td className="text-right text-mono">{usd(f.monto_usd)}</td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 11.5, color: 'var(--text-secondary)' }}>{f.concepto}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm" onClick={() => { setSel(f); setModal('edit') }}>Editar</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(f.id)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal === 'new' && (
        <NuevaNCModal
          tipo={tab}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
          clientes={data.map(d => d.cliente).filter(Boolean)}
        />
      )}
      {modal === 'edit' && sel && (
        <EditarNCModal
          comp={sel}
          onClose={() => { setModal(null); setSel(null) }}
          onSaved={(patch) => handleSaveEdit(sel.id, patch)}
        />
      )}
    </>
  )
}

function NuevaNCModal({ tipo, onClose, onSaved, clientes }: {
  tipo: Tab; onClose: () => void; onSaved: () => void; clientes: string[]
}) {
  const [saving,   setSaving]   = useState(false)
  const [fecha,    setFecha]    = useState(today())
  const [cliente,  setCliente]  = useState('')
  const [persona,  setPersona]  = useState(PERSONAS[0])
  const [neto,     setNeto]     = useState('')
  const [iva,      setIva]      = useState('')
  const [arsV,     setArs]      = useState('')
  const [usdV,     setUsd]      = useState('')
  const [concepto, setConcepto] = useState('')

  useEffect(() => {
    if (tipo === 'NC A') {
      const n = parseFloat(neto)
      if (!isNaN(n) && n > 0) {
        setIva(String(Math.round(n * 0.21 * 100) / 100))
        setArs(String(Math.round(n * 1.21 * 100) / 100))
      } else { setIva(''); setArs('') }
    }
  }, [neto, tipo])

  async function save() {
    if (!cliente.trim()) { toast('El cliente es obligatorio'); return }
    setSaving(true)
    try {
      const { data: last } = await supabase.from('comprobantes')
        .select('numero').eq('tipo', tipo)
        .order('numero', { ascending: false }).limit(1)
      const nextNum = last && last[0] ? (last[0].numero ?? 400) + 1 : 401
      const id = `${tipo.replace(/ /g, '-')}-${nextNum}`
      await supabase.from('comprobantes').insert({
        id, tipo, numero: nextNum, fecha,
        cliente: cliente.trim(), persona,
        concepto: concepto.trim(),
        monto_ars: arsV ? parseFloat(arsV) : (usdV ? null : null),
        monto_usd: usdV ? parseFloat(usdV) : null,
        neto_ars:  neto ? parseFloat(neto) : null,
        iva:       iva  ? parseFloat(iva)  : null,
        estado:    'emitida',
      })
      toast(`✓ ${id} creada`)
      onSaved()
    } catch (e: any) {
      toast('Error: ' + (e.message || ''))
    } finally { setSaving(false) }
  }

  return (
    <Modal title={`Nueva Nota de Crédito ${tipo.split(' ')[1]}`} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </>}>
      <div className="form-grid">
        <FG label="Fecha"><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></FG>
        <FG label="Cliente *" full>
          <input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Razón social" list="nc-cl" />
          <datalist id="nc-cl">{clientes.map(c => <option key={c} value={c} />)}</datalist>
        </FG>
        <FG label="Persona / Unidad">
          <select value={persona} onChange={e => setPersona(e.target.value)}>
            {PERSONAS.map(p => <option key={p}>{p}</option>)}
          </select>
        </FG>
        <div />
        {tipo === 'NC A' ? (
          <>
            <FG label="Neto ARS">
              <input type="number" placeholder="0" value={neto} onChange={e => setNeto(e.target.value)} />
              <span className="calc-hint">IVA y total se calculan solos</span>
            </FG>
            <FG label="IVA (calculado)"><input readOnly value={iva} placeholder="—" /></FG>
            <FG label="Total ARS (calculado)" full><input readOnly value={arsV} placeholder="—" /></FG>
          </>
        ) : (
          <>
            <FG label="Total ARS"><input type="number" placeholder="0" value={arsV} onChange={e => setArs(e.target.value)} /></FG>
            <FG label="Total USD"><input type="number" placeholder="0" value={usdV} onChange={e => setUsd(e.target.value)} /></FG>
          </>
        )}
        <FG label="Concepto" full>
          <textarea rows={2} value={concepto} onChange={e => setConcepto(e.target.value)} />
        </FG>
      </div>
    </Modal>
  )
}

function EditarNCModal({ comp, onClose, onSaved }: {
  comp: Comprobante; onClose: () => void; onSaved: (p: Partial<Comprobante>) => void
}) {
  const [fecha,    setFecha]    = useState(comp.fecha || '')
  const [cliente,  setCliente]  = useState(comp.cliente || '')
  const [persona,  setPersona]  = useState(comp.persona || PERSONAS[0])
  const [neto,     setNeto]     = useState(String(comp.neto_ars || ''))
  const [iva,      setIva]      = useState(String(comp.iva || ''))
  const [arsV,     setArs]      = useState(String(comp.monto_ars || ''))
  const [usdV,     setUsd]      = useState(String(comp.monto_usd || ''))
  const [concepto, setConcepto] = useState(comp.concepto || '')

  useEffect(() => {
    if (comp.tipo === 'NC A') {
      const n = parseFloat(neto)
      if (!isNaN(n) && n > 0) {
        setIva(String(Math.round(n * 0.21 * 100) / 100))
        setArs(String(Math.round(n * 1.21 * 100) / 100))
      }
    }
  }, [neto])

  return (
    <Modal title={`Editar ${comp.id}`} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onSaved({
          fecha, cliente: cliente.trim(), persona, concepto: concepto.trim(),
          neto_ars: neto ? parseFloat(neto) : null,
          iva:      iva  ? parseFloat(iva)  : null,
          monto_ars: arsV ? parseFloat(arsV) : null,
          monto_usd: usdV ? parseFloat(usdV) : null,
        })}>Guardar</button>
      </>}>
      <div className="form-grid">
        <FG label="Fecha"><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></FG>
        <FG label="Cliente"><input value={cliente} onChange={e => setCliente(e.target.value)} /></FG>
        <FG label="Persona">
          <select value={persona} onChange={e => setPersona(e.target.value)}>
            {PERSONAS.map(p => <option key={p}>{p}</option>)}
          </select>
        </FG>
        <div />
        {comp.tipo === 'NC A' ? (
          <>
            <FG label="Neto"><input type="number" value={neto} onChange={e => setNeto(e.target.value)} /></FG>
            <FG label="IVA (calculado)"><input readOnly value={iva} /></FG>
            <FG label="Total (calculado)" full><input readOnly value={arsV} /></FG>
          </>
        ) : (
          <>
            <FG label="Total ARS"><input type="number" value={arsV} onChange={e => setArs(e.target.value)} /></FG>
            <FG label="Total USD"><input type="number" value={usdV} onChange={e => setUsd(e.target.value)} /></FG>
          </>
        )}
        <FG label="Concepto" full><textarea rows={2} value={concepto} onChange={e => setConcepto(e.target.value)} /></FG>
      </div>
    </Modal>
  )
}
