// Parser de mails "Nueva Reserva" → payload listo para POST /api/reservas/import
//
// Uso programático:
//   import { parseReservaEmail } from './parse-reserva-email.mjs'
//   const r = parseReservaEmail({ messageId, subject, snippet, dateIso })
//   if (r.ok) postear(r.payload)

// ─── Mapeo código → unidad de negocio (string que vive en DB) ─────
export const CODE_TO_UNIDAD = {
  // Residencial
  TAR: 'PLAT. PALERMO',
  TCD: 'PLAT. PALERMO',
  TBB: 'PLAT. BELGRANO',
  TNP: 'PLAT. BELGRANO',
  TMO: 'PLAT. CABALLITO',
  TRO: 'PLAT. CABALLITO',
  TCR: 'PLAT. RECOLETA',
  TJU: 'PLAT. RECOLETA',
  TPI: 'PLAT. PILAR',
  TBA: 'PLAT. BARILOCHE',
  TRS: 'DPTO DE BÚSQUEDA',
  // Emprendimientos
  TAE: 'EMPRENDIMIENTOS',
  TES: 'EMPRENDIMIENTOS',
  TCN: 'EMPRENDIMIENTOS',
  TUC: 'EMPRENDIMIENTOS',
  // Comercial
  TCO: 'CONSULTORIA',
  TOE: 'OFICINAS Y EDIFICIOS',
  TII: 'INDUSTRIA',
  TLT: 'LOCALES Y TERRENOS',
}

// Broker → unidad para mails "Indirecta" (sin código en el subject).
// Completar con el mapeo que pase Nico. Mientras tanto, los brokers no
// listados acá se SKIPean (no se insertan) y se registran para review manual.
export const INDIRECTA_BROKER_TO_UNIDAD = {
  // 'Gabriela Costa': 'PLAT. BELGRANO',
}

const VALID_UNIDADES = new Set(Object.values(CODE_TO_UNIDAD))

export function parseReservaEmail({ messageId, subject, snippet, dateIso }) {
  const result = { ok: false, skip_reason: null, payload: null, debug: {} }

  // Detectar código en subject: "Nueva Reserva - TCD66460" o "Nueva Reserva Indirecta"
  const codeMatch = subject.match(/Nueva Reserva\s*-\s*([A-Z]{3})\d+/i)
  const isIndirecta = /indirecta/i.test(subject)

  let unidad = null
  let propertyCode = null
  if (codeMatch) {
    propertyCode = codeMatch[1].toUpperCase()
    unidad = CODE_TO_UNIDAD[propertyCode] || null
  }

  // Dirección — patrón A (con código) y B (Indirecta)
  let direccion = null
  const dirA = snippet.match(/para la propiedad\s+[A-Z]{3}\d+\s*-\s*(.+?)\s*Precio Publicaci[oó]n:/i)
  const dirB = snippet.match(/para la propiedad\s+en\s+(.+?)\s*Precio Publicaci[oó]n:/i)
  if (dirA) direccion = dirA[1].trim()
  else if (dirB) direccion = dirB[1].trim()

  // Operación
  const opMatch = snippet.match(/Operaci[oó]n:\s*(Venta|Alquiler)/i)
  const operacion = opMatch ? opMatch[1].toUpperCase() : null

  // Precio de Reserva: "$ 1200000" → ARS, "u$s 58000" → USD
  const precioMatch = snippet.match(/Precio de Reserva:\s*(u\$s|\$|US\$|USD|ARS)\s*([\d.,]+)/i)
  let monto_ars = null
  let monto_usd = null
  if (precioMatch) {
    const cur = precioMatch[1].toLowerCase()
    const num = Number(precioMatch[2].replace(/\./g, '').replace(/,/g, '.'))
    if (cur === 'u$s' || cur === 'us$' || cur === 'usd') monto_usd = num
    else monto_ars = num
  }

  // Broker — el snippet de Gmail puede cortarse en "Medio" sin "de"
  const brokerMatch = snippet.match(/Broker que reservo:\s*(.+?)(?:\s+Medio\b|$)/i)
  const broker = brokerMatch ? brokerMatch[1].trim() : null

  // Modo de pago — solo aparece si el snippet llegó hasta acá
  const pagoMatch = snippet.match(/Medio de Pago:\s*([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+?)(?:\s+[A-Z][a-z]|$)/)
  const modo_pago = pagoMatch ? pagoMatch[1].trim().toUpperCase() : null

  // Cliente — viene en el body completo (no en el snippet truncado)
  const clienteMatch = snippet.match(/Cliente:\s*(.+?)(?:\s+[A-Z][a-z]|$)/)
  const cliente = clienteMatch ? clienteMatch[1].trim() : null

  // Fecha del header del mail, en zona AR
  const fecha = isoToLocalDate(dateIso, 'America/Argentina/Buenos_Aires')

  // ─── Decisión ────────────────────────────────────────────────────
  if (!direccion) {
    result.skip_reason = 'no_direccion_parseable'
    result.debug = { subject, snippet }
    return result
  }
  if (!operacion) {
    result.skip_reason = 'no_operacion_parseable'
    result.debug = { subject, snippet }
    return result
  }

  // Indirecta → fallback por broker
  if (!unidad) {
    if (isIndirecta && broker && INDIRECTA_BROKER_TO_UNIDAD[broker]) {
      unidad = INDIRECTA_BROKER_TO_UNIDAD[broker]
    } else {
      result.skip_reason = isIndirecta
        ? `indirecta_sin_mapping_para_broker:${broker || 'desconocido'}`
        : `codigo_desconocido:${propertyCode}`
      result.debug = { subject, snippet, broker, propertyCode }
      return result
    }
  }

  if (!VALID_UNIDADES.has(unidad)) {
    result.skip_reason = `unidad_invalida:${unidad}`
    return result
  }

  result.ok = true
  result.payload = {
    email_message_id: messageId,
    fecha,
    direccion,
    broker,
    cliente,
    operacion,
    unidad,
    monto_ars,
    monto_usd,
    modo_pago,
    firmo: 'PENDIENTE',
  }
  result.debug = { propertyCode, isIndirecta }
  return result
}

function isoToLocalDate(iso, tz) {
  const d = new Date(iso)
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  })
  return fmt.format(d)
}
