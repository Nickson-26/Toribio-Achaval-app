'use client'
import { Menu, Eye, EyeOff, Moon, Sun, Accessibility, Plus } from 'lucide-react'
import { useHideNumbers } from '@/components/HideNumbers'
import { useNavigation } from '@/components/NavigationProvider'
import { RUTAS } from '@/lib/navigation'
import { IconButton, Button } from '@/design/primitives'
import { usePermisos } from '@/design/usePermisos'

export type Theme = 'dark' | 'light' | 'accessible'

/**
 * Topbar deliberadamente mínima: contexto de página, privacidad de cifras,
 * temas, y la acción primaria. Sin elementos decorativos.
 *
 * La búsqueda global NO se implementa en esta fase (§54 del brief): el
 * espacio queda reservado y cada pantalla mantiene su propio buscador.
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

        <div className="ta-theme-group" role="group" aria-label="Tema de la interfaz">
          <IconButton icon={Sun}           label="Tema claro"    active={theme === 'light'}      onClick={() => onTheme('light')} size={15} />
          <IconButton icon={Moon}          label="Tema oscuro"   active={theme === 'dark'}       onClick={() => onTheme('dark')} size={15} />
          <IconButton icon={Accessibility} label="Alto contraste" active={theme === 'accessible'} onClick={() => onTheme('accessible')} size={15} />
        </div>

        {/* Acción primaria, sólo si el rol puede ejecutarla. Un viewer ya no
            ve un CTA que RLS le va a rechazar. */}
        {puedeHacer('comprobante.crear') && (
          <Button
            variant="primary" size="sm" icon={Plus}
            onClick={() => navigate({ to: 'facturas' })}
          >
            Nueva factura
          </Button>
        )}
      </div>
    </header>
  )
}
