'use client'
import { useEffect, useState } from 'react'
import { ToastProvider } from '@/components/ui'
import { useAuth } from '@/components/AuthProvider'
import LoginPage from '@/components/LoginPage'
import { CambiarPasswordModal } from '@/components/CambiarPassword'
import { NavigationProvider, useNavigation } from '@/components/NavigationProvider'
import { TopNav, type Theme } from '@/components/shell/TopNav'
import { SCREENS } from '@/lib/screens'

/**
 * Punto de entrada de la aplicación.
 *
 * Antes: 252 líneas que eran shell + navegación + router + theme + menú de
 * usuario + switcher de módulos, con la navegación duplicada en cinco listas.
 *
 * Ahora sólo hace tres cosas:
 *   1. los gates de autenticación,
 *   2. el theme,
 *   3. montar el shell y resolver la pantalla del destino actual.
 *
 * La navegación vive en `lib/navigation.ts` + `NavigationProvider`.
 * El mapa destino → componente, en `lib/screens.tsx`.
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
    const saved = localStorage.getItem('ta-theme') as Theme | null
    if (saved) setTheme(saved)
  }, [])

  function applyTheme(t: Theme) {
    setTheme(t)
    localStorage.setItem('ta-theme', t)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-base)' }}>
        <div className="spinner" />
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
          <p className="auth-subtitle">Tu cuenta está esperando aprobación del administrador.</p>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={signOut}>
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <NavigationProvider>
      <Workspace theme={theme} onTheme={applyTheme} />
    </NavigationProvider>
  )
}

/**
 * Va dentro del NavigationProvider para poder leer el destino actual.
 */
function Workspace({ theme, onTheme }: { theme: Theme; onTheme: (t: Theme) => void }) {
  const { route } = useNavigation()
  const [pendientes, setPendientes] = useState(0)
  const [showPassword, setShowPassword] = useState(false)

  const Screen = SCREENS[route.to]

  return (
    <div className="app-shell">
      <TopNav
        theme={theme}
        onTheme={onTheme}
        pendientes={pendientes}
        onCambiarPassword={() => setShowPassword(true)}
      />

      <main className="main-content">
        {/* `key` fuerza el remontaje al cambiar de destino: evita que una
            pantalla arrastre estado de la anterior. */}
        <Screen key={route.to} onPendientesChange={setPendientes} />
      </main>

      {showPassword && <CambiarPasswordModal onClose={() => setShowPassword(false)} />}
      <ToastProvider />
    </div>
  )
}
