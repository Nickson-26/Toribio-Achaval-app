'use client'
import { useEffect, useState, useCallback } from 'react'
import { db, Comprobante, supabase } from '@/lib/supabase'
import { ars, usd, fdate, PERSONAS, downloadCSV } from '@/lib/utils'
import { TipoBadge, EstadoBadge, Spinner, Modal, FG, toast } from '@/components/ui'
import { NuevoComprobanteModal, EditarComprobanteModal, MarcarCobradaModal } from '@/components/ComprobanteForms'

type ModalType = 'detail' | 'new' | 'edit' | 'cobrar' | 'eliminar' | 'exportar' | null
type Tab = 'FACT A' | 'FACT B' | 'FACT DE CREDITO' | 'FACT E'

const TABS: { id: Tab; label: string }[] = [
  { id: 'FACT A',          label: 'Facturas A' },
  { id: 'FACT B',          label: 'Facturas B' },
  { id: 'FACT DE CREDITO', label: 'FCE' },
  { id: 'FACT E',          label: 'Fact. E' },
]

const MESES = [
  { num: '01', label: 'Enero' },   { num: '02', label: 'Febrero' },
  { num: '03', label: 'Marzo' },   { num: '04', label: 'Abril' },
  { num: '05', label: 'Mayo' },    { num: '06', label: 'Junio' },
  { num: '07', label: 'Julio' },   { num: '08', label: 'Agosto' },
  { num: '09', label: 'Septiembre' }, { num: '10', label: 'Octubre' },
  { num: '11', label: 'Noviembre' },  { num: '12', label: 'Diciembre' },
]

function exportToExcel(pendientes: Comprobante[], label: string) {
  if (!pendientes.length) { toast('No hay facturas pendientes en ese período'); return }

  const esc = (v: any) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\n/g,' ')

  const headers = ['N° Factura','Tipo','Fecha','Cliente','Unidad','Neto ARS','IVA','Total ARS','Total USD','Tipo de Cambio','Concepto']
  const rows = pendientes.map(f => [
    f.id, f.tipo, f.fecha || '', f.cliente, f.persona,
    f.neto_ars ?? '', f.iva ?? '',
    f.monto_ars ?? '', f.monto_usd ?? '',
    f.tipo_cambio ?? '',
    (f.concepto || '').replace(/\n/g, ' '),
  ])

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="h">
   <Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/>
   <Interior ss:Color="#C8102E" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="n"><NumberFormat ss:Format="#,##0.00"/></Style>
 </Styles>
 <Worksheet ss:Name="Pendientes">
  <Table>
   <Column ss:Width="140"/><Column ss:Width="130"/><Column ss:Width="90"/>
   <Column ss:Width="220"/><Column ss:Width="140"/>
   <Column ss:Width="110"/><Column ss:Width="100"/><Column ss:Width="110"/>
   <Column ss:Width="100"/><Column ss:Width="110"/><Column ss:Width="350"/>
   <Row ss:Height="20">
    ${headers.map(h => `<Cell ss:StyleID="h"><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('')}
   </Row>
   ${rows.map(row => `<Row>${row.map((v, i) => {
     const isNum = i >= 5 && i <= 9 && v !== ''
     return isNum
       ? `<Cell ss:StyleID="n"><Data ss:Type="Number">${v}</Data></Cell>`
       : `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`
   }).join('')}</Row>`).join('\n   ')}
  </Table>
 </Worksheet>
</Workbook>`

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `pendientes-${label}.xls`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  toast(`✓ ${pendientes.length} facturas exportadas`)
}

// ── Modal de exportación con selector de período ──────────────
function ExportarModal({ pendientes, onClose }: { pendientes: Comprobante[]; onClose: () => void }) {
  const currentMonth = new Date().toISOString().slice(5, 7)
  const [desde, setDesde] = useState(currentMonth)
  const [hasta, setHasta] = useState('12')
  const [anio,  setAnio]  = useState('2026')

  const filtrados = pendientes.filter(f => {
    if (!f.fecha) return false
    const [y, m] = f.fecha.split('-')
    if (y !== anio) return false
    return m >= desde && m <= hasta
  })

  const totalARS = filtrados.reduce((s, f) => s + (f.monto_ars || 0), 0)
  const totalUSD = filtrados.filter(f => f.monto_usd).reduce((s, f) => s + (f.monto_usd || 0), 0)

  const mesDesdeLabel = MESES.find(m => m.num === desde)?.label || desde
  const mesHastaLabel = MESES.find(m => m.num === hasta)?.label || hasta

  function handleExport() {
    const label = `${mesDesdeLabel}-${mesHastaLabel}-${anio}`
    exportToExcel(filtrados, label)
    onClose()
  }

  return (
    <Modal
      title="Exportar facturas pendientes a Excel"
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleExport} disabled={filtrados.length === 0}>
          ↓ Exportar {filtrados.length} facturas
        </button>
      </>}
    >
      <div className="form-grid">
        <FG label="Año">
          <select value={anio} onChange={e => setAnio(e.target.value)}>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2027">2027</option>
          </select>
        </FG>
        <div />
        <FG label="Desde (mes)">
          <select value={desde} onChange={e => setDesde(e.target.value)}>
            {MESES.map(m => <option key={m.num} value={m.num}>{m.label}</option>)}
          </select>
        </FG>
        <FG label="Hasta (mes)">
          <select value={hasta} onChange={e => setHasta(e.target.value)}>
            {MESES.map(m => <option key={m.num} value={m.num}>{m.label}</option>)}
          </select>
        </FG>
      </div>

      {/* Preview */}
      <div style={{ margin: '0 22px 20px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: '14px 16px', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Vista previa — {mesDesdeLabel} a {mesHastaLabel} {anio}
        </div>
        {filtrados.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '12px 0' }}>
            Sin facturas pendientes en ese período
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--warn)' }}>{filtrados.length}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>facturas</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{ars(totalARS)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>total ARS</div>
              </div>
              {totalUSD > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--info)' }}>{usd(totalUSD)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>total USD</div>
                </div>
              )}
            </div>
            {/* Mini table preview */}
            <div style={{ maxHeight: 160, overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '4px 6px', textAlign: 'left', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)', fontSize: 10 }}>N°</th>
                    <th style={{ padding: '4px 6px', textAlign: 'left', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)', fontSize: 10 }}>Fecha</th>
                    <th style={{ padding: '4px 6px', textAlign: 'left', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)', fontSize: 10 }}>Cliente</th>
                    <th style={{ padding: '4px 6px', textAlign: 'right', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)', fontSize: 10 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.slice(0, 8).map(f => (
                    <tr key={f.id}>
                      <td style={{ padding: '3px 6px', color: 'var(--warn)', fontWeight: 600 }}>{f.id}</td>
                      <td style={{ padding: '3px 6px', color: 'var(--text-secondary)' }}>{fdate(f.fecha)}</td>
                      <td style={{ padding: '3px 6px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.cliente}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {f.monto_ars ? ars(f.monto_ars) : usd(f.monto_usd)}
                      </td>
                    </tr>
                  ))}
                  {filtrados.length > 8 && (
                    <tr><td colSpan={4} style={{ padding: '4px 6px', color: 'var(--text-tertiary)', textAlign: 'center', fontSize: 11 }}>... y {filtrados.length - 8} más</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

export default function Facturas({ onPendientesChange }: { onPendientesChange?: (n: number) => void }) {
  const [data,     setData]     = useState<Comprobante[]>([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState<ModalType>(null)
  const [selected, setSelected] = useState<Comprobante | null>(null)
  const [search,   setSearch]   = useState('')
  const [fPers,    setFPers]    = useState('all')
  const [fEst,     setFEst]     = useState('all')
  const [clientes, setClientes] = useState<string[]>([])
  const [tab,      setTab]      = useState<Tab>('FACT A')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await db.getComprobantes({ persona: fPers, estado: fEst, search: search || undefined })
      const facts = rows.filter(r => r.tipo.startsWith('FACT'))
      setData(facts)
      setClientes(Array.from(new Set(facts.map(f => f.cliente).filter(Boolean))))
      onPendientesChange?.(facts.filter(f => f.estado === 'pendiente').length)
    } finally { setLoading(false) }
  }, [fPers, fEst, search])

  useEffect(() => { load() }, [load])

  function openDetail(c: Comprobante) { setSelected(c); setModal('detail') }
  function closeModal() { setModal(null); setSelected(null) }

  async function handleAnular(id: string) {
    if (!confirm(`¿Confirmar anulación de ${id}?`)) return
    await db.deleteComprobante(id)
    toast(`Comprobante ${id} anulado`)
    closeModal(); load()
  }

  async function handleEliminar(id: string) {
    if (!confirm(`¿Eliminar PERMANENTEMENTE ${id}? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase.from('comprobantes').delete().eq('id', id)
    if (error) { toast('Error al eliminar: ' + error.message); return }
    toast(`${id} eliminada`)
    closeModal(); load()
  }

  const tabData    = data.filter(f => f.tipo === tab).sort((a, b) => (b.numero || 0) - (a.numero || 0))
  const allPending = data.filter(f => f.estado === 'pendiente').sort((a, b) => (b.numero || 0) - (a.numero || 0))
  const tabPending = tabData.filter(f => f.estado === 'pendiente')
  const totalARS   = tabData.reduce((s, f) => s + (f.monto_ars || 0), 0)
  const totalUSD   = tabData.filter(f => f.monto_usd).reduce((s, f) => s + (f.monto_usd || 0), 0)
  const pendCount  = tabData.filter(f => f.estado === 'pendiente').length

  return (
    <>
      <div className="toolbar">
        <input placeholder="Buscar cliente, N°…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
        <select value={fPers} onChange={e => setFPers(e.target.value)} style={{ width: 160 }}>
          <option value="all">Todas las unidades</option>
          {PERSONAS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={fEst} onChange={e => setFEst(e.target.value)} style={{ width: 140 }}>
          <option value="all">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="cobrada">Cobrada</option>
          <option value="anulada">Anulada</option>
        </select>
        <button className="btn" onClick={() => downloadCSV([
          ['ID','Tipo','Fecha','Cliente','Persona','Monto ARS','Monto USD','Neto','IVA','Estado'],
          ...tabData.map(f => [f.id,f.tipo,f.fecha,f.cliente,f.persona,f.monto_ars,f.monto_usd,f.neto_ars,f.iva,f.estado])
        ], `${tab.replace(/ /g,'-')}.csv`)}>↓ CSV</button>
        <button className="btn" style={{ borderColor:'var(--warn)', color:'var(--warn)', fontWeight:600 }}
          onClick={() => setModal('exportar')}>
          ↓ Excel pendientes ({allPending.length})
        </button>
        <button className="btn btn-primary" onClick={() => setModal('new')}>+ Nueva factura</button>
      </div>

      <div className="fact-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`fact-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === tab && tabData.length > 0 && <span style={{ marginLeft:6, fontSize:11, color:'var(--text-tertiary)' }}>({tabData.length})</span>}
          </button>
        ))}
      </div>

      <div className="metrics-grid" style={{ gridTemplateColumns:'repeat(3, minmax(0,1fr))', marginBottom:16 }}>
        <div className="metric-card accent">
          <div className="metric-label">Total {TABS.find(t=>t.id===tab)?.label}</div>
          <div className="metric-value">{ars(totalARS)}</div>
          <div className="metric-sub">{tabData.length} comprobantes</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total USD</div>
          <div className="metric-value">{usd(totalUSD)}</div>
          <div className="metric-sub">{tabData.filter(f=>f.monto_usd).length} en dólares</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Pendientes de cobro</div>
          <div className="metric-value" style={{ color: pendCount > 0 ? 'var(--warn)' : 'var(--success)' }}>{pendCount}</div>
          <div className="metric-sub">de {tabData.length} facturas</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">{TABS.find(t=>t.id===tab)?.label} — ordenadas por número</span>
          {tabPending.length > 0 && (
            <button className="btn btn-sm" style={{ borderColor:'var(--warn)', color:'var(--warn)', fontSize:11 }}
              onClick={() => setModal('exportar')}>
              ↓ Exportar {tabPending.length} pendientes
            </button>
          )}
        </div>
        {loading ? <Spinner /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>N°</th><th>Fecha</th><th>Cliente</th><th>Persona</th>
                  {tab !== 'FACT B' && <th className="text-right">Neto</th>}
                  {tab !== 'FACT B' && <th className="text-right">IVA</th>}
                  <th className="text-right">Total ARS</th><th className="text-right">USD</th>
                  <th>Estado</th><th></th>
                </tr>
              </thead>
              <tbody>
                {tabData.length === 0 ? (
                  <tr><td colSpan={10} className="empty-row">Sin comprobantes</td></tr>
                ) : tabData.map(f => (
                  <tr key={f.id} className="tr-clickable" onClick={() => openDetail(f)}>
                    <td className="text-link" style={{ fontWeight:600 }}>{f.numero}</td>
                    <td>{fdate(f.fecha)}</td>
                    <td style={{ maxWidth:180, overflow:'hidden', textOverflow:'ellipsis' }}>{f.cliente}</td>
                    <td className="text-dim" style={{ fontSize:11.5 }}>{f.persona}</td>
                    {tab !== 'FACT B' && <td className="text-right text-mono">{ars(f.neto_ars)}</td>}
                    {tab !== 'FACT B' && <td className="text-right text-mono">{ars(f.iva)}</td>}
                    <td className="text-right text-mono" style={{ fontWeight:500 }}>{ars(f.monto_ars)}</td>
                    <td className="text-right text-mono">{usd(f.monto_usd)}</td>
                    <td onClick={e => e.stopPropagation()}><EstadoBadge estado={f.estado} /></td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display:'flex', gap:4 }}>
                        <button className="btn btn-sm" onClick={() => { setSelected(f); setModal('edit') }}>Editar</button>
                        {f.estado === 'pendiente' && (
                          <button className="btn btn-sm btn-primary" onClick={() => { setSelected(f); setModal('cobrar') }}>Cobrar</button>
                        )}
                        <button className="btn btn-sm btn-danger" onClick={() => { setSelected(f); setModal('eliminar') }}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal === 'exportar' && (
        <ExportarModal pendientes={allPending} onClose={closeModal} />
      )}

      {modal === 'detail' && selected && (
        <Modal title={`${selected.tipo} — N° ${selected.numero}`} onClose={closeModal}
          footer={<>
            <button className="btn btn-danger btn-sm" onClick={() => handleAnular(selected.id)}>Anular</button>
            <button className="btn" onClick={() => setModal('edit')}>Editar</button>
            {selected.estado === 'pendiente' && <button className="btn btn-primary" onClick={() => setModal('cobrar')}>Marcar cobrada</button>}
            <button className="btn" onClick={closeModal}>Cerrar</button>
          </>}>
          <div className="detail-grid">
            <div className="detail-item"><div className="detail-label">N° Factura</div><div className="detail-value" style={{ fontWeight:600 }}>{selected.numero}</div></div>
            <div className="detail-item"><div className="detail-label">Fecha</div><div className="detail-value">{fdate(selected.fecha)}</div></div>
            <div className="detail-item detail-full"><div className="detail-label">Cliente</div><div className="detail-value">{selected.cliente}</div></div>
            <div className="detail-item"><div className="detail-label">Persona / Unidad</div><div className="detail-value">{selected.persona}</div></div>
            <div className="detail-item"><div className="detail-label">Estado</div><div className="detail-value"><EstadoBadge estado={selected.estado} /></div></div>
            {selected.concepto && <div className="detail-item detail-full"><div className="detail-label">Concepto</div><div className="concept-box">{selected.concepto}</div></div>}
          </div>
          <div className="amounts-box">
            {selected.neto_ars && <div className="amount-row"><span>Neto</span><span className="text-mono">{ars(selected.neto_ars)}</span></div>}
            {selected.iva && <div className="amount-row"><span>IVA 21%</span><span className="text-mono">{ars(selected.iva)}</span></div>}
            {selected.monto_ars && <div className="amount-row"><span style={{ fontWeight:600 }}>Total ARS</span><span className="text-mono" style={{ fontWeight:600 }}>{ars(selected.monto_ars)}</span></div>}
            {selected.monto_usd && <div className="amount-row"><span>Total USD</span><span className="text-mono">{usd(selected.monto_usd)}</span></div>}
            {selected.tipo_cambio && <div className="amount-row"><span>Tipo de cambio</span><span className="text-mono">${selected.tipo_cambio}</span></div>}
            {selected.recibo_id && <div className="amount-row"><span>N° Recibo</span><span>{selected.recibo_id}</span></div>}
            {selected.fecha_cobro && <div className="amount-row"><span>Fecha de cobro</span><span>{fdate(selected.fecha_cobro)}</span></div>}
          </div>
        </Modal>
      )}
      {modal === 'new' && <NuevoComprobanteModal onClose={closeModal} onSaved={() => { closeModal(); load() }} clientes={clientes} />}
      {modal === 'edit' && selected && <EditarComprobanteModal comp={selected} onClose={closeModal} onSaved={() => { closeModal(); load() }} />}
      {modal === 'eliminar' && selected && (
        <Modal title={`Eliminar — ${selected.id}`} onClose={closeModal}
          footer={<><button className="btn" onClick={closeModal}>Cancelar</button><button className="btn btn-danger" onClick={() => handleEliminar(selected!.id)}>Eliminar definitivamente</button></>}>
          <div style={{ padding:'24px', textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>⚠️</div>
            <p style={{ fontSize:14, fontWeight:500, marginBottom:8 }}>¿Eliminar <strong>{selected.id}</strong>?</p>
            <p style={{ fontSize:13, color:'var(--text-secondary)' }}>{selected.cliente} — {selected.fecha}</p>
            <p style={{ fontSize:12, color:'var(--danger)', marginTop:12 }}>Esta acción es permanente y no se puede deshacer.</p>
          </div>
        </Modal>
      )}
      {modal === 'cobrar' && selected && <MarcarCobradaModal comp={selected} nextReciboId={19200} onClose={closeModal} onSaved={() => { closeModal(); load() }} />}
    </>
  )
}
