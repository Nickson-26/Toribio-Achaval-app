'use client'
import { useEffect, useState, useCallback } from 'react'
import { db, Comprobante } from '@/lib/supabase'
import { ars, usd, fdate, PERSONAS, TIPOS_FACT, downloadCSV } from '@/lib/utils'
import { TipoBadge, EstadoBadge, Spinner, Modal, toast } from '@/components/ui'
import { NuevoComprobanteModal, EditarComprobanteModal, MarcarCobradaModal } from '@/components/ComprobanteForms'

type Modal = 'detail' | 'new' | 'edit' | 'cobrar' | null

export default function Facturas({ onPendientesChange }: { onPendientesChange?: (n: number) => void }) {
  const [data,     setData]     = useState<Comprobante[]>([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState<Modal>(null)
  const [selected, setSelected] = useState<Comprobante | null>(null)
  const [search,   setSearch]   = useState('')
  const [fTipo,    setFTipo]    = useState('all')
  const [fPers,    setFPers]    = useState('all')
  const [fEst,     setFEst]     = useState('all')
  const [clientes, setClientes] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await db.getComprobantes({
        tipo: fTipo, persona: fPers, estado: fEst, search: search || undefined
      })
      const facts = rows.filter(r => r.tipo.startsWith('FACT'))
      setData(facts)
      setClientes(Array.from(new Set(facts.map(f => f.cliente).filter(Boolean))))
      onPendientesChange?.(facts.filter(f => f.estado === 'pendiente').length)
    } finally { setLoading(false) }
  }, [fTipo, fPers, fEst, search])

  useEffect(() => { load() }, [load])

  function openDetail(c: Comprobante) { setSelected(c); setModal('detail') }
  function closeModal() { setModal(null); setSelected(null) }

  async function handleAnular(id: string) {
    if (!confirm(`¿Confirmar anulación de ${id}?`)) return
    await db.deleteComprobante(id)
    toast(`Comprobante ${id} anulado`)
    closeModal(); load()
  }

  function handleExport() {
    const rows: (string | number | null)[][] = [
      ['ID','Tipo','Fecha','Cliente','Persona','Monto ARS','Monto USD','TC','Neto','IVA','Concepto','Recibo','Fecha Cobro','Estado']
    ]
    data.forEach(f => {
      rows.push([f.id,f.tipo,f.fecha,f.cliente,f.persona,f.monto_ars,f.monto_usd,f.tipo_cambio,f.neto_ars,f.iva,f.concepto,f.recibo_id,f.fecha_cobro,f.estado])
    })
    downloadCSV(rows, 'facturas_toribio_achaval.csv')
  }

  const totARS = data.filter(f => f.estado !== 'anulada').reduce((s, f) => s + (f.monto_ars || 0), 0)

  const nextReciboId = () => {
    const max = Math.max(...data.map(f => f.recibo_id || 0).filter(Boolean), 19160)
    return max + 1
  }

  return (
    <>
      <div className="toolbar">
        <input placeholder="Buscar cliente, N°, concepto…" value={search}
          onChange={e => setSearch(e.target.value)} />
        <select value={fTipo} onChange={e => setFTipo(e.target.value)}>
          <option value="all">Todos los tipos</option>
          {TIPOS_FACT.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={fPers} onChange={e => setFPers(e.target.value)}>
          <option value="all">Todas las personas</option>
          {PERSONAS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={fEst} onChange={e => setFEst(e.target.value)}>
          <option value="all">Todos los estados</option>
          {['pendiente','cobrada','anulada'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn" onClick={handleExport}>↓ CSV</button>
        <button className="btn btn-primary" onClick={() => setModal('new')}>+ Nueva factura</button>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Facturas ({data.length})</span>
          <span className="card-hint">Total: {ars(totARS)}</span>
        </div>
        {loading ? <Spinner /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>N° Comp.</th><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Persona</th>
                  <th className="text-right">Neto</th><th className="text-right">IVA</th>
                  <th className="text-right">Total ARS</th><th className="text-right">Total USD</th>
                  <th>Recibo</th><th>Estado</th><th></th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={12} className="empty-row">Sin resultados</td></tr>
                ) : data.map(f => (
                  <tr key={f.id} className="tr-clickable" onClick={() => openDetail(f)}>
                    <td className="text-link">{f.id}</td>
                    <td>{fdate(f.fecha)}</td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.cliente}</td>
                    <td><TipoBadge tipo={f.tipo} /></td>
                    <td className="text-dim" style={{ fontSize: 11.5 }}>{f.persona}</td>
                    <td className="text-right text-mono">{ars(f.neto_ars)}</td>
                    <td className="text-right text-mono">{ars(f.iva)}</td>
                    <td className="text-right text-mono" style={{ fontWeight: 500 }}>{ars(f.monto_ars)}</td>
                    <td className="text-right text-mono">{usd(f.monto_usd)}</td>
                    <td className="text-dim">{f.recibo_id || '—'}</td>
                    <td><EstadoBadge estado={f.estado} /></td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn btn-sm" onClick={() => openDetail(f)}>Ver</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      {modal === 'detail' && selected && (
        <Modal
          title={selected.id}
          subtitle={<>{fdate(selected.fecha)} · <TipoBadge tipo={selected.tipo} /> · <EstadoBadge estado={selected.estado} /></>}
          onClose={closeModal}
          footer={<>
            {selected.estado !== 'anulada' && (
              <button className="btn btn-danger" onClick={() => handleAnular(selected.id)}>Anular</button>
            )}
            {selected.estado === 'pendiente' && (
              <button className="btn" onClick={() => setModal('cobrar')}>Registrar cobro</button>
            )}
            <button className="btn" onClick={() => setModal('edit')}>Editar</button>
            <button className="btn btn-primary" onClick={closeModal}>Cerrar</button>
          </>}
        >
          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-label">Cliente</div>
              <div className="detail-value" style={{ fontWeight: 500 }}>{selected.cliente}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Persona / Unidad</div>
              <div className="detail-value"><span className="badge badge-blue">{selected.persona}</span></div>
            </div>
            <div className="detail-item detail-full">
              <div className="detail-label">Concepto</div>
              <div className="concept-box">{selected.concepto || 'Sin concepto'}</div>
            </div>
          </div>
          <div className="amounts-box">
            {selected.neto_ars && <div className="amount-row"><span style={{ color: 'var(--text-secondary)' }}>Neto</span><span className="text-mono">{ars(selected.neto_ars)}</span></div>}
            {selected.iva      && <div className="amount-row"><span style={{ color: 'var(--text-secondary)' }}>IVA 21%</span><span className="text-mono">{ars(selected.iva)}</span></div>}
            {selected.tipo_cambio && <div className="amount-row"><span style={{ color: 'var(--text-secondary)' }}>Tipo de cambio</span><span>$ {selected.tipo_cambio}</span></div>}
            <div className="amount-row">
              <span>TOTAL</span>
              <span className="text-mono" style={{ fontSize: 16 }}>
                {selected.monto_ars ? ars(selected.monto_ars) : usd(selected.monto_usd)}
              </span>
            </div>
          </div>
          {selected.recibo_id ? (
            <div style={{ padding: '12px 20px', borderTop: '0.5px solid var(--border)', display: 'flex', gap: 24 }}>
              <div><div className="detail-label">N° Recibo</div><div style={{ marginTop: 3, fontWeight: 500 }}>{selected.recibo_id}</div></div>
              <div><div className="detail-label">Fecha cobro</div><div style={{ marginTop: 3 }}>{fdate(selected.fecha_cobro)}</div></div>
            </div>
          ) : (
            <div style={{ padding: '12px 20px', borderTop: '0.5px solid var(--border)' }}>
              <span className="badge badge-amber">⚠ Sin recibo — pendiente de cobro</span>
            </div>
          )}
        </Modal>
      )}

      {/* EDIT MODAL */}
      {modal === 'edit' && selected && (
        <EditarComprobanteModal
          comp={selected}
          onClose={closeModal}
          onSaved={saved => { setSelected(saved); setModal('detail'); load() }}
        />
      )}

      {/* COBRAR MODAL */}
      {modal === 'cobrar' && selected && (
        <MarcarCobradaModal
          comp={selected}
          nextReciboId={nextReciboId()}
          onClose={closeModal}
          onSaved={() => { closeModal(); load() }}
        />
      )}

      {/* NEW MODAL */}
      {modal === 'new' && (
        <NuevoComprobanteModal
          clientes={clientes}
          onClose={closeModal}
          onSaved={() => { closeModal(); load() }}
        />
      )}
    </>
  )
}
