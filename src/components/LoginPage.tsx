'use client'
import { useState } from 'react'
import { auth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

type Mode = 'login' | 'solicitar' | 'enviado'

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [mode,     setMode]     = useState<Mode>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [nombre,   setNombre]   = useState('')
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

  async function handleSolicitar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (!email.endsWith('@toribioachaval.com')) {
      setError('Solo se permiten cuentas @toribioachaval.com'); return
    }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }

    setLoading(true)
    try {
      // Step 1: create auth user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: undefined }
      })
      if (signUpError) throw new Error('Error al crear cuenta: ' + signUpError.message)
      if (!data.user) throw new Error('No se recibió respuesta del servidor')

      // Step 2: insert profile
      const { error: insertError } = await supabase.from('usuarios').insert({
        id:       data.user.id,
        email:    email.trim(),
        nombre:   nombre.trim(),
        role:     'viewer',
        aprobado: false,
      })
      if (insertError) throw new Error('Error al guardar perfil: ' + insertError.message)

      setMode('enviado')
    } catch (err: any) {
      setError(err.message || 'Error desconocido')
    } finally { setLoading(false) }
  }

  if (mode === 'enviado') return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">TA</div>
        <h1 className="auth-title">Solicitud enviada</h1>
        <p className="auth-subtitle">
          Tu solicitud fue enviada. El administrador te dará acceso en breve.
        </p>
        <button className="btn btn-primary" style={{ width:'100%', marginTop:16 }}
          onClick={() => { setMode('login'); setEmail(''); setPassword(''); setNombre('') }}>
          Volver al inicio
        </button>
      </div>
    </div>
  )

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">TA</div>
        <h1 className="auth-title">Toribio Achaval</h1>
        <p className="auth-subtitle">Sistema de Facturación — Acceso interno</p>

        <div className="auth-tabs">
          <button className={`auth-tab${mode==='login'?' active':''}`}
            onClick={() => { setMode('login'); setError('') }}>
            Iniciar sesión
          </button>
          <button className={`auth-tab${mode==='solicitar'?' active':''}`}
            onClick={() => { setMode('solicitar'); setError('') }}>
            Solicitar acceso
          </button>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="auth-field">
              <label>Email corporativo</label>
              <input type="email" placeholder="nombre@toribioachaval.com"
                value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email" />
            </div>
            <div className="auth-field">
              <label>Contraseña</label>
              <input type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                required autoComplete="current-password" />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSolicitar}>
            <div className="auth-field">
              <label>Nombre completo</label>
              <input type="text" placeholder="Tu nombre y apellido"
                value={nombre} onChange={e => setNombre(e.target.value)} required />
            </div>
            <div className="auth-field">
              <label>Email corporativo</label>
              <input type="email" placeholder="nombre@toribioachaval.com"
                value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email" />
            </div>
            <div className="auth-field">
              <label>Contraseña</label>
              <input type="password" placeholder="Mínimo 6 caracteres"
                value={password} onChange={e => setPassword(e.target.value)}
                required minLength={6} />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? 'Enviando…' : 'Solicitar acceso'}
            </button>
            <p className="auth-note">
              El administrador revisará tu solicitud antes de darte acceso.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
