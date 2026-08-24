import type { ComprobanteEstado } from '@/lib/supabase'

/**
 * FUENTE ÚNICA DE VERDAD de los estados en la interfaz.
 *
 * Los valores de la base no se tocan nunca. Esta capa los traduce.
 * Prohibido mostrar snake_case al usuario: `faltan_retenciones` y
 * `echeq_pendiente` se renderizaban crudos en los badges.
 *
 * Antes la decisión visual estaba repartida: `estadoColor()` en utils.ts para
 * el color, el valor crudo para el texto, y comparaciones
 * `estado === 'faltan_retenciones'` desperdigadas para el resto.
 */

/** Familias de color semántico. Las resuelve StatusBadge a tokens. */
export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'violet'

export type StatusDef = {
  /** Texto visible. Nunca snake_case. */
  label: string
  tone: Tone
  /** Aclaración de una línea, para tooltips y vistas de detalle. */
  hint: string
  /** Nombre del icono de lucide-react. */
  icon: string
}

export const ESTADO_CONFIG: Record<ComprobanteEstado, StatusDef> = {
  pendiente: {
    label: 'Pendiente',
    tone: 'warning',
    hint: 'Pago pendiente',
    icon: 'Clock',
  },
  faltan_retenciones: {
    // El estado más importante de traducir bien. El dinero YA entró: no es
    // deuda ni error crítico, falta cerrar el circuito administrativo.
    // Por eso NO comparte el tono de `pendiente`.
    label: 'Faltan retenciones',
    tone: 'info',
    hint: 'Pago recibido · faltan retenciones',
    icon: 'FileClock',
  },
  cobrada: {
    label: 'Cobrada',
    tone: 'success',
    hint: 'Circuito completado',
    icon: 'CircleCheck',
  },
  echeq_pendiente: {
    label: 'E-cheq pendiente',
    tone: 'violet',
    hint: 'E-cheq registrado, aún sin acreditar',
    icon: 'CalendarClock',
  },
  emitida: {
    label: 'Emitida',
    tone: 'info',
    hint: 'Comprobante emitido',
    icon: 'FileText',
  },
  anulada: {
    label: 'Anulada',
    tone: 'neutral',
    hint: 'Comprobante anulado',
    icon: 'Ban',
  },
}

const FALLBACK: StatusDef = { label: '—', tone: 'neutral', hint: '', icon: 'Circle' }

/** Nunca lanza: un estado desconocido cae en un neutro con guion. */
export function estadoDef(estado: string | null | undefined): StatusDef {
  if (!estado) return FALLBACK
  return ESTADO_CONFIG[estado as ComprobanteEstado] ?? { ...FALLBACK, label: estado }
}

export function estadoLabel(estado: string | null | undefined): string {
  return estadoDef(estado).label
}

/** Orden de presentación en filtros y leyendas. Sigue el flujo operativo. */
export const ESTADOS_ORDEN: ComprobanteEstado[] = [
  'pendiente',
  'faltan_retenciones',
  'echeq_pendiente',
  'cobrada',
  'emitida',
  'anulada',
]

// ── Tipos de comprobante ────────────────────────────────────────────────────

/** Tono por tipo de comprobante. Reemplaza a `tipoColor()` de utils.ts. */
export function tipoTone(tipo: string | null | undefined): Tone {
  if (!tipo) return 'neutral'
  const t = tipo.trim().toUpperCase()
  if (t.startsWith('FACT A'))  return 'info'
  if (t.startsWith('FACT B'))  return 'violet'
  if (t.startsWith('FACT DE')) return 'warning'
  if (t.startsWith('FACT E'))  return 'success'
  if (t.startsWith('NC'))      return 'danger'
  if (t.startsWith('ND'))      return 'warning'
  return 'neutral'
}
