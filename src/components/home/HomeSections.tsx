'use client'
import { FileText, ReceiptText, ChevronRight } from 'lucide-react'
import { Money } from '@/components/HideNumbers'
import { StatusBadge, Skeleton } from '@/design/primitives'
import { ars, usd, fdate } from '@/lib/utils'
import { tiempoRelativo, type ResumenHome, type Evento, type ComprobanteHome } from '@/lib/home'

/**
 * Secciones de lectura del Inicio: resumen, actividad y últimas facturas.
 * Todas las cifras pasan por <Money>, la foundation de privacidad de Fase 1.
 */

export function Section({
  title, action, children,
}: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="ta-sec">
      <div className="ta-sec__head">
        <h2 className="ta-sec__title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function SectionLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="ta-sec__link" onClick={onClick}>
      {label} <ChevronRight size={14} aria-hidden />
    </button>
  )
}

/**
 * Resumen — tres métricas.
 *
 * "Pendiente" no está a propósito: ya vive en la cola de atención con cantidad,
 * monto y antigüedad. El % de cobranza es el subtexto de Cobrado, no una card.
 */
export function FinancialSummary({ r }: { r: ResumenHome }) {
  return (
    <div className="ta-sum">
      <div className="ta-sum__item">
        <div className="ta-sum__label">Facturado</div>
        <Money className="ta-sum__valor" as="div">{ars(r.facturado)}</Money>
        <div className="ta-sum__nota">
          {r.cantidadFacturas} {r.cantidadFacturas === 1 ? 'factura' : 'facturas'}
        </div>
      </div>
      <div className="ta-sum__item">
        <div className="ta-sum__label">Cobrado</div>
        <Money className="ta-sum__valor" as="div">{ars(r.cobrado)}</Money>
        <div className="ta-sum__nota">{r.pctCobrado}% del facturado</div>
      </div>
      <div className="ta-sum__item">
        <div className="ta-sum__label">En dólares</div>
        <Money className="ta-sum__valor" as="div">{usd(r.usd)}</Money>
        <div className="ta-sum__nota">
          {r.cantidadUSD} {r.cantidadUSD === 1 ? 'factura' : 'facturas'}
        </div>
      </div>
    </div>
  )
}

export function RecentActivity({
  eventos, onAbrir,
}: { eventos: Evento[]; onAbrir: (e: Evento) => void }) {
  if (!eventos.length) {
    return <div className="ta-hint" style={{ padding: 'var(--space-3) var(--space-2)' }}>Sin movimientos recientes.</div>
  }
  return (
    <div className="ta-list">
      {eventos.map(e => (
        <button key={e.clave} className="ta-list__row" onClick={() => onAbrir(e)}>
          <span className="ta-list__ico" aria-hidden>
            {e.tipo === 'recibo' ? <ReceiptText size={14} /> : <FileText size={14} />}
          </span>
          <span className="ta-list__main">
            <span className="ta-list__t1">{e.titulo}</span>
            <span className="ta-list__t2">{e.cliente}</span>
          </span>
          <span className="ta-list__right">
            {e.monto !== null && <Money className="ta-list__monto">{ars(e.monto)}</Money>}
            <span className="ta-list__cuando">{tiempoRelativo(e.cuando)}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

/**
 * Últimas facturas — acceso rápido, no una réplica de la tabla de Facturación.
 * Sólo comprobante, cliente, fecha, importe y estado.
 */
export function RecentInvoices({
  facturas, onAbrir,
}: { facturas: ComprobanteHome[]; onAbrir: (c: ComprobanteHome) => void }) {
  if (!facturas.length) {
    return <div className="ta-hint" style={{ padding: 'var(--space-3) var(--space-2)' }}>Todavía no hay facturas.</div>
  }
  return (
    <div className="ta-list">
      {facturas.map(c => (
        <button key={c.id} className="ta-list__row" onClick={() => onAbrir(c)}>
          <span className="ta-list__main">
            <span className="ta-list__t1">{c.id}</span>
            <span className="ta-list__t2">{c.cliente ?? '—'} · {fdate(c.fecha)}</span>
          </span>
          <span className="ta-list__right">
            <Money className="ta-list__monto">{ars(c.monto_ars)}</Money>
            <StatusBadge estado={c.estado} sm withHint />
          </span>
        </button>
      ))}
    </div>
  )
}

export function HomeSkeleton() {
  return (
    <div className="ta-home" role="status" aria-label="Cargando">
      <Skeleton width={280} height={26} radius={8} />
      <div className="ta-atn">
        {[0, 1].map(i => (
          <div key={i} className="ta-atn__item" style={{ cursor: 'default' }}>
            <div className="ta-atn__top">
              <Skeleton width={36} height={36} radius={10} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <Skeleton width={170} height={14} />
                <Skeleton width={110} height={11} />
              </div>
              <Skeleton width={130} height={18} />
            </div>
          </div>
        ))}
      </div>
      <div className="ta-qa">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} height={62} radius={18} />)}
      </div>
      <div className="ta-sum">
        {[0, 1, 2].map(i => (
          <div key={i} className="ta-sum__item" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton width={80} height={12} />
            <Skeleton width={165} height={24} />
          </div>
        ))}
      </div>
    </div>
  )
}
