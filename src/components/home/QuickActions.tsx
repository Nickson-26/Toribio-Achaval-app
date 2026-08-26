'use client'
import { Plus, CircleDollarSign, ReceiptText, Users, type LucideIcon } from 'lucide-react'
import { useNavigation } from '@/components/NavigationProvider'
import { usePermisos } from '@/design/usePermisos'
import { DESTINOS, type AppRoute } from '@/lib/navigation'
import type { Accion } from '@/design/permissions'

/**
 * ¿Qué querés hacer? — cuatro acciones, no diez.
 *
 * La lista se filtra con `puedeHacer()` de la Fase 1: un viewer no ve acciones
 * de escritura. No hay tres Homes distintos — es la misma estructura con el
 * contenido adaptado.
 *
 * Recordatorio: esto es UX. La autoridad sigue siendo RLS.
 */

type QuickAction = {
  id: string
  label: string
  icon: LucideIcon
  /** `undefined` = visible para cualquier usuario aprobado. */
  permiso?: Accion
  /** Navegar, o abrir algo en la propia pantalla. */
  destino?: AppRoute
  accion?: 'nuevaFactura'
}

const ACCIONES: QuickAction[] = [
  {
    id: 'factura',
    label: 'Nueva factura',
    icon: Plus,
    permiso: 'comprobante.crear',
    accion: 'nuevaFactura',
  },
  {
    id: 'cobro',
    label: 'Registrar cobro',
    icon: CircleDollarSign,
    permiso: 'comprobante.cobrar',
    // Lleva a Facturación filtrada por pendientes, donde vive el flujo actual.
    // El selector de factura desde el Home se evalúa en la Fase 3.
    destino: DESTINOS.facturasPendientes(),
  },
  {
    id: 'recibo',
    label: 'Nuevo recibo',
    icon: ReceiptText,
    permiso: 'recibo.crear',
    destino: { to: 'recibos' },
  },
  {
    id: 'cliente',
    label: 'Buscar cliente',
    icon: Users,
    destino: { to: 'clientes' },
  },
]

export function QuickActions({ onNuevaFactura }: { onNuevaFactura: () => void }) {
  const { navigate } = useNavigation()
  const { puedeHacer } = usePermisos()

  const visibles = ACCIONES.filter(a => !a.permiso || puedeHacer(a.permiso))
  if (!visibles.length) return null

  return (
    <div className="ta-qa">
      {visibles.map(a => {
        const Icon = a.icon
        return (
          <button
            key={a.id}
            className="ta-qa__btn"
            onClick={() => (a.accion === 'nuevaFactura' ? onNuevaFactura() : a.destino && navigate(a.destino))}
          >
            <span className="ta-qa__ico" aria-hidden><Icon size={17} /></span>
            <span>{a.label}</span>
          </button>
        )
      })}
    </div>
  )
}
