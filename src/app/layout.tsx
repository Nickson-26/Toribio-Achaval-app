import type { Metadata } from 'next'
import './globals.css'
// Se importa DESPUÉS de globals.css a propósito: la capa de tokens completa y
// corrige los valores de los tres temas, y necesita ganar la cascada.
import '../design/tokens.css'
import '../design/components.css'
import '../design/shell.css'
import '../design/home.css'
import '../design/modulos.css'
import { AuthProvider } from '@/components/AuthProvider'
import { HideNumbersProvider } from '@/components/HideNumbers'

export const metadata: Metadata = {
  title: 'Toribio Achaval — Gestión interna',
  description: 'Sistema de gestión interna de Toribio Achaval',
}

/**
 * Evita el flash de tema incorrecto.
 *
 * El tema se guarda en localStorage pero se leía en un useEffect posterior al
 * primer render, así que un usuario con tema claro veía un destello oscuro en
 * cada carga. Este script corre antes de pintar.
 */
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('ta-theme');
    if (t && t !== 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AuthProvider>
          <HideNumbersProvider>
            {children}
          </HideNumbersProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
