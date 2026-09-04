'use client'
import {
  FileClock, FileCheck2, CalendarClock, UserPlus, ChevronRight,
  TriangleAlert, type LucideIcon,
} from 'lucide-react'
import { Money } from '@/components/HideNumbers'
import { ars } from '@/lib/utils'
import type { AttentionItem } from '@/lib/home'

/**
 * Para revisar — lo primero de la pantalla.
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
  // Nada que revisar: no hay bloque. Antes acá vivía una tarjeta con icono
  // grande que decía "Todo al día" — una superficie del tamaño de un
  // problema, para anunciar que no hay ninguno. El saludo ya lo dice en una
  // línea y la pantalla arranca directamente por lo que sí se puede hacer.
  if (!items.length) return null

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
            {/* Fila superior: icono + título + monto.
                En mobile el monto baja a su propia línea (ver home.css): el
                título y un importe de nueve dígitos no entran juntos en 390px
                sin partir las palabras. */}
            <span className="ta-atn__top">
              <span className={`ta-atn__icon ta-atn__icon--${item.tono}`} aria-hidden>
                <Icon size={18} />
              </span>

              <span className="ta-atn__body">
                <span className="ta-atn__titulo">{item.titulo}</span>
                <span className="ta-atn__detalle">{item.detalle}</span>
              </span>

              <span className="ta-atn__right">
                {item.monto !== null && (
                  <Money className="ta-atn__monto">{ars(item.monto)}</Money>
                )}
                {/* El rótulo de la acción ("Ver pendientes") es redundante en
                    reposo: la fila entera es un botón y tiene su chevron. Se
                    revela al acercarse, para confirmar a dónde lleva antes de
                    hacer clic. En mobile —donde no hay hover— se muestra
                    siempre, en la línea de abajo. */}
                <span className="ta-atn__cta">{item.cta}</span>
                <ChevronRight size={16} className="ta-atn__chev" aria-hidden />
              </span>
            </span>

            {/* Antigüedad: señal operativa dentro del mismo item, para no
                contar dos veces las mismas facturas.
                Es una LÍNEA con icono, no un pill: en 390px un pill con texto
                y monto se partía en cuatro renglones. */}
            {item.destacado && (
              <span className="ta-atn__flag">
                <TriangleAlert aria-hidden />
                <span className="ta-atn__flag-txt">
                  {item.destacado.texto}
                  {item.destacado.monto !== null && (
                    <> · <Money>{ars(item.destacado.monto)}</Money></>
                  )}
                </span>
              </span>
            )}

            {/* CTA explícito, sólo en mobile: ahí el chevron a la derecha
                queda lejos del texto y deja de leerse como acción. */}
            <span className="ta-atn__cta-mobile">{item.cta} →</span>
          </button>
        )
      })}
    </div>
  )
}
