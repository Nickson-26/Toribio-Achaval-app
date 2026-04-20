'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Mode = 'login' | 'registro' | 'pendiente'

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [mode,     setMode]     = useState<Mode>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [nombre,   setNombre]   = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  function reset(m: Mode) { setMode(m); setError(''); setEmail(''); setPassword(''); setNombre('') }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.toLowerCase().endsWith('@toribioachaval.com')) {
      setError('Solo se permiten cuentas @toribioachaval.com')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (err: any) {
      setError(err.message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos'
        : err.message || 'Error al iniciar sesión')
    } finally { setLoading(false) }
  }

  async function handleRegistro(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!nombre.trim())  { setError('El nombre es obligatorio'); return }
    if (!email.toLowerCase().endsWith('@toribioachaval.com')) {
      setError('Solo se permiten cuentas @toribioachaval.com'); return
    }
    if (password.length < 6) { setError('La contraseña debe tener mínimo 6 caracteres'); return }

    setLoading(true)
    try {
      // Crear usuario en Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: { data: { nombre: nombre.trim() } }
      })
      if (signUpError) throw signUpError
      if (!data.user) throw new Error('No se pudo crear el usuario')

      // Insertar perfil pendiente (el trigger también lo hace, esto es por si acaso)
      await supabase.from('usuarios').upsert({
        id:       data.user.id,
        email:    email.toLowerCase().trim(),
        nombre:   nombre.trim(),
        role:     'viewer',
        aprobado: false,
      }, { onConflict: 'id', ignoreDuplicates: true })

      // Notificar al admin por email via Edge Function
      await supabase.functions.invoke('notify-admin', {
        body: { nombre: nombre.trim(), email: email.toLowerCase().trim() }
      })

      // Cerrar sesión — no puede entrar hasta ser aprobado
      await supabase.auth.signOut()
      setMode('pendiente')
    } catch (err: any) {
      setError(err.message || 'Error al enviar la solicitud')
    } finally { setLoading(false) }
  }

  if (mode === 'pendiente') return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo" style={{ background: 'var(--success)', fontSize: 20 }}>✓</div>
        <h1 className="auth-title">Solicitud enviada</h1>
        <p className="auth-subtitle">
          Tu solicitud fue enviada. El administrador la revisará y te dará acceso en breve.
          Una vez aprobada podés ingresar con tu email y contraseña.
        </p>
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }}
          onClick={() => reset('login')}>
          Volver al inicio de sesión
        </button>
      </div>
    </div>
  )

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">TA</div>
        <h1 className="auth-title">Toribio Achaval</h1>
        <p className="auth-subtitle">Sistema de Facturación</p>

        <div className="auth-tabs">
          <button className={`auth-tab${mode==='login'?' active':''}`} onClick={() => reset('login')}>
            Iniciar sesión
          </button>
          <button className={`auth-tab${mode==='registro'?' active':''}`} onClick={() => reset('registro')}>
            Solicitar acceso
          </button>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="auth-field">
              <label>Email corporativo</label>
              <input type="email" value={email} placeholder="nombre@toribioachaval.com"
                onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="auth-field">
              <label>Contraseña</label>
              <input type="password" value={password} placeholder="••••••••"
                onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegistro}>
            <div className="auth-field">
              <label>Nombre completo *</label>
              <input type="text" value={nombre} placeholder="Tu nombre y apellido"
                onChange={e => setNombre(e.target.value)} required />
            </div>
            <div className="auth-field">
              <label>Email corporativo *</label>
              <input type="email" value={email} placeholder="nombre@toribioachaval.com"
                onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="auth-field">
              <label>Contraseña *</label>
              <input type="password" value={password} placeholder="Mínimo 6 caracteres"
                onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? 'Enviando solicitud…' : 'Enviar solicitud de acceso'}
            </button>
            <p className="auth-note">
              Un administrador revisará tu solicitud y te notificará cuando tengas acceso.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
