'use client'
import { useState } from 'react'
import { auth } from '@/lib/auth'

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!email.endsWith('@toribioachaval.com')) {
      setError('Solo se permiten cuentas @toribioachaval.com')
      return
    }

    setLoading(true)
    try {
      await auth.signIn(email, password)
      onLogin()
    } catch (err: any) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Email o contraseña incorrectos'
          : err.message || 'Error al iniciar sesión'
      )
    } finally { setLoading(false) }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">TA</div>
        <h1 className="auth-title">Toribio Achaval</h1>
        <p className="auth-subtitle">Sistema de Facturación — Acceso interno</p>

        <form onSubmit={handleLogin}>
          <div className="auth-field">
            <label>Email corporativo</label>
            <input
              type="email"
              placeholder="nombre@toribioachaval.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="auth-field">
            <label>Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="auth-note">
          ¿No tenés acceso? Contactá al administrador del sistema.
        </p>
      </div>
    </div>
  )
}
