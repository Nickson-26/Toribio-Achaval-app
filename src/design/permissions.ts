import type { UserRole } from '@/lib/auth'

/**
 * PERMISOS DE INTERFAZ — evaluación centralizada.
 *
 * ⚠ ESTO ES UX, NO SEGURIDAD.
 * La autoridad es RLS en Supabase, verificado en Fase 0: un `viewer` real
 * escribió 0 filas en 9 operaciones distintas contra producción, incluida la
 * autopromoción a admin. Ocultar un botón no protege nada.
 *
 * Lo que resuelve: hoy un `viewer` ve 12 acciones que inevitablemente
 * terminan en un error crudo de Postgres
 * ("new row violates row-level security policy"). Eso es una mala
 * experiencia, no un agujero.
 *
 * Reemplaza a los `if (user.role === 'admin')` sueltos por un vocabulario de
 * acciones. Si mañana cambia quién puede anular, se cambia acá y no en
 * doce archivos.
 */

export type Accion =
  // Comprobantes
  | 'comprobante.crear'
  | 'comprobante.editar'
  | 'comprobante.anular'
  | 'comprobante.eliminar'
  | 'comprobante.cobrar'
  | 'comprobante.adjuntarPDF'
  | 'comprobante.importarPDF'
  // Retenciones
  | 'retenciones.gestionar'
  // Recibos
  | 'recibo.crear'
  | 'recibo.editar'
  | 'recibo.eliminar'
  // Notas de crédito y débito
  | 'nota.crear'
  | 'nota.editar'
  | 'nota.eliminar'
  // Reservas
  | 'reserva.crear'
  | 'reserva.editar'
  | 'reserva.eliminar'
  | 'reserva.importar'
  | 'reserva.exportar'
  // Administración
  | 'usuarios.gestionar'
  | 'informe.generar'
  // Lectura y exportación
  | 'datos.exportar'

/**
 * Qué roles habilitan cada acción.
 *
 * Se alinea con las políticas RLS reales de `supabase_enterprise.sql`:
 *   comprobantes  INSERT/UPDATE -> admin, editor   DELETE -> admin
 *   recibos       ALL           -> admin, editor
 *   reservas      ALL           -> admin, editor
 *   retenciones   ALL           -> admin, editor
 *   usuarios      manage        -> admin
 *
 * Si la UI y RLS se desalinean, RLS gana. Mantener esta tabla en sincronía
 * es lo que evita mostrar botones que van a fallar.
 */
const REGLAS: Record<Accion, UserRole[]> = {
  'comprobante.crear':       ['admin', 'editor'],
  'comprobante.editar':      ['admin', 'editor'],
  'comprobante.anular':      ['admin', 'editor'],
  'comprobante.eliminar':    ['admin'],
  'comprobante.cobrar':      ['admin', 'editor'],
  'comprobante.adjuntarPDF': ['admin', 'editor'],
  'comprobante.importarPDF': ['admin', 'editor'],

  'retenciones.gestionar':   ['admin', 'editor'],

  'recibo.crear':            ['admin', 'editor'],
  'recibo.editar':           ['admin', 'editor'],
  'recibo.eliminar':         ['admin', 'editor'],

  'nota.crear':              ['admin', 'editor'],
  'nota.editar':             ['admin', 'editor'],
  'nota.eliminar':           ['admin'],

  'reserva.crear':           ['admin', 'editor'],
  'reserva.editar':          ['admin', 'editor'],
  'reserva.eliminar':        ['admin', 'editor'],
  // Reemplaza TODA la tabla de reservas. Sólo admin.
  'reserva.importar':        ['admin'],
  'reserva.exportar':        ['admin', 'editor'],

  'usuarios.gestionar':      ['admin'],
  'informe.generar':         ['admin'],

  // Un viewer puede exportar lo que ya puede ver en pantalla.
  'datos.exportar':          ['admin', 'editor', 'viewer'],
}

/** ¿Este rol puede ejecutar esta acción? Sin rol, no. */
export function puede(role: UserRole | null | undefined, accion: Accion): boolean {
  if (!role) return false
  return REGLAS[accion]?.includes(role) ?? false
}

/** Todas las acciones habilitadas para un rol. Útil para tests y debugging. */
export function accionesDe(role: UserRole | null | undefined): Accion[] {
  if (!role) return []
  return (Object.keys(REGLAS) as Accion[]).filter(a => puede(role, a))
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin:  'Administrador',
  editor: 'Editor',
  viewer: 'Solo lectura',
}

export const ROLE_TONE: Record<UserRole, 'brand' | 'info' | 'neutral'> = {
  admin:  'brand',
  editor: 'info',
  viewer: 'neutral',
}
