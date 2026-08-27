'use client'
import {
  FileClock, CalendarClock, Clock, ChevronRight, CircleCheck,
  type LucideIcon,
} from 'lucide-react'
import { Money } from '@/components/HideNumbers'
import { ars } from '@/lib/utils'
import type { Senal, SenalId, ResumenHoy } from '@/lib/facturacion'

/**
 * Las dos capas de contexto que abren Facturación.
 *
 * HOY es una línea, no un dashboard. Contesta "¿pasó algo?" y nada más.
 * Cuando no pasó nada, dice eso y da el contexto de la semana; un cero grande
 * en pantalla no es información.
 *
 * POR RESOLVER es dinámico: sólo aparecen las situaciones que existen. Si no
 * hay e-cheqs pendientes no hay ninguna tarjeta de e-cheqs — una que dice "0"
 * ocupa el mismo lugar que una que dice algo. Y si no hay nada que resolver,
 * la sección entera desaparece y lo dice en una línea.
 */

const ICONOS: Record<SenalId, LucideIcon> = {
  retenciones: FileClock,
  echeq: CalendarClock,
  pendientes: Clock,
}

export function Hoy({ r }: { r: ResumenHoy }) {
  const partes: string[] = []
  if (r.pagos > 0) partes.push(`${r.pagos} ${r.pagos === 1 ? 'pago recibido' : 'pagos recibidos'}`)
  if (r.emitidas > 0) partes.push(`${r.emitidas} ${r.emitidas === 1 ? 'factura emitida' : 'facturas emitidas'}`)

  return (
    <p className="ta-hoy">
      <span className="ta-hoy__label">Hoy</span>
      {r.hayAlgo ? (
        <>
          <span className="ta-hoy__txt">{partes.join(' · ')}</span>
          {r.montoPagos > 0 && (
            <Money className="ta-hoy__monto">{ars(r.montoPagos)}</Money>
          )}
        </>
      ) : (
        <span className="ta-hoy__txt ta-hoy__txt--quieto">
          sin movimientos
          {r.pagosSemana > 0 && ` · ${r.pagosSemana} en los últimos 7 días`}
        </span>
      )}
    </p>
  )
}

export function PorResolver({
  senales, onAbrir,
}: {
  senales: Senal[]
  onAbrir: (s: Senal) => void
}) {
  if (!senales.length) {
    return (
      <p className="ta-resolver__nada">
        <CircleCheck size={15} aria-hidden />
        Nada pendiente de resolver.
      </p>
    )
  }

  return (
    <section className="ta-resolver" aria-label="Situaciones que requieren acción">
      {senales.map(s => {
        const Icon = ICONOS[s.id]
        return (
          <button
            key={s.id}
            type="button"
            className={`ta-senal ta-senal--${s.tono}`}
            onClick={() => onAbrir(s)}
            aria-label={`${s.titulo}: ${s.detalle}${s.nota ? `. ${s.nota}` : ''}`}
          >
            <span className="ta-senal__ico" aria-hidden><Icon size={17} /></span>

            <span className="ta-senal__cuerpo">
              <span className="ta-senal__titulo">{s.titulo}</span>
              <span className="ta-senal__detalle">
                {s.detalle}
                {/* La aclaración es lo que evita leer esto como deuda del
                    cliente cuando en realidad el dinero ya entró. */}
                {s.nota && <span className="ta-senal__nota">{s.nota}</span>}
              </span>
            </span>

            <span className="ta-senal__derecha">
              {s.montoARS > 0 && <Money className="ta-senal__monto">{ars(s.montoARS)}</Money>}
              <ChevronRight size={16} className="ta-senal__chev" aria-hidden />
            </span>
          </button>
        )
      })}
    </section>
  )
}
