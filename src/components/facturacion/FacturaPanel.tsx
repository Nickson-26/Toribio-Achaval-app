'use client'
import { useEffect, useRef, useState } from 'react'
import { X, Paperclip, FileText, ChevronUp, ChevronDown, MoreHorizontal } from 'lucide-react'
import { Money } from '@/components/HideNumbers'
import { Button, StatusBadge, IconButton } from '@/design/primitives'
import { estadoDef } from '@/design/status'
import { ars, usd, fdate } from '@/lib/utils'
import type { Comprobante } from '@/lib/supabase'
import type { Accion } from '@/design/permissions'
import { accionesPara, type AccionId } from '@/lib/facturacion'

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
 * Es de consulta y acción, no una segunda pantalla: muestra lo que hace falta
 * para decidir y ofrece los siguientes pasos. Editar y cobrar siguen abriendo
 * sus formularios, que no se tocaron.
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
  const ref = useRef<HTMLElement>(null)
  const acciones = accionesPara(comp, puedeHacer)
  const primaria = acciones.find(a => a.primaria)
  const secundarias = acciones.filter(a => !a.primaria)
  const enUSD = !!comp.monto_usd
  const tc = comp.tipo_cambio

  // Escape cierra. El panel no es modal en escritorio, así que no atrapa el
  // foco: el usuario tiene que poder volver a la lista con Tab.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Al cambiar de comprobante, el panel vuelve arriba. Si no, quedaba
  // scrolleado en la sección PDF de la factura anterior.
  useEffect(() => { ref.current?.scrollTo({ top: 0 }) }, [comp.id])

  const puedeAdjuntar = puedeHacer('comprobante.adjuntarPDF')

  return (
    <>
      {/* Sólo cubre en mobile; en escritorio el CSS lo apaga para que la
          lista siga siendo legible y clicable. */}
      <div className="ta-fpanel__scrim" onMouseDown={onClose} aria-hidden />

      <aside
        ref={ref}
        className="ta-fpanel"
        role="dialog"
        aria-label={`Factura ${comp.numero} — ${comp.cliente}`}
      >
        <header className="ta-fpanel__head">
          <div className="ta-fpanel__ident">
            <span className="ta-fpanel__tipo">{comp.tipo}</span>
            <span className="ta-fpanel__n">N° {comp.numero}</span>
          </div>
          <div className="ta-fpanel__nav">
            {(onAnterior || onSiguiente) && (
              <span className="ta-fpanel__flechas ta-only-desktop">
                <IconButton icon={ChevronUp} label="Factura anterior" size={15}
                  onClick={onAnterior} disabled={!onAnterior} />
                <IconButton icon={ChevronDown} label="Factura siguiente" size={15}
                  onClick={onSiguiente} disabled={!onSiguiente} />
              </span>
            )}
            <IconButton icon={X} label="Cerrar detalle" onClick={onClose} />
          </div>
        </header>

        <div className="ta-fpanel__body">
          <div className="ta-fpanel__estado">
            <StatusBadge estado={comp.estado} />
            <span className="ta-fpanel__hint">{estadoDef(comp.estado).hint}</span>
          </div>

          <dl className="ta-fdl">
            <div><dt>Cliente</dt><dd>{comp.cliente}</dd></div>
            <div><dt>Fecha</dt><dd>{fdate(comp.fecha)}</dd></div>
            <div><dt>Unidad</dt><dd>{comp.persona}</dd></div>
            <div><dt>Punto de venta</dt><dd>{comp.punto_venta || '0002'}</dd></div>
            {comp.concepto && (
              <div className="ta-fdl__full"><dt>Concepto</dt><dd>{comp.concepto}</dd></div>
            )}
          </dl>

          {/* Importes. En una factura en dólares el desagregado se muestra en
              dólares y el peso queda como conversión, que es como se leen. */}
          <div className="ta-fmontos">
            {enUSD ? (
              <>
                {comp.neto_ars && tc ? (
                  <Fila label="Neto"><Money>{usd(comp.neto_ars / tc)}</Money></Fila>
                ) : null}
                {comp.iva && tc ? (
                  <Fila label="IVA 21%"><Money>{usd(comp.iva / tc)}</Money></Fila>
                ) : null}
                <Fila label="Total USD" fuerte><Money>{usd(comp.monto_usd)}</Money></Fila>
                {comp.monto_ars ? <Fila label="Total ARS"><Money>{ars(comp.monto_ars)}</Money></Fila> : null}
                {tc ? <Fila label="Tipo de cambio"><span className="ta-mono">${tc}</span></Fila> : null}
              </>
            ) : (
              <>
                {comp.neto_ars ? <Fila label="Neto"><Money>{ars(comp.neto_ars)}</Money></Fila> : null}
                {comp.iva ? <Fila label="IVA 21%"><Money>{ars(comp.iva)}</Money></Fila> : null}
                <Fila label="Total" fuerte><Money>{ars(comp.monto_ars)}</Money></Fila>
              </>
            )}
          </div>

          {(comp.recibo_id || comp.fecha_cobro || comp.referencia_pago) && (
            <div className="ta-fmontos ta-fmontos--cobro">
              {comp.recibo_id ? <Fila label="Recibo"><span>N° {comp.recibo_id}</span></Fila> : null}
              {comp.fecha_cobro ? <Fila label="Fecha de cobro"><span>{fdate(comp.fecha_cobro)}</span></Fila> : null}
              {comp.medio_pago ? <Fila label="Medio de pago"><span>{comp.medio_pago}</span></Fila> : null}
              {comp.estado === 'echeq_pendiente' && comp.referencia_pago ? (
                <Fila label="Acredita">
                  <span>{String(comp.referencia_pago).split('-').reverse().join('/')}</span>
                </Fila>
              ) : null}
            </div>
          )}

          <div className="ta-fpdf">
            <span className="ta-fpdf__label">Comprobante AFIP</span>
            {comp.pdf_url ? (
              <div className="ta-fpdf__acciones">
                <Button variant="secondary" size="sm" icon={FileText} onClick={onVerPDF}>Ver PDF</Button>
                {puedeAdjuntar && (
                  <AdjuntarPDF subiendo={pdfSubiendo} onChange={onSubirPDF} label="Reemplazar" />
                )}
              </div>
            ) : puedeAdjuntar ? (
              <div className="ta-fpdf__acciones">
                <AdjuntarPDF subiendo={pdfSubiendo} onChange={onSubirPDF} label="Adjuntar PDF" />
                <span className="ta-fpdf__hint">Todavía sin adjuntar</span>
              </div>
            ) : (
              <span className="ta-fpdf__hint">Sin PDF adjunto</span>
            )}
          </div>
        </div>

        {/* UNA acción primaria; el resto detrás del menú.
            Antes competían seis botones —Editar, Cobrar, Anular, Eliminar,
            Retenciones— y ninguno se leía como el siguiente paso.
            Un viewer no llega acá con nada: accionesPara() le devuelve una
            lista vacía y el pie directamente no se monta. */}
        {acciones.length > 0 && (
          <footer className="ta-fpanel__foot">
            {secundarias.length > 0 && (
              <MenuSecundarias acciones={secundarias} onAccion={onAccion} />
            )}
            {primaria ? (
              <Button variant="primary" size="sm" onClick={() => onAccion(primaria.id)}>
                {primaria.label}
              </Button>
            ) : (
              // Sin siguiente paso: decirlo es mejor que dejar el pie mudo.
              <span className="ta-fpanel__cerrado">Circuito completo</span>
            )}
          </footer>
        )}
      </aside>
    </>
  )
}

/** Las acciones que no son el siguiente paso. Cerrado por defecto. */
function MenuSecundarias({
  acciones, onAccion,
}: { acciones: { id: AccionId; label: string; peligrosa?: boolean }[]; onAccion: (id: AccionId) => void }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAbierto(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', esc)
    }
  }, [abierto])

  return (
    <div className="ta-fmenu" ref={ref}>
      <IconButton
        icon={MoreHorizontal}
        label="Más acciones"
        aria-expanded={abierto}
        onClick={() => setAbierto(v => !v)}
      />
      {abierto && (
        <div className="ta-fmenu__pop" role="menu">
          {acciones.map(a => (
            <button
              key={a.id}
              role="menuitem"
              className={`ta-fmenu__item${a.peligrosa ? ' is-peligro' : ''}`}
              onClick={() => { setAbierto(false); onAccion(a.id) }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Fila({ label, fuerte, children }: { label: string; fuerte?: boolean; children: React.ReactNode }) {
  return (
    <div className={`ta-fmontos__row${fuerte ? ' is-fuerte' : ''}`}>
      <span>{label}</span>
      <span className="ta-fmontos__v">{children}</span>
    </div>
  )
}

function AdjuntarPDF({
  subiendo, onChange, label,
}: { subiendo: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; label: string }) {
  return (
    <label className={`ta-btn ta-btn--secondary ta-btn--sm ta-fpdf__file${subiendo ? ' is-busy' : ''}`}>
      <Paperclip size={14} aria-hidden />
      {subiendo ? 'Subiendo…' : label}
      <input type="file" accept=".pdf" disabled={subiendo} onChange={onChange} />
    </label>
  )
}
