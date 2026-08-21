/**
 * Reglas fiscales de interpretación de comprobantes.
 *
 * Módulo puro y testeable (sin Supabase ni React). Existe para que Dashboard,
 * Informe PDF y cualquier reporte futuro deriven el neto con la MISMA lógica.
 * Antes cada uno tenía su copia y divergían.
 *
 * IMPORTANTE — esto NO calcula comprobantes nuevos.
 * El alta vive en `components/ComprobanteForms.tsx` y no se toca: ahí el
 * almacenamiento ya es correcto (verificado: las 48 FACT B de producción
 * tienen neto_ars e iva en NULL, que es lo que corresponde).
 * Este módulo sólo INTERPRETA lo que ya está guardado.
 */

export const IVA_RATE = 0.21

/** Divisor para pasar de un total con IVA a su neto. */
const CON_IVA = 1 + IVA_RATE

export type ComprobanteFiscal = {
  tipo?: string | null
  monto_ars?: number | null
  monto_usd?: number | null
  tipo_cambio?: number | null
  neto_ars?: number | null
  neto_usd?: number | null
}

/**
 * Tipos de comprobante que NO discriminan IVA.
 *
 * En Factura B (y sus notas) el IVA no se expone por separado: el total
 * facturado ES la base. Derivar un neto dividiendo por 1,21 le descuenta un
 * impuesto que nunca se discriminó.
 *
 * Nota sobre FACT E (exportación): se deja fuera de esta lista, o sea que
 * sigue tratándose como discriminado, igual que hasta hoy. Cambiar su
 * tratamiento es una definición contable aparte, no un bug de código.
 */
const SIN_IVA_DISCRIMINADO = new Set([
  'FACT B',
  'NC B',
  'ND B',
])

export function discriminaIVA(tipo: string | null | undefined): boolean {
  if (!tipo) return true
  return !SIN_IVA_DISCRIMINADO.has(tipo.trim().toUpperCase())
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Total facturado en ARS (bruto, con IVA si corresponde).
 * Las facturas en USD se convierten con el tipo de cambio del comprobante.
 */
export function brutoARS(c: ComprobanteFiscal): number {
  if (c.monto_usd) return c.tipo_cambio ? r2(c.monto_usd * c.tipo_cambio) : 0
  return c.monto_ars || 0
}

/**
 * Neto (base imponible) en ARS.
 *
 * Orden de preferencia:
 *   1. Si el tipo no discrimina IVA -> el total ES el neto.
 *   2. Si hay neto cargado (neto_usd o neto_ars) -> se usa el real.
 *   3. Si no -> se deriva dividiendo el total por 1,21.
 *
 * El paso 1 es la corrección: antes esta función no miraba el tipo y aplicaba
 * el paso 3 a las Factura B, subestimándolas exactamente un 21 %.
 */
export function netoARS(c: ComprobanteFiscal): number {
  // ── Sin IVA discriminado: el total es la base ──
  if (!discriminaIVA(c.tipo)) {
    if (c.monto_usd) return c.tipo_cambio ? r2(c.monto_usd * c.tipo_cambio) : 0
    return c.monto_ars || 0
  }

  // ── Con IVA discriminado ──
  if (c.monto_usd) {
    if (!c.tipo_cambio) return 0
    if (c.neto_usd) return r2(c.neto_usd * c.tipo_cambio)
    return r2((c.monto_usd * c.tipo_cambio) / CON_IVA)
  }
  if (c.neto_ars) return c.neto_ars
  if (c.monto_ars) return r2(c.monto_ars / CON_IVA)
  return 0
}

/** IVA implícito: bruto − neto. Cero para los tipos que no discriminan. */
export function ivaARS(c: ComprobanteFiscal): number {
  return r2(brutoARS(c) - netoARS(c))
}

/**
 * Calcula neto/IVA/total a partir de un neto ingresado, para el ALTA de
 * comprobantes que discriminan IVA.
 *
 * Para los que no discriminan devuelve iva = 0 y total = neto, que es lo que
 * evita que el formulario de Nota de Crédito B invente un 21 %.
 */
export function desdeNeto(tipo: string, neto: number): { neto: number; iva: number; total: number } {
  if (!discriminaIVA(tipo)) return { neto, iva: 0, total: neto }
  const iva = r2(neto * IVA_RATE)
  return { neto, iva, total: r2(neto + iva) }
}
