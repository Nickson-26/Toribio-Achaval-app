'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, FileSearch } from 'lucide-react'
import { Money } from '@/components/HideNumbers'
import { StatusBadge, EmptyState, SkeletonRows, Button } from '@/design/primitives'
import { ars, usd, fdate } from '@/lib/utils'
import type { Comprobante } from '@/lib/supabase'
import type { Accion } from '@/design/permissions'
import {
  accionPrimaria, fechaCorta, puntoVentaDe, diasDesde, type AccionId,
} from '@/lib/facturacion'

/**
 * Las dos formas de mirar la misma lista.
 *
 * Escritorio: tabla, con cinco columnas. Comprobante, fecha, cliente, importe
 * y estado — lo que hace falta para EXPLORAR. Neto, IVA, unidad y punto de
 * venta salieron: son datos de verificación y viven en el detalle, que es
 * donde se verifican. Una tabla con toda la base adentro no es una lista, es
 * un volcado.
 *
 * Mobile: tarjetas. NO es la tabla comprimida. Once columnas dentro de un
 * contenedor con scroll horizontal no es una experiencia, es un escondite
 * para el overflow: había que arrastrar de costado para leer un importe.
 * La tarjeta prioriza lo que se necesita para decidir —comprobante, fecha,
 * cliente, importe, estado y el siguiente paso— y manda PV, unidad, neto e
 * IVA al detalle, que es donde se verifican.
 */

/* ══════════════════════════════════════════════════════════════════════════
   Render eficiente
   ══════════════════════════════════════════════════════════════════════════
   No hay paginación server-side en esta fase: se sigue cargando el dataset
   completo para que los totales no cambien de significado. Lo que sí se
   evita es pintar 207 filas de una: se renderiza una ventana y crece al
   llegar al final. Es una ventana incremental, no virtualización con alturas
   calculadas — mucho menos código y suficiente para este volumen.

   Si el volumen crece materialmente, el paso siguiente es paginación +
   agregados server-side, y ahí sí cambia cómo se calculan los totales. */
const PAGINA = 60

function useVentana<T>(items: T[]) {
  const [n, setN] = useState(PAGINA)
  const centinela = useRef<HTMLDivElement>(null)

  // Volver al principio cuando cambia el conjunto: si el usuario filtra, no
  // tiene sentido seguir mostrando 200 filas de la búsqueda anterior.
  useEffect(() => { setN(PAGINA) }, [items])

  useEffect(() => {
    const el = centinela.current
    if (!el || n >= items.length) return
    const io = new IntersectionObserver(
      es => { if (es[0]?.isIntersecting) setN(v => v + PAGINA) },
      { rootMargin: '400px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [n, items.length])

  return {
    visibles: useMemo(() => items.slice(0, n), [items, n]),
    faltan: Math.max(0, items.length - n),
    centinela,
    verMas: () => setN(v => v + PAGINA),
  }
}

function Centinela({
  faltan, refEl, onVerMas,
}: { faltan: number; refEl: React.RefObject<HTMLDivElement>; onVerMas: () => void }) {
  if (faltan <= 0) return null
  return (
    <div ref={refEl} className="ta-fmas">
      {/* El botón existe para quien navega con teclado o tiene el observer
          bloqueado: el scroll infinito solo deja gente afuera. */}
      <Button variant="ghost" size="sm" onClick={onVerMas}>
        Ver {Math.min(faltan, PAGINA)} más · quedan {faltan}
      </Button>
    </div>
  )
}

const Vacio = ({ hayFiltros }: { hayFiltros: boolean }) => (
  <EmptyState
    icon={FileSearch}
    title={hayFiltros ? 'Ninguna factura coincide' : 'Todavía no hay facturas'}
    description={hayFiltros ? 'Probá quitando algún filtro.' : undefined}
  />
)

/* ══════════════════════════════════════════════════════════════════════════
   TABLA — escritorio
   ══════════════════════════════════════════════════════════════════════════ */
export function FacturasTabla({
  facturas, cargando, seleccionadaId, onAbrir, hayFiltros,
}: {
  facturas: Comprobante[]
  cargando: boolean
  seleccionadaId: string | null
  onAbrir: (c: Comprobante) => void
  hayFiltros: boolean
}) {
  const { visibles, faltan, centinela, verMas } = useVentana(facturas)

  if (cargando) return <SkeletonRows rows={8} />
  if (!facturas.length) return <Vacio hayFiltros={hayFiltros} />

  return (
    <div className="ta-ftabla-wrap">
      <table className="ta-ftabla">
        <thead>
          <tr>
            <th className="ta-ftabla__num">N°</th>
            <th className="ta-ftabla__fecha">Fecha</th>
            <th>Cliente</th>
            <th className="ta-num ta-ftabla__importe">Importe</th>
            <th className="ta-ftabla__estado">Estado</th>
            <th className="ta-frow__chev"><span className="ta-sr">Abrir</span></th>
          </tr>
        </thead>
        <tbody>
          {visibles.map(c => (
            <tr
              key={c.id}
              className={`ta-frow${seleccionadaId === c.id ? ' is-sel' : ''}`}
              onClick={() => onAbrir(c)}
              tabIndex={0}
              role="button"
              aria-label={`Abrir factura ${c.numero} de ${c.cliente}`}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(c) }
              }}
            >
              <td className="ta-ftabla__num">
                <span className="ta-frow__n">{c.numero}</span>
                <span className="ta-frow__pv">PV {puntoVentaDe(c)}</span>
              </td>
              <td className="ta-frow__fecha">{fdate(c.fecha)}</td>
              <td className="ta-frow__cliente" title={c.cliente}>{c.cliente}</td>
              <td className="ta-num ta-ftabla__importe ta-frow__total">
                <Money>{ars(c.monto_ars)}</Money>
                {c.monto_usd ? <Money className="ta-frow__usd">{usd(c.monto_usd)}</Money> : null}
              </td>
              <td className="ta-ftabla__estado"><StatusBadge estado={c.estado} sm withHint /></td>
              <td className="ta-frow__chev"><ChevronRight size={15} aria-hidden /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Centinela faltan={faltan} refEl={centinela} onVerMas={verMas} />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   LISTA — mobile
   ══════════════════════════════════════════════════════════════════════════ */
export function FacturasLista({
  facturas, cargando, onAbrir, onAccion, puedeHacer, hayFiltros,
}: {
  facturas: Comprobante[]
  cargando: boolean
  onAbrir: (c: Comprobante) => void
  onAccion: (c: Comprobante, id: AccionId) => void
  puedeHacer: (a: Accion) => boolean
  hayFiltros: boolean
}) {
  const { visibles, faltan, centinela, verMas } = useVentana(facturas)

  if (cargando) return <SkeletonRows rows={6} />
  if (!facturas.length) return <Vacio hayFiltros={hayFiltros} />

  return (
    <div className="ta-flista">
      {visibles.map(c => {
        const primaria = accionPrimaria(c, puedeHacer)
        // La antigüedad sólo importa cuando la plata no entró todavía: en una
        // cobrada, "hace 74 días" no le sirve a nadie.
        const dias = c.estado === 'pendiente' ? diasDesde(c.fecha) : null
        return (
          <article key={c.id} className="ta-fcard">
            <button
              type="button"
              className="ta-fcard__main"
              onClick={() => onAbrir(c)}
              aria-label={`Abrir factura ${c.numero} de ${c.cliente}`}
            >
              <span className="ta-fcard__top">
                <span className="ta-fcard__n">{c.numero}</span>
                <span className="ta-fcard__fecha">{fechaCorta(c.fecha)}</span>
              </span>

              <span className="ta-fcard__cliente">{c.cliente}</span>

              <span className="ta-fcard__montos">
                <Money className="ta-fcard__ars">{ars(c.monto_ars)}</Money>
                {c.monto_usd ? <Money className="ta-fcard__usd">{usd(c.monto_usd)}</Money> : null}
              </span>

              <span className="ta-fcard__estado">
                <StatusBadge estado={c.estado} sm />
                {dias !== null && (
                  <span className="ta-fcard__dias">{dias} {dias === 1 ? 'día' : 'días'}</span>
                )}
              </span>
            </button>

            {/* La acción primaria vive fuera del botón de detalle: en una
                tarjeta táctil, un botón dentro de otro botón es una trampa. */}
            {primaria && (
              <button
                type="button"
                className="ta-fcard__cta"
                onClick={() => onAccion(c, primaria.id)}
              >
                {primaria.label}
              </button>
            )}
          </article>
        )
      })}
      <Centinela faltan={faltan} refEl={centinela} onVerMas={verMas} />
    </div>
  )
}
