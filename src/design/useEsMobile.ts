'use client'
import { useEffect, useState } from 'react'

/**
 * ¿Estamos en el rango táctil?
 *
 * Existe porque hay composiciones que no alcanza con esconder por CSS. En
 * Facturación, tabla y tarjetas muestran los mismos comprobantes: dejarlas
 * montadas a las dos y tapar una con `display:none` significa construir
 * doscientas filas invisibles en cada render, y encima confunde a cualquier
 * cosa que recorra el DOM —tests, lectores de pantalla, Ctrl+F—.
 *
 * Con esto se monta sólo la que corresponde.
 *
 * El corte es 1023px, el mismo de `.ta-only-desktop` / `.ta-only-mobile` en
 * shell.css. Si cambia uno tiene que cambiar el otro.
 *
 * Arranca en `false` para que el servidor y el primer render del cliente
 * coincidan; el efecto corrige inmediatamente después. Un mismatch de
 * hidratación acá sería un parpadeo de la tabla en un teléfono.
 */
const CONSULTA = '(max-width: 1023px)'

export function useEsMobile(): boolean {
  const [esMobile, setEsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(CONSULTA)
    const aplicar = () => setEsMobile(mq.matches)
    aplicar()
    mq.addEventListener('change', aplicar)
    return () => mq.removeEventListener('change', aplicar)
  }, [])

  return esMobile
}
