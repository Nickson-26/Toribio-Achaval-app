'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import LoginPage from '@/components/LoginPage'
import { NavigationProvider } from '@/components/NavigationProvider'
import { AppShell } from '@/components/shell/AppShell'
import type { Theme } from '@/components/shell/Topbar'
import { Button } from '@/design/primitives'

/**
 * Punto de entrada. Sólo tres responsabilidades:
 *   1. gates de autenticación,
 *   2. tema,
 *   3. montar el shell.
 *
 * Todo lo demás vive en AppShell / Sidebar / Topbar.
 */
export default function Home() {
  const { user, loading, signOut } = useAuth()
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const html = document.documentElement
    if (theme === 'dark') html.removeAttribute('data-theme')
    else html.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    // El script de layout.tsx ya aplicó el atributo antes de pintar; acá sólo
    // se sincroniza el estado de React con lo que ya está en el DOM.
    try {
      const saved = localStorage.getItem('ta-theme') as Theme | null
      if (saved) setTheme(saved)
    } catch { /* noop */ }
  }, [])

  function applyTheme(t: Theme) {
    setTheme(t)
    try { localStorage.setItem('ta-theme', t) } catch { /* noop */ }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-app)',
      }}>
        <span className="ta-spinner" role="status" aria-label="Cargando" />
      </div>
    )
  }

  if (!user) return <LoginPage onLogin={() => {}} />

  if (!user.aprobado) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-logo">TA</div>
          <h1 className="auth-title">Cuenta pendiente</h1>
          <p className="auth-subtitle">
            Tu cuenta está esperando la aprobación de un administrador.
          </p>
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Button variant="secondary" onClick={signOut} style={{ width: '100%' }}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <NavigationProvider>
      <AppShell theme={theme} onTheme={applyTheme} />
    </NavigationProvider>
  )
}
