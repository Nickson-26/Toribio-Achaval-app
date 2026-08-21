'use client'
import { useMemo } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { puede, type Accion } from './permissions'

/**
 * Acceso a permisos desde componentes.
 *
 *   const { puedeHacer, role, esViewer } = usePermisos()
 *   {puedeHacer('comprobante.crear') && <Button>+ Nueva factura</Button>}
 *
 * Se apoya en el AuthProvider existente. No duplica lógica de sesión.
 */
export function usePermisos() {
  const { user, isAdmin, isEditor } = useAuth()
  const role = user?.role ?? null

  return useMemo(() => ({
    role,
    isAdmin,
    isEditor,
    esViewer: role === 'viewer',
    /** Recordatorio: esto es UX. La autoridad real es RLS. */
    puedeHacer: (accion: Accion) => puede(role, accion),
  }), [role, isAdmin, isEditor])
}
