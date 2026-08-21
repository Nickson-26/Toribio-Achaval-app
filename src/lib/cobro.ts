/**
 * Reglas puras del registro de cobro.
 *
 * Este módulo NO importa Supabase ni React a propósito: contiene solamente
 * decisiones deterministas, para poder testearlas sin base de datos.
 * Ver `scripts/test-cobro.mjs`.
 *
 * Invariante que protege este archivo:
 *   UNA FACTURA NUNCA PUEDE QUEDAR VINCULADA A UN RECIBO DE OTRO CLIENTE.
 */

/** Máximo de renumeraciones ante colisión de ID antes de abandonar. */
export const MAX_INTENTOS_RECIBO = 5

export type ReciboMinimo = {
  id: number
  cliente: string | null
  nro_fact?: string | null
}

export type ComprobanteMinimo = {
  id: string
  cliente: string | null
}

/**
 * Normaliza una razón social para comparar.
 * Tolera diferencias de espaciado, mayúsculas y acentos, que son ruido de
 * carga manual — pero NO tolera que sean clientes distintos.
 */
export function normalizarCliente(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // sacar acentos
    .replace(/[.,]/g, '')            // "S.A." == "SA"
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

export function esMismoCliente(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizarCliente(a)
  const nb = normalizarCliente(b)
  if (!na || !nb) return false
  return na === nb
}

export type VerificacionRecibo =
  | { ok: true; motivo?: undefined }
  | { ok: false; motivo: string }

/**
 * Decide si es lícito vincular `comprobante` al `recibo` indicado.
 *
 * Se rechaza cuando:
 *   - el recibo no existe;
 *   - el recibo pertenece a otro cliente.
 *
 * Un recibo sin cliente cargado también se rechaza: no se puede probar que
 * sea el mismo, y ante la duda no se vincula.
 */
export function verificarReciboCompatible(
  recibo: ReciboMinimo | null | undefined,
  comprobante: ComprobanteMinimo
): VerificacionRecibo {
  if (!recibo) {
    return { ok: false, motivo: 'El recibo indicado no existe.' }
  }
  if (!normalizarCliente(recibo.cliente)) {
    return {
      ok: false,
      motivo: `El recibo ${recibo.id} no tiene cliente cargado, no se puede verificar que corresponda a ${comprobante.cliente ?? 'este comprobante'}.`,
    }
  }
  if (!esMismoCliente(recibo.cliente, comprobante.cliente)) {
    return {
      ok: false,
      motivo: `El recibo ${recibo.id} pertenece a "${recibo.cliente}" y el comprobante ${comprobante.id} es de "${comprobante.cliente}". No se vinculan comprobantes a recibos de otro cliente.`,
    }
  }
  return { ok: true }
}

/**
 * Ante una colisión de ID (Postgres 23505) al intentar crear un recibo,
 * decide qué hacer con el recibo que ya ocupaba ese número.
 *
 *   'reusar'     → es exactamente este mismo cobro, ya aplicado. Idempotente.
 *   'renumerar'  → es otro recibo. Hay que tomar un número nuevo.
 */
export type AccionColision = 'reusar' | 'renumerar'

export function resolverColision(
  ocupante: ReciboMinimo | null | undefined,
  comprobante: ComprobanteMinimo
): AccionColision {
  if (!ocupante) return 'renumerar'
  const mismoCliente = esMismoCliente(ocupante.cliente, comprobante.cliente)
  const mismaFactura = (ocupante.nro_fact ?? '') === comprobante.id
  // Solo se reutiliza si es inequívocamente el mismo cobro repetido.
  return mismoCliente && mismaFactura ? 'reusar' : 'renumerar'
}
