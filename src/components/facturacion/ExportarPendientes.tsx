'use client'
import { useState } from 'react'
import { Comprobante } from '@/lib/supabase'
import { ars, usd, fdate } from '@/lib/utils'
import { Modal, FG, toast } from '@/components/ui'

/** Viajaba con el componente en Facturas.tsx. Local, porque sólo lo usa esta
 *  exportación: `MESES` de lib/utils es una lista de nombres, no de pares. */
const MESES = [
  { num: '01', label: 'Enero' },     { num: '02', label: 'Febrero' },
  { num: '03', label: 'Marzo' },     { num: '04', label: 'Abril' },
  { num: '05', label: 'Mayo' },      { num: '06', label: 'Junio' },
  { num: '07', label: 'Julio' },     { num: '08', label: 'Agosto' },
  { num: '09', label: 'Septiembre' },{ num: '10', label: 'Octubre' },
  { num: '11', label: 'Noviembre' }, { num: '12', label: 'Diciembre' },
]

/**
 * Exportación de pendientes a Excel.
 *
 * Se mueve tal cual desde Facturas.tsx, sin tocar el armado del XML: es el
 * archivo que se manda a cobranzas y su formato ya está acordado con quien lo
 * recibe. Cambiarlo "de paso" en una fase de UX sería exactamente el tipo de
 * daño colateral que no queremos.
 *
 * Lo único que cambia es el nombre —`ExportarModal` era ambiguo fuera de su
 * archivo— y que ahora vive en su propio módulo, así la pantalla de
 * Facturación no arrastra 220 líneas de generación de planillas.
 */

// ── buildSheet ──────────────────────────────────────────────────────────────
function buildSheet(facts: Comprobante[], sheetName: string, isB: boolean): string {
  const esc = (v: any) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,' ')

  const fmtARS = (v: any) => v ? Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
  const fmtUSD = (v: any) => v ? Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) : ''

  const rows = facts.map(f => {
    if (isB) {
      return [
        f.numero ?? '',
        f.fecha || '',
        f.cliente,
        f.monto_ars ? fmtARS(f.monto_ars) : '',
        f.monto_usd ? fmtUSD(f.monto_usd) : '',
        f.tipo_cambio ?? '',
      ]
    } else {
      return [
        f.numero ?? '',
        f.fecha || '',
        f.cliente,
        f.monto_ars ? fmtARS(f.monto_ars) : '',
        f.neto_ars  ? fmtARS(f.neto_ars)  : '',
        f.monto_usd ? fmtUSD(f.monto_usd) : '',
        f.neto_usd  ? fmtUSD(f.neto_usd)  : '',
        f.tipo_cambio ?? '',
        f.iva       ? fmtARS(f.iva)        : '',
      ]
    }
  })

  const headers = isB
    ? ['N\u00b0', 'Fecha', 'Cliente', 'Total ARS', 'Total USD', 'Tipo de Cambio']
    : ['N\u00b0', 'Fecha', 'Cliente', 'Total ARS', 'Neto ARS', 'Total USD', 'Neto USD', 'Tipo de Cambio', 'IVA']

  const colWidths = isB
    ? [60, 90, 220, 110, 100, 100]
    : [60, 90, 220, 110, 110, 100, 100, 110, 100]

  return `<Worksheet ss:Name="${esc(sheetName)}">
  <Table>
   ${colWidths.map(w => `<Column ss:Width="${w}"/>`).join('')}
   <Row ss:Height="18">
    ${headers.map(h => `<Cell ss:StyleID="h"><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('')}
   </Row>
   ${rows.map(row => `<Row>${row.map((v, i) => {
     if (i === 0 && v !== '') return `<Cell ss:StyleID="id"><Data ss:Type="Number">${v}</Data></Cell>`
     return `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`
   }).join('')}</Row>`).join('\n   ')}
  </Table>
 </Worksheet>`
}

// ── exportToExcel ───────────────────────────────────────────────────────────
function exportToExcel(pendientes: Comprobante[], label: string) {
  if (!pendientes.length) { toast('No hay facturas pendientes en ese período'); return }

  const factA   = pendientes.filter(f => f.tipo === 'FACT A').sort((a,b) => (a.numero||0)-(b.numero||0))
  const factB   = pendientes.filter(f => f.tipo === 'FACT B').sort((a,b) => (a.numero||0)-(b.numero||0))
  const factFCE = pendientes.filter(f => f.tipo === 'FACT DE CREDITO').sort((a,b) => (a.numero||0)-(b.numero||0))
  const factE   = pendientes.filter(f => f.tipo === 'FACT E').sort((a,b) => (a.numero||0)-(b.numero||0))

  const sheets = [
    factA.length   > 0 ? buildSheet(factA,   'Factura A',          false) : null,
    factB.length   > 0 ? buildSheet(factB,   'Factura B',          true)  : null,
    factFCE.length > 0 ? buildSheet(factFCE, 'Factura de Credito', false) : null,
    factE.length   > 0 ? buildSheet(factE,   'Factura E',          false) : null,
  ].filter(Boolean).join('\n ')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="h">
   <Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="10"/>
   <Interior ss:Color="#C8102E" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center"/>
  </Style>
  <Style ss:ID="id">
   <Font ss:Bold="1"/>
   <Alignment ss:Horizontal="Left"/>
  </Style>
 </Styles>
 ${sheets}
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
  toast(`✓ ${pendientes.length} facturas exportadas — ${[factA.length&&'Fact A',factB.length&&'Fact B',factFCE.length&&'FCE',factE.length&&'Fact E'].filter(Boolean).join(', ')}`)
}

// ── ExportarModal ───────────────────────────────────────────────────────────
export function ExportarPendientesModal({ pendientes, onClose }: { pendientes: Comprobante[]; onClose: () => void }) {
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

  const byTipo = {
    'FACT A':          filtrados.filter(f => f.tipo === 'FACT A').length,
    'FACT B':          filtrados.filter(f => f.tipo === 'FACT B').length,
    'FACT DE CREDITO': filtrados.filter(f => f.tipo === 'FACT DE CREDITO').length,
    'FACT E':          filtrados.filter(f => f.tipo === 'FACT E').length,
  }

  const totalARS = filtrados.reduce((s, f) => s + (f.monto_ars || 0), 0)
  const totalUSD = filtrados.filter(f => f.monto_usd).reduce((s, f) => s + (f.monto_usd || 0), 0)
  const mesDesdeLabel = MESES.find(m => m.num === desde)?.label || desde
  const mesHastaLabel = MESES.find(m => m.num === hasta)?.label || hasta

  function handleExport() {
    exportToExcel(filtrados, `${mesDesdeLabel}-${mesHastaLabel}-${anio}`)
    onClose()
  }

  return (
    <Modal title="Exportar facturas pendientes a Excel" onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleExport} disabled={filtrados.length === 0}>
          Exportar {filtrados.length} facturas
        </button>
      </>}>
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

      <div style={{ margin:'0 22px 20px', background:'var(--bg-secondary)', borderRadius:'var(--radius)', padding:'16px', border:'1px solid var(--border)' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-tertiary)', marginBottom:12, textTransform:'uppercase', letterSpacing:'.04em' }}>
          Vista previa — {mesDesdeLabel} a {mesHastaLabel} {anio}
        </div>
        {filtrados.length === 0 ? (
          <div style={{ fontSize:13, color:'var(--text-tertiary)', textAlign:'center', padding:'16px 0' }}>
            Sin facturas pendientes en ese período
          </div>
        ) : (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:14 }}>
              {Object.entries(byTipo).filter(([,v]) => v > 0).map(([tipo, count]) => (
                <div key={tipo} style={{ textAlign:'center', background:'var(--bg-tertiary)', borderRadius:'var(--radius-sm)', padding:'8px 4px' }}>
                  <div style={{ fontSize:18, fontWeight:700, color:'var(--warn)' }}>{count}</div>
                  <div style={{ fontSize:10, color:'var(--text-tertiary)' }}>{tipo.replace('FACT ','').replace('DE CREDITO','FC')}</div>
                  <div style={{ fontSize:9, color:'var(--text-tertiary)', marginTop:2 }}>hoja propia</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:16, marginBottom:12 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>{ars(totalARS)}</div>
                <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>total ARS pendiente</div>
              </div>
              {totalUSD > 0 && (
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--info)' }}>{usd(totalUSD)}</div>
                  <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>total USD pendiente</div>
                </div>
              )}
            </div>
            <div style={{ maxHeight:140, overflowY:'auto' }}>
              <table style={{ width:'100%', fontSize:11, borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    {['N°','Tipo','Fecha','Cliente','Total'].map(h => (
                      <th key={h} style={{ padding:'3px 6px', textAlign:'left', color:'var(--text-tertiary)', borderBottom:'1px solid var(--border)', fontSize:10 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.slice(0,8).map(f => (
                    <tr key={f.id}>
                      <td style={{ padding:'3px 6px', color:'var(--warn)', fontWeight:600 }}>{f.numero}</td>
                      <td style={{ padding:'3px 6px', color:'var(--text-tertiary)', fontSize:10 }}>{f.tipo.replace('FACT ','')}</td>
                      <td style={{ padding:'3px 6px', color:'var(--text-secondary)' }}>{fdate(f.fecha)}</td>
                      <td style={{ padding:'3px 6px', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.cliente}</td>
                      <td style={{ padding:'3px 6px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
                        {f.monto_ars ? ars(f.monto_ars) : usd(f.monto_usd)}
                      </td>
                    </tr>
                  ))}
                  {filtrados.length > 8 && (
                    <tr><td colSpan={5} style={{ padding:'4px 6px', color:'var(--text-tertiary)', textAlign:'center' }}>... y {filtrados.length - 8} más</td></tr>
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
