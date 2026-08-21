import { supabase } from './supabase'

/**
 * Wrapper de `fetch` para llamar a las API routes propias.
 *
 * Adjunta el access_token de la sesión de Supabase como Bearer, que es lo que
 * `src/lib/apiAuth.ts` valida del lado del servidor.
 *
 * Usar SIEMPRE esto en lugar de `fetch()` pelado para endpoints de /api/.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  return fetch(input, { ...init, headers })
}

export type ApiError = { error: string; detail?: string }

/**
 * Traduce los errores de la capa de auth a algo que un humano entienda.
 * Evita mostrar códigos crudos al usuario.
 */
export function apiErrorMessage(json: any, fallback = 'Ocurrió un error'): string {
  if (!json) return fallback
  if (json.error === 'unauthorized') return 'Tu sesión expiró. Volvé a iniciar sesión.'
  if (json.error === 'forbidden') return json.detail || 'No tenés permisos para esta acción.'
  if (json.error === 'server_misconfigured') return 'El servidor no está configurado correctamente.'
  if (json.error === 'confirmation_required') return json.detail || 'Falta confirmar la operación.'
  return json.detail || json.error || fallback
}
