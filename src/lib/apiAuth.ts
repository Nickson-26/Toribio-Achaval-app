import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Autenticación y autorización SERVER-SIDE para los route handlers.
 *
 * Regla del proyecto: ninguna API route que lea o escriba datos reales puede
 * quedar abierta. Ocultar botones en el frontend NO es un control de acceso.
 *
 * Dos tipos de llamador:
 *   1. Usuario  → manda `Authorization: Bearer <supabase access_token>`.
 *                 Se valida el JWT contra Supabase y se lee su perfil de
 *                 `usuarios` para chequear `aprobado` y `role`.
 *   2. Máquina  → cron de Vercel o job interno. Manda un secreto compartido.
 *
 * Uso:
 *   const actor = await requireUser(req, { roles: ['admin'] })
 *   if (isDenied(actor)) return actor
 *   // acá `actor` ya es un ApiActor tipado
 */

export type ApiRole = 'admin' | 'editor' | 'viewer'

export type ApiActor = {
  kind: 'user'
  id: string
  email: string
  nombre: string
  role: ApiRole
} | {
  kind: 'machine'
  secretName: string
}

/** Type guard: distingue una denegación (NextResponse) de un actor válido. */
export function isDenied(x: ApiActor | NextResponse): x is NextResponse {
  return x instanceof NextResponse
}

function deny(status: number, error: string, detail?: string) {
  return NextResponse.json(detail ? { error, detail } : { error }, { status })
}

function bearer(req: NextRequest): string | null {
  const raw = req.headers.get('authorization') || ''
  if (!raw.toLowerCase().startsWith('bearer ')) return null
  const token = raw.slice(7).trim()
  return token || null
}

/**
 * Comparación en tiempo constante. Evita filtrar el secreto por timing.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export type RequireOpts = {
  /** Roles permitidos. Si se omite, alcanza con estar autenticado y aprobado. */
  roles?: ApiRole[]
  /**
   * Nombres de env vars cuyos valores se aceptan como secreto de máquina.
   * Permite que el cron llame al mismo endpoint sin sesión de usuario.
   */
  allowSecrets?: string[]
}

/**
 * Punto de entrada único. Devuelve un ApiActor o un NextResponse de error.
 * Siempre chequear con `isDenied()` antes de usar el resultado.
 */
export async function requireUser(
  req: NextRequest,
  opts: RequireOpts = {}
): Promise<ApiActor | NextResponse> {
  const token = bearer(req)
  if (!token) return deny(401, 'unauthorized', 'Falta el header Authorization: Bearer <token>')

  // ── 1. ¿Es un secreto de máquina? ────────────────────────────
  for (const name of opts.allowSecrets ?? []) {
    const expected = process.env[name]
    if (expected && safeEqual(token, expected)) {
      return { kind: 'machine', secretName: name }
    }
  }

  // ── 2. Si no, tiene que ser un JWT de usuario ────────────────
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon) {
    return deny(500, 'server_misconfigured', 'Faltan NEXT_PUBLIC_SUPABASE_URL / ANON_KEY')
  }

  const sb = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userErr } = await sb.auth.getUser(token)
  if (userErr || !userData?.user) {
    return deny(401, 'unauthorized', 'Token inválido o expirado')
  }

  // El perfil se lee con service-role para no depender de las políticas RLS
  // de `usuarios` (que históricamente tuvieron problemas de recursión).
  // Si no hay service key, se cae al cliente anon con el token del usuario,
  // que puede leer su propia fila vía la policy `self_read`.
  const reader = service
    ? createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
    : createClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      })

  const { data: perfil, error: perfilErr } = await reader
    .from('usuarios')
    .select('id,email,nombre,role,aprobado')
    .eq('id', userData.user.id)
    .single()

  if (perfilErr || !perfil) {
    return deny(403, 'forbidden', 'El usuario no tiene perfil en la aplicación')
  }
  if (!perfil.aprobado) {
    return deny(403, 'forbidden', 'La cuenta está pendiente de aprobación')
  }

  const role = (perfil.role ?? 'viewer') as ApiRole

  if (opts.roles && !opts.roles.includes(role)) {
    return deny(
      403,
      'forbidden',
      `Esta operación requiere rol: ${opts.roles.join(' o ')}. Tu rol es: ${role}`
    )
  }

  return {
    kind: 'user',
    id: perfil.id,
    email: perfil.email,
    nombre: perfil.nombre ?? perfil.email,
    role,
  }
}

/** Etiqueta legible del actor, para logs y respuestas. */
export function actorLabel(actor: ApiActor): string {
  return actor.kind === 'machine' ? `machine:${actor.secretName}` : `${actor.email} (${actor.role})`
}
