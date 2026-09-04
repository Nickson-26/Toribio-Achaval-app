'use client'
import { Paperclip, FileText } from 'lucide-react'
import { Money } from '@/components/HideNumbers'
import { Button, StatusBadge } from '@/design/primitives'
import { ars, usd, fdate } from '@/lib/utils'
import type { Comprobante } from '@/lib/supabase'
import type { Accion } from '@/design/permissions'
import { accionesPara, situacionDe, type AccionId } from '@/lib/facturacion'
import { PanelDetalle, PanelCabecera, Dato, Mas } from '@/components/modulo'

/**
 * Detalle de una factura.
 *
 * Antes era un modal centrado: tapaba la tabla y obligaba a cerrarlo para ver
 * la factura siguiente. Revisar diez comprobantes eran veinte clics de
 * abrir/cerrar.
 *
 * Ahora es un panel al costado. La lista queda visible y navegable, con la
 * fila abierta resaltada, así que el usuario no pierde el lugar. En mobile,
 * donde no hay ancho para dos cosas a la vez, es una hoja a pantalla completa.
 *
 * Abre con lo que hace falta para decidir —cliente, importe, estado, fecha y
 * qué pasó con el cobro— y guarda el desagregado contable detrás de un
 * "Detalle contable" que se despliega. Es progressive disclosure: neto, IVA,
 * tipo de cambio y punto de venta casi nunca deciden el siguiente paso.
 *
 * Editar y cobrar siguen abriendo sus formularios, que no se tocaron.
 */
export function FacturaPanel({
  comp, onClose, onAccion, puedeHacer,
  onAnterior, onSiguiente,
  pdfSubiendo, onSubirPDF, onVerPDF,
}: {
  comp: Comprobante
  onClose: () => void
  onAccion: (id: AccionId) => void
  puedeHacer: (a: Accion) => boolean
  onAnterior?: () => void
  onSiguiente?: () => void
  pdfSubiendo: boolean
  onSubirPDF: (e: React.ChangeEvent<HTMLInputElement>) => void
  onVerPDF: () => void
}) {
  const acciones = accionesPara(comp, puedeHacer)
  const primaria = acciones.find(a => a.primaria)
  const secundarias = acciones.filter(a => !a.primaria)
  const enUSD = !!comp.monto_usd
  const tc = comp.tipo_cambio

  const puedeAdjuntar = puedeHacer('comprobante.adjuntarPDF')

  return (
    <PanelDetalle
      tipo={comp.tipo}
      titulo={`N° ${comp.numero}`}
      etiqueta={`Factura ${comp.numero} — ${comp.cliente}`}
      onCerrar={onClose}
      onAnterior={onAnterior}
      onSiguiente={onSiguiente}
      primaria={primaria ? { label: primaria.label, onClick: () => onAccion(primaria.id) } : null}
      secundarias={secundarias.map(a => ({
        id: a.id, label: a.label, peligrosa: a.peligrosa, onClick: () => onAccion(a.id),
      }))}
    >
      {/* Primera lectura: quién, cuánto, en qué estado. Nada más.
          La situación en palabras sale del dato y coincide con el botón del
          pie, porque las dos miran `recibo_id`. */}
      <PanelCabecera
        titulo={comp.cliente}
        monto={<Money>{enUSD ? usd(comp.monto_usd) : ars(comp.monto_ars)}</Money>}
        montoAlt={enUSD && comp.monto_ars ? <Money>{ars(comp.monto_ars)}</Money> : undefined}
        estado={<StatusBadge estado={comp.estado} sm />}
        fecha={fdate(comp.fecha)}
        situacion={situacionDe(comp)}
      />

      {/* Lo que pasó con el cobro va antes que el desagregado fiscal:
          responde "¿qué falta?", que es la pregunta operativa. */}
      {(comp.recibo_id || comp.fecha_cobro || comp.fecha_pago || comp.referencia_pago) && (
        <div className="ta-datos ta-datos--cobro">
          {comp.recibo_id ? <Dato label="Recibo"><span>N° {comp.recibo_id}</span></Dato> : null}
          {comp.fecha_cobro ? <Dato label="Fecha de cobro"><span>{fdate(comp.fecha_cobro)}</span></Dato> : null}
          {!comp.fecha_cobro && comp.fecha_pago
            ? <Dato label="Pago recibido"><span>{fdate(comp.fecha_pago)}</span></Dato> : null}
          {comp.medio_pago ? <Dato label="Medio de pago"><span>{comp.medio_pago}</span></Dato> : null}
          {comp.estado === 'echeq_pendiente' && comp.referencia_pago ? (
            <Dato label="Acredita">
              <span>{String(comp.referencia_pago).split('-').reverse().join('/')}</span>
            </Dato>
          ) : null}
        </div>
      )}

      {/* Progressive disclosure: neto, IVA, tipo de cambio y punto de venta
          casi nunca deciden el siguiente paso. */}
      <Mas titulo="Detalle contable">
        <div className="ta-datos">
          {enUSD ? (
            <>
              {comp.neto_ars && tc ? <Dato label="Neto"><Money>{usd(comp.neto_ars / tc)}</Money></Dato> : null}
              {comp.iva && tc ? <Dato label="IVA 21%"><Money>{usd(comp.iva / tc)}</Money></Dato> : null}
              {comp.monto_ars ? <Dato label="Total ARS"><Money>{ars(comp.monto_ars)}</Money></Dato> : null}
              {tc ? <Dato label="Tipo de cambio"><span className="ta-mono">${tc}</span></Dato> : null}
            </>
          ) : (
            <>
              {comp.neto_ars ? <Dato label="Neto"><Money>{ars(comp.neto_ars)}</Money></Dato> : null}
              {comp.iva ? <Dato label="IVA 21%"><Money>{ars(comp.iva)}</Money></Dato> : null}
            </>
          )}
        </div>

        <dl className="ta-dl">
          <div><dt>Unidad</dt><dd>{comp.persona}</dd></div>
          <div><dt>Punto de venta</dt><dd>{comp.punto_venta || '0002'}</dd></div>
          {comp.concepto && (
            <div className="ta-dl__full"><dt>Concepto</dt><dd>{comp.concepto}</dd></div>
          )}
        </dl>

        <div className="ta-arch">
          <span className="ta-arch__label">Comprobante AFIP</span>
          {comp.pdf_url ? (
            <div className="ta-arch__acciones">
              <Button variant="secondary" size="sm" icon={FileText} onClick={onVerPDF}>Ver PDF</Button>
              {puedeAdjuntar && (
                <AdjuntarPDF subiendo={pdfSubiendo} onChange={onSubirPDF} label="Reemplazar" />
              )}
            </div>
          ) : puedeAdjuntar ? (
            <AdjuntarPDF subiendo={pdfSubiendo} onChange={onSubirPDF} label="Adjuntar PDF" />
          ) : (
            <span className="ta-arch__hint">Sin PDF adjunto</span>
          )}
        </div>
      </Mas>
    </PanelDetalle>
  )
}

function AdjuntarPDF({
  subiendo, onChange, label,
}: { subiendo: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; label: string }) {
  return (
    <label className={`ta-btn ta-btn--secondary ta-btn--sm ta-arch__file${subiendo ? ' is-busy' : ''}`}>
      <Paperclip size={14} aria-hidden />
      {subiendo ? 'Subiendo…' : label}
      <input type="file" accept=".pdf" disabled={subiendo} onChange={onChange} />
    </label>
  )
}
