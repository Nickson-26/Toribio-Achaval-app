'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, FileSearch } from 'lucide-react'
import { Money } from '@/components/HideNumbers'
import { StatusBadge, EmptyState, SkeletonRows, Button } from '@/design/primitives'
import { ars, usd, fdate } from '@/lib/utils'
import type { Comprobante } from '@/lib/supabase'
import { fechaCorta, puntoVentaDe, diasDesde } from '@/lib/facturacion'

/**
 * Las dos formas de mirar la misma lista.
 *
 * Escritorio: tabla, con cinco columnas. Comprobante, fecha, cliente, importe
 * y estado — lo que hace falta para EXPLORAR. Neto, IVA, unidad y punto de
 * venta salieron: son datos de verificación y viven en el detalle, que es
 * donde se verifican. Una tabla con toda la base adentro no es una lista, es
 * un volcado.
 *
 * Mobile: lista de movimientos. NO es la tabla comprimida ni una pila de
 * tarjetas. Cliente e importe arriba, comprobante, fecha y estado abajo. Todo
 * lo demás vive en el detalle, que es donde se verifica.
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
    <div ref={refEl} className="ta-vermas">
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
    <div className="ta-tabla-wrap">
      <table className="ta-tabla">
        <thead>
          <tr>
            <th className="ta-tabla__num">N°</th>
            <th className="ta-tabla__fecha">Fecha</th>
            <th>Cliente</th>
            <th className="ta-num ta-tabla__importe">Importe</th>
            <th className="ta-tabla__estado">Estado</th>
            <th className="ta-fila__chev"><span className="ta-sr">Abrir</span></th>
          </tr>
        </thead>
        <tbody>
          {visibles.map(c => (
            <tr
              key={c.id}
              className={`ta-fila${seleccionadaId === c.id ? ' is-sel' : ''}`}
              onClick={() => onAbrir(c)}
              tabIndex={0}
              role="button"
              aria-label={`Abrir factura ${c.numero} de ${c.cliente}`}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(c) }
              }}
            >
              <td className="ta-tabla__num">
                <span className="ta-fila__n">{c.numero}</span>
                {/* El punto de venta es el mismo en el 99% de las filas: en
                    reposo son sesenta repeticiones de "PV 0002" que no
                    ayudan a distinguir una factura de otra. Aparece cuando el
                    usuario se acerca a ESTA fila, y vive completo en el
                    detalle. Sigue en el DOM y sin aria-hidden, así que un
                    lector de pantalla lo lee siempre: la información no se
                    perdió, se sacó del reposo. */}
                <span className="ta-fila__pv">PV {puntoVentaDe(c)}</span>
              </td>
              <td className="ta-fila__fecha">{fdate(c.fecha)}</td>
              <td className="ta-fila__cliente" title={c.cliente}>{c.cliente}</td>
              <td className="ta-num ta-tabla__importe ta-fila__total">
                <Money>{ars(c.monto_ars)}</Money>
                {c.monto_usd ? <Money className="ta-fila__usd">{usd(c.monto_usd)}</Money> : null}
              </td>
              <td className="ta-tabla__estado"><StatusBadge estado={c.estado} sm withHint /></td>
              <td className="ta-fila__chev"><ChevronRight size={15} aria-hidden /></td>
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
   ══════════════════════════════════════════════════════════════════════════
   Movimientos, no tarjetas.

   La versión anterior envolvía cada factura en una caja con borde, radio y un
   botón de acción adentro. Cinco facturas llenaban la pantalla y la lista se
   leía como un formulario. Ahora son dos renglones separados por una línea:

     CAPLAN ARIEL ROLANDO              $ 6.914.606
     FACT A 4262 · 26/08                   Cobrada

   La fila entera es el blanco táctil y no hay botones adentro. El listado es
   para CONSULTAR; operar se hace desde el detalle, que es donde el usuario ya
   tiene delante lo que necesita para decidir. */
export function FacturasLista({
  facturas, cargando, onAbrir, hayFiltros,
}: {
  facturas: Comprobante[]
  cargando: boolean
  onAbrir: (c: Comprobante) => void
  hayFiltros: boolean
}) {
  const { visibles, faltan, centinela, verMas } = useVentana(facturas)

  if (cargando) return <SkeletonRows rows={7} />
  if (!facturas.length) return <Vacio hayFiltros={hayFiltros} />

  return (
    <div className="ta-movs">
      {visibles.map(c => {
        // La antigüedad sólo importa mientras la plata no entró: en una
        // cobrada, "hace 74 días" no le sirve a nadie.
        const dias = c.estado === 'pendiente' ? diasDesde(c.fecha) : null
        return (
          <button
            key={c.id}
            type="button"
            className="ta-mov"
            onClick={() => onAbrir(c)}
            aria-label={`${c.cliente}, ${c.tipo} ${c.numero}, ${ars(c.monto_ars)}`}
          >
            <span className="ta-mov__l1">
              <span className="ta-mov__cliente">{c.cliente}</span>
              <Money className="ta-mov__monto">{ars(c.monto_ars)}</Money>
            </span>

            <span className="ta-mov__l2">
              <span className="ta-mov__meta">
                {c.tipo} {c.numero} · {fechaCorta(c.fecha)}
                {dias !== null && ` · ${dias}d`}
              </span>
              <StatusBadge estado={c.estado} sm />
            </span>
          </button>
        )
      })}
      <Centinela faltan={faltan} refEl={centinela} onVerMas={verMas} />
    </div>
  )
}
