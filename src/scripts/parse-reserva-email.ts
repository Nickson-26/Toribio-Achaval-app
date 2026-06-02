// Parser de mails "Nueva Reserva" → payload para Supabase

export const CODE_TO_UNIDAD: Record<string, string> = {
  TAR: 'PLAT. PALERMO',    TCD: 'PLAT. PALERMO',
  TMO: 'PLAT. CABALLITO',  TRO: 'PLAT. CABALLITO',
  TJU: 'PLAT. RECOLETA',   TCR: 'PLAT. RECOLETA',
  TBB: 'PLAT. BELGRANO',   TNP: 'PLAT. BELGRANO',
  TBA: 'PLAT. BARILOCHE',
  TPA: 'PLAT. ANGOSTURA',
  TPI: 'PLAT. PILAR',
  TRS: 'DPTO DE BÚSQUEDA',
  TCN: 'PLAT. CANNING',
  TAE: 'EMPRENDIMIENTOS',  TES: 'EMPRENDIMIENTOS',
  TUC: 'EMPRENDIMIENTOS',  TMC: 'EMPRENDIMIENTOS',
  TOE: 'OFICINAS Y EDIFICIOS',
  TLT: 'LOCALES Y TERRENOS',
  TCO: 'CONSULTORIA',
  TII: 'INDUSTRIA',
  TAP: 'TAP',
}

export const INDIRECTA_BROKER_TO_UNIDAD: Record<string, string> = {}

const VALID_UNIDADES = new Set(Object.values(CODE_TO_UNIDAD))

interface EmailInput {
  messageId: string
  subject: string
  snippet: string
  dateIso: string
}

interface ParseResult {
  ok: boolean
  skip_reason: string | null
  payload: any | null
  debug: any
}

export function parseReservaEmail({ messageId, subject, snippet, dateIso }: EmailInput): ParseResult {
  const result: ParseResult = { ok: false, skip_reason: null, payload: null, debug: {} }

  const codeMatch = subject.match(/Nueva Reserva\s*-\s*([A-Z]{3})\d+/i)
  const isIndirecta = /indirecta/i.test(subject)

  let unidad: string | null = null
  let propertyCode: string | null = null

  if (codeMatch) {
    propertyCode = codeMatch[1].toUpperCase()
    unidad = CODE_TO_UNIDAD[propertyCode] || null
  }

  // Dirección
  let direccion: string | null = null
  const dirA = snippet.match(/para la propiedad\s+[A-Z]{3}\d+\s*-\s*(.+?)\s*Precio Publicaci[oó]n:/i)
  const dirB = snippet.match(/para la propiedad\s+en\s+(.+?)\s*Precio Publicaci[oó]n:/i)
  if (dirA) direccion = dirA[1].trim()
  else if (dirB) direccion = dirB[1].trim()

  // Operación
  const opMatch = snippet.match(/Operaci[oó]n:\s*(Venta|Alquiler)/i)
  const operacion = opMatch ? opMatch[1].toUpperCase() : null

  // Precio de Reserva
  const precioMatch = snippet.match(/Precio de Reserva:\s*(u\$s|\$|US\$|USD|ARS)\s*([\d.,]+)/i)
  let monto_ars: number | null = null
  let monto_usd: number | null = null
  if (precioMatch) {
    const cur = precioMatch[1].toLowerCase()
    const num = Number(precioMatch[2].replace(/\./g, '').replace(/,/g, '.'))
    if (cur === 'u$s' || cur === 'us$' || cur === 'usd') monto_usd = num
    else monto_ars = num
  }

  const brokerMatch = snippet.match(/Broker que reservo:\s*(.+?)(?:\s+Medio\b|$)/i)
  const broker = brokerMatch ? brokerMatch[1].trim() : null

  const pagoMatch = snippet.match(/Medio de Pago:\s*([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+?)(?:\s+[A-Z][a-z]|$)/)
  const modo_pago = pagoMatch ? pagoMatch[1].trim().toUpperCase() : null

  const clienteMatch = snippet.match(/Cliente:\s*(.+?)(?:\s+[A-Z][a-z]|$)/)
  const cliente = clienteMatch ? clienteMatch[1].trim() : null

  const fecha = isoToLocalDate(dateIso, 'America/Argentina/Buenos_Aires')

  if (!direccion) { result.skip_reason = 'no_direccion_parseable'; return result }
  if (!operacion) { result.skip_reason = 'no_operacion_parseable'; return result }

  if (!unidad) {
    if (isIndirecta && broker && INDIRECTA_BROKER_TO_UNIDAD[broker]) {
      unidad = INDIRECTA_BROKER_TO_UNIDAD[broker]
    } else {
      result.skip_reason = isIndirecta
        ? `indirecta_sin_mapping_para_broker:${broker || 'desconocido'}`
        : `codigo_desconocido:${propertyCode}`
      return result
    }
  }

  if (!VALID_UNIDADES.has(unidad)) {
    result.skip_reason = `unidad_invalida:${unidad}`
    return result
  }

  result.ok = true
  result.payload = {
    fecha, direccion, broker, cliente,
    operacion, unidad,
    monto_ars, monto_usd, modo_pago,
    firmo: 'PENDIENTE',
  }
  result.debug = { propertyCode, isIndirecta }
  return result
}

function isoToLocalDate(iso: string, tz: string): string {
  const d = new Date(iso)
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  })
  return fmt.format(d)
}
