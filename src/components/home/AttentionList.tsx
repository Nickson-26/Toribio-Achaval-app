'use client'
import {
  FileClock, FileCheck2, CalendarClock, UserPlus, ChevronRight,
  CircleCheck, TriangleAlert, type LucideIcon,
} from 'lucide-react'
import { Money } from '@/components/HideNumbers'
import { EmptyState } from '@/design/primitives'
import { ars } from '@/lib/utils'
import type { AttentionItem } from '@/lib/home'

/**
 * Para revisar — la sección más importante del Inicio.
 *
 * Lista accionable, no una grilla de métricas. Cada fila es un botón entero:
 * icono, qué pasa, cuánto, y a dónde va.
 *
 * Los items los calcula `lib/home.ts` desde datos reales; acá sólo se
 * renderizan. Un item con 0 casos nunca llega hasta acá.
 */

const ICONS: Record<string, LucideIcon> = { FileClock, FileCheck2, CalendarClock, UserPlus }

export function AttentionList({
  items, onAbrir,
}: {
  items: AttentionItem[]
  onAbrir: (item: AttentionItem) => void
}) {
  if (!items.length) {
    return (
      <EmptyState
        icon={CircleCheck}
        title="Todo al día"
        description="No hay pendientes que requieran tu atención."
      />
    )
  }

  return (
    <div className="ta-atn">
      {items.map(item => {
        const Icon = ICONS[item.icono] ?? FileClock
        return (
          <button
            key={item.id}
            className="ta-atn__item"
            onClick={() => onAbrir(item)}
            aria-label={`${item.titulo}. ${item.detalle}. ${item.cta}`}
          >
            <span className={`ta-atn__icon ta-atn__icon--${item.tono}`} aria-hidden>
              <Icon size={18} />
            </span>

            <span className="ta-atn__body">
              <span className="ta-atn__titulo">{item.titulo}</span>
              <span className="ta-atn__detalle">{item.detalle}</span>

              {/* Antigüedad: señal operativa dentro del mismo item, para no
                  contar dos veces las mismas facturas. */}
              {item.destacado && (
                <span className="ta-atn__flag">
                  <TriangleAlert aria-hidden />
                  {item.destacado.texto}
                  {item.destacado.monto !== null && (
                    <> · <Money>{ars(item.destacado.monto)}</Money></>
                  )}
                </span>
              )}
            </span>

            <span className="ta-atn__right">
              {item.monto !== null && (
                <Money className="ta-atn__monto">{ars(item.monto)}</Money>
              )}
              <span className="ta-atn__cta">{item.cta}</span>
              <ChevronRight size={16} className="ta-atn__chev" aria-hidden />
            </span>
          </button>
        )
      })}
    </div>
  )
}
