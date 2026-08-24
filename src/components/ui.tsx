'use client'
/**
 * FACHADA DE COMPATIBILIDAD
 * =========================
 *
 * Las 11 pantallas de `src/screens/` importan `Modal`, `FG`, `toast`,
 * `Spinner`, `TipoBadge` y `EstadoBadge` desde acá. Este archivo re-exporta
 * las implementaciones nuevas de `src/design/` para que ninguna pantalla tenga
 * que tocarse en la Fase 1.
 *
 * Las pantallas migran a importar directo de `@/design/primitives` en las
 * Fases 2-6, y entonces este archivo desaparece.
 *
 * Regla: acá no se escribe lógica nueva. Sólo adaptadores.
 */
import type { ReactNode } from 'react'
import {
  Modal as DModal, Spinner as DSpinner, ToastProvider as DToastProvider,
  toast as dToast, StatusBadge, TipoBadge as DTipoBadge,
} from '@/design/primitives'

export { Modal } from '@/design/primitives'
export { Spinner, ToastProvider, toast } from '@/design/primitives'
export { TipoBadge } from '@/design/primitives'

/**
 * Badge de estado.
 *
 * Antes recibía el valor crudo y lo renderizaba tal cual, así que la UI
 * mostraba `faltan_retenciones` y `echeq_pendiente` en snake_case.
 * Ahora delega en StatusBadge, que traduce a texto humano.
 * La firma no cambia: las pantallas siguen pasando `estado`.
 */
export function EstadoBadge({ estado }: { estado: string }) {
  return <StatusBadge estado={estado} withHint />
}

/**
 * FormGroup del sistema anterior.
 *
 * Mantiene la firma exacta (`label`, `children`, `full`) y las clases
 * `form-group` / `full` que consumen los formularios existentes, para no
 * romper sus grillas. Los estilos viven en globals.css.
 */
export function FG({
  label, children, full,
}: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <div className={`form-group${full ? ' full' : ''}`}>
      <label>{label}</label>
      {children}
    </div>
  )
}

// Referencias para que el linter no marque los imports como muertos:
// son la prueba de que la fachada apunta a las implementaciones nuevas.
void DModal; void DSpinner; void DToastProvider; void dToast; void DTipoBadge
