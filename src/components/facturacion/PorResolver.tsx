'use client'
import { ChevronRight } from 'lucide-react'
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

export function Hoy({ r }: { r: ResumenHoy }) {
  const partes: string[] = []
  if (r.pagos > 0) partes.push(`${r.pagos} ${r.pagos === 1 ? 'pago' : 'pagos'}`)
  if (r.emitidas > 0) partes.push(`${r.emitidas} ${r.emitidas === 1 ? 'factura' : 'facturas'}`)

  return (
    <p className="ta-hoy">
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
            className="ta-senal"
            onClick={() => onAbrir(s)}
            aria-label={`${s.titulo}: ${s.detalle}${s.nota ? `. ${s.nota}` : ''}`}
          >
            <span className="ta-senal__cuerpo">
              <span className="ta-senal__titulo">{s.titulo}</span>
              {/* Dos versiones del mismo dato: en 390px el detalle largo se
                  parte en tres renglones. El matiz de "el pago ya entró" sigue
                  en el aria-label y en el título de la señal. */}
              <span className="ta-senal__detalle ta-only-desktop-inline">
                {s.detalle}
                {s.nota && <> · {s.nota}</>}
              </span>
              <span className="ta-senal__detalle ta-solo-mobile-inline">
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
