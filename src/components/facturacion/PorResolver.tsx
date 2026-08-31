'use client'
import { ChevronRight, ArrowDownLeft } from 'lucide-react'
import { Money } from '@/components/HideNumbers'
import { arsCorto, type Senal, type ResumenHoy } from '@/lib/facturacion'

/**
 * Las dos capas de contexto que abren Facturación.
 *
 * HOY es una línea. Contesta "¿pasó algo?" y nada más. Cuando no pasó nada lo
 * dice y da el contexto de la semana: un cero grande no es información.
 *
 * POR RESOLVER es una lista, no una grilla de tarjetas. La versión anterior
 * envolvía cada señal en una superficie con icono, borde y sombra: dos señales
 * ocupaban 240px de un teléfono antes de llegar a una sola factura. Ahora son
 * dos renglones separados por una línea, como los movimientos de un home
 * banking — el peso lo lleva la tipografía, no la caja.
 *
 * Sólo aparecen las situaciones que existen. Si no hay e-cheqs pendientes no
 * hay fila de e-cheqs; una que dice "0" ocupa el mismo lugar que una que dice
 * algo. Y no hay acciones acá: esto anticipa trabajo, no lo ejecuta.
 */

/**
 * La presencia de HOY la decide el dato, no el layout.
 *
 * Un día sin movimientos y un día con dos pagos de $17,5 M no pueden pesar
 * lo mismo en la pantalla. Cuando no pasó nada esto es un renglón terciario
 * que se puede saltear con la vista; cuando pasó algo se enciende el
 * indicador cyan —el color de "la plata entró"— y aparece el importe.
 *
 * Es la misma línea, no dos componentes: no hay una card que aparece y
 * desaparece moviendo todo lo de abajo.
 */
export function Hoy({ r }: { r: ResumenHoy }) {
  const partes: string[] = []
  if (r.pagos > 0) partes.push(`${r.pagos} ${r.pagos === 1 ? 'pago' : 'pagos'}`)
  if (r.emitidas > 0) partes.push(`${r.emitidas} ${r.emitidas === 1 ? 'factura' : 'facturas'}`)

  return (
    <p className={`ta-hoy${r.hayAlgo ? ' is-activo' : ''}`}>
      {/* Con actividad, el indicador cyan dice "esto está pasando ahora".
          Sin actividad no hay nada que señalar: queda un punto neutro, que
          mantiene la línea alineada con las señales de abajo sin encender un
          color que promete una novedad inexistente. */}
      <span className="ta-hoy__pin" aria-hidden>
        {r.hayAlgo ? <ArrowDownLeft size={13} /> : null}
      </span>
      <span className="ta-hoy__label">Hoy</span>
      {r.hayAlgo ? (
        <>
          <span className="ta-hoy__txt">{partes.join(' · ')}</span>
          {r.montoPagos > 0 && (
            <Money className="ta-hoy__monto">{arsCorto(r.montoPagos)}</Money>
          )}
        </>
      ) : (
        <span className="ta-hoy__txt ta-hoy__txt--quieto">
          sin movimientos
          {r.pagosSemana > 0 && ` · ${r.pagosSemana} en la semana`}
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
  // Nada que resolver: la sección entera desaparece. No hace falta un cartel
  // celebrando que no hay trabajo.
  if (!senales.length) return null

  return (
    <section className="ta-resolver" aria-label="Situaciones que requieren acción">
      <h2 className="ta-resolver__titulo">Por resolver</h2>

      <div className="ta-resolver__lista">
        {senales.map(s => (
          <button
            key={s.id}
            type="button"
            className={`ta-senal ta-senal--${s.tono}`}
            onClick={() => onAbrir(s)}
            aria-label={`${s.titulo}: ${s.detalle}${s.nota ? `. ${s.nota}` : ''}`}
          >
            {/* Un punto del color de la situación. Con dos o tres señales
                alcanza para reconocerlas sin leer. */}
            <span className="ta-senal__pin" aria-hidden />

            <span className="ta-senal__cuerpo">
              <span className="ta-senal__titulo">{s.titulo}</span>
              {/* Dos versiones del mismo dato: en 390px el detalle largo se
                  parte en tres renglones. El matiz de "el pago ya entró" sigue
                  en el aria-label y en el título de la señal. */}
              <span className="ta-senal__detalle ta-senal__detalle--largo">
                {s.detalle}
                {s.nota && <> · {s.nota}</>}
              </span>
              <span className="ta-senal__detalle ta-senal__detalle--corto">
                {s.detalleCorto}
              </span>
            </span>

            {s.montoARS > 0 && (
              // Abreviado a propósito: acá importa la magnitud, no el peso
              // exacto. El importe completo está en la lista y en el detalle.
              <Money className="ta-senal__monto">{arsCorto(s.montoARS)}</Money>
            )}
            <ChevronRight size={16} className="ta-senal__chev" aria-hidden />
          </button>
        ))}
      </div>
    </section>
  )
}
