'use client'
import { Menu, Eye, EyeOff, Moon, Sun, Accessibility, Plus } from 'lucide-react'
import { useHideNumbers } from '@/components/HideNumbers'
import { useNavigation } from '@/components/NavigationProvider'
import { RUTAS } from '@/lib/navigation'
import { IconButton, Button } from '@/design/primitives'
import { usePermisos } from '@/design/usePermisos'

export type Theme = 'dark' | 'light' | 'accessible'

/**
 * Topbar.
 *
 * Deliberadamente mínima. En escritorio: contexto de página, privacidad de
 * cifras, temas y la acción primaria.
 *
 * En mobile es OTRA composición, no la de escritorio comprimida:
 *   · el selector de tema desaparece de acá y vive en el menú de usuario —
 *     tres botones permanentes no justifican su espacio en 390px;
 *   · el CTA pasa a icono, sin texto;
 *   · quedan burger · título · ojo · [+], que entran cómodos.
 */
export function Topbar({
  theme, onTheme, onOpenDrawer,
}: {
  theme: Theme
  onTheme: (t: Theme) => void
  onOpenDrawer: () => void
}) {
  const { hidden, toggle } = useHideNumbers()
  const { route, navigate } = useNavigation()
  const { puedeHacer } = usePermisos()

  const titulo = RUTAS[route.to]?.titulo ?? ''
  const puedeCrear = puedeHacer('comprobante.crear')

  return (
    <header className="ta-topbar">
      <IconButton
        icon={Menu} label="Abrir menú" onClick={onOpenDrawer}
        className="ta-topbar__burger"
      />

      <h1 className="ta-topbar__title">{titulo}</h1>

      <div className="ta-topbar__actions">
        <IconButton
          icon={hidden ? EyeOff : Eye}
          label={hidden ? 'Mostrar cifras' : 'Ocultar cifras'}
          active={hidden}
          onClick={toggle}
        />

        {/* Sólo escritorio: en mobile el tema vive en el menú de usuario. */}
        <ThemeGroup theme={theme} onTheme={onTheme} className="ta-only-desktop" />

        {puedeCrear && (
          <>
            <Button
              variant="primary" size="sm" icon={Plus}
              className="ta-only-desktop"
              onClick={() => navigate({ to: 'facturas' })}
            >
              Nueva factura
            </Button>
            {/* Mismo destino, sin texto: en 390px el CTA completo empujaba
                el título contra el ojo. */}
            <button
              className="ta-btn ta-btn--primary ta-topbar__cta-icon"
              aria-label="Nueva factura"
              title="Nueva factura"
              onClick={() => navigate({ to: 'facturas' })}
            >
              <Plus size={18} aria-hidden />
            </button>
          </>
        )}
      </div>
    </header>
  )
}

/**
 * Selector de tema. Se monta en la topbar (escritorio) y en el menú de
 * usuario (donde es el único acceso en mobile).
 */
export function ThemeGroup({
  theme, onTheme, className = '',
}: { theme: Theme; onTheme: (t: Theme) => void; className?: string }) {
  return (
    <div className={`ta-theme-group ${className}`} role="group" aria-label="Tema de la interfaz">
      <IconButton icon={Sun}           label="Tema claro"     active={theme === 'light'}      onClick={() => onTheme('light')} size={15} />
      <IconButton icon={Moon}          label="Tema oscuro"    active={theme === 'dark'}       onClick={() => onTheme('dark')} size={15} />
      <IconButton icon={Accessibility} label="Alto contraste" active={theme === 'accessible'} onClick={() => onTheme('accessible')} size={15} />
    </div>
  )
}
