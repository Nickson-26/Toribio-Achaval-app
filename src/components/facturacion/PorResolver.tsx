'use client'
import { ArrowDownLeft } from 'lucide-react'
import { Money } from '@/components/HideNumbers'
import { ContextoLinea, Senales, type SenalItem } from '@/components/modulo'
import { arsCorto, type Senal, type ResumenHoy } from '@/lib/facturacion'

/**
 * Las dos capas de contexto que abren Facturación.
 *
 * Los componentes son los compartidos: la misma línea de contexto y la misma
 * lista de señales que usan Recibos y Reservas. Acá sólo se traduce el
 * vocabulario de Facturación —pagos, retenciones, e-cheqs— a esa forma.
 */

export function Hoy({ r }: { r: ResumenHoy }) {
  const partes: string[] = []
  if (r.pagos > 0) partes.push(`${r.pagos} ${r.pagos === 1 ? 'pago' : 'pagos'}`)
  if (r.emitidas > 0) partes.push(`${r.emitidas} ${r.emitidas === 1 ? 'factura' : 'facturas'}`)

  return (
    <ContextoLinea
      rotulo="Hoy"
      icono={ArrowDownLeft}
      activo={r.hayAlgo}
      texto={r.hayAlgo
        ? partes.join(' · ')
        : <>sin movimientos{r.pagosSemana > 0 && ` · ${r.pagosSemana} en la semana`}</>}
      monto={r.montoPagos > 0 ? <Money>{arsCorto(r.montoPagos)}</Money> : undefined}
    />
  )
}

export function PorResolver({
  senales, onAbrir,
}: {
  senales: Senal[]
  onAbrir: (s: Senal) => void
}) {
  const items: SenalItem[] = senales.map(s => ({
    id: s.id,
    titulo: s.titulo,
    detalle: s.detalle,
    detalleCorto: s.detalleCorto,
    nota: s.nota,
    tono: s.tono,
    // Abreviado a propósito: acá importa la magnitud, no el peso exacto. El
    // importe completo está en la lista y en el detalle.
    monto: s.montoARS > 0 ? <Money>{arsCorto(s.montoARS)}</Money> : undefined,
  }))

  return (
    <Senales
      senales={items}
      onAbrir={i => {
        const s = senales.find(x => x.id === i.id)
        if (s) onAbrir(s)
      }}
    />
  )
}
