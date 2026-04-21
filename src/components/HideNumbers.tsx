'use client'
import { createContext, useContext, useState } from 'react'

type HideCtx = { hidden: boolean; toggle: () => void }
const Ctx = createContext<HideCtx>({ hidden: false, toggle: () => {} })

export function HideNumbersProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false)
  return (
    <Ctx.Provider value={{ hidden, toggle: () => setHidden(v => !v) }}>
      {children}
    </Ctx.Provider>
  )
}

export function useHideNumbers() { return useContext(Ctx) }

// Wrap any number/amount with this
export function Num({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { hidden } = useHideNumbers()
  return <span className={`${className}${hidden ? ' num-hidden' : ''}`}>{children}</span>
}
