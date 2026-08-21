'use client'
import { createContext, useContext, useEffect, useState } from 'react'

/**
 * PRIVACIDAD VISUAL DE CIFRAS.
 *
 * Alcance, explícito: es privacidad de PANTALLA — para demos, compartir
 * pantalla o trabajar en un espacio abierto. Los datos igual viajan al
 * cliente; el desenfoque es cosmético.
 *
 * Decisión de producto: las EXPORTACIONES CONSERVAN LOS NÚMEROS REALES.
 * Ni CSV, ni XLS, ni el PDF del informe cambian por este estado. Exportar
 * datos ilegibles no le sirve a nadie.
 *
 * Ahora persiste en localStorage: antes era un useState suelto y el modo se
 * perdía en cada recarga.
 */

const STORAGE_KEY = 'ta-hide-numbers'

type HideCtx = { hidden: boolean; toggle: () => void; setHidden: (v: boolean) => void }
const Ctx = createContext<HideCtx>({ hidden: false, toggle: () => {}, setHidden: () => {} })

export function HideNumbersProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') setHidden(true)
    } catch { /* modo privado o storage bloqueado */ }
  }, [])

  function apply(v: boolean) {
    setHidden(v)
    try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0') } catch { /* noop */ }
  }

  return (
    <Ctx.Provider value={{ hidden, toggle: () => apply(!hidden), setHidden: apply }}>
      {children}
    </Ctx.Provider>
  )
}

export function useHideNumbers() { return useContext(Ctx) }

/**
 * Envuelve cualquier cifra en pantalla.
 *
 *   <Money>{ars(total)}</Money>
 *   <Money mono>{usd(x)}</Money>
 *
 * Es la foundation para extender la cobertura, que hoy sólo alcanza a
 * Dashboard y Reservas. Las pantallas se migran en las Fases 2-6.
 */
export function Money({
  children, className = '', mono = false, as: Tag = 'span',
}: {
  children: React.ReactNode
  className?: string
  /** Números tabulares, para que las columnas no bailen. */
  mono?: boolean
  as?: 'span' | 'div' | 'strong'
}) {
  const { hidden } = useHideNumbers()
  const cls = [
    className,
    mono ? 'text-mono' : '',
    hidden ? 'is-hidden-money' : '',
  ].filter(Boolean).join(' ')

  return (
    <Tag className={cls} aria-hidden={hidden || undefined}>
      {children}
    </Tag>
  )
}

/**
 * Compatibilidad: `Num` era el componente anterior, nunca usado en la app
 * (todas las pantallas aplicaban `num-hidden` a mano). Se mantiene como alias
 * para no romper nada.
 */
export const Num = Money
