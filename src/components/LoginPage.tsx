'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Mode = 'login' | 'registro' | 'verificar'

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [mode,     setMode]     = useState<Mode>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [nombre,   setNombre]   = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  function reset(m: Mode) { setMode(m); setError(''); setEmail(''); setPassword(''); setNombre('') }

  // ── LOGIN ──────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.toLowerCase().endsWith('@toribioachaval.com')) {
      setError('Solo se permiten cuentas @toribioachaval.com')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      // Si el email está confirmado pero no tiene perfil todavía, lo creamos
      if (data.user && data.user.email_confirmed_at) {
        const { data: profile } = await supabase
          .from('usuarios').select('id').eq('id', data.user.id).single()
        
        if (!profile) {
          // Crear perfil pendiente de aprobación
          await supabase.from('usuarios').insert({
            id:       data.user.id,
            email:    data.user.email,
            nombre:   data.user.user_metadata?.nombre || email.split('@')[0],
            role:     'viewer',
            aprobado: false,
          })
          // Notificar admin
          await supabase.functions.invoke('notify-admin', {
            body: { 
              nombre: data.user.user_metadata?.nombre || email.split('@')[0], 
              email: data.user.email 
            }
          }).catch(() => {})
          // Sign out — espera aprobación
          await supabase.auth.signOut()
          setError('Tu email fue verificado. Tu solicitud está pendiente de aprobación por el administrador.')
          return
        }
      }
    } catch (err: any) {
      setError(err.message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos'
        : err.message || 'Error al iniciar sesión')
    } finally { setLoading(false) }
  }

  // ── REGISTRO ───────────────────────────────────────────────
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
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: { nombre: nombre.trim() },
          // Redirect after email confirmation
          emailRedirectTo: `${window.location.origin}`,
        }
      })
      if (error) throw error
      if (!data.user) throw new Error('No se pudo crear la cuenta')

      // Sign out immediately — user needs to verify email first
      await supabase.auth.signOut()
      setMode('verificar')
    } catch (err: any) {
      setError(err.message || 'Error al enviar la solicitud')
    } finally { setLoading(false) }
  }

  // ── PANTALLA VERIFICAR ─────────────────────────────────────
  if (mode === 'verificar') return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo" style={{ fontSize: 20 }}>📧</div>
        <h1 className="auth-title">Verificá tu email</h1>
        <p className="auth-subtitle">
          Te enviamos un email a <strong>{email}</strong>.<br/><br/>
          Hacé click en el link de verificación. Una vez verificado tu email, 
          el administrador recibirá tu solicitud de acceso y podrá aprobarte.
        </p>
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }}
          onClick={() => reset('login')}>
          Ya verifiqué mi email — ir al inicio
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
              {loading ? 'Enviando…' : 'Solicitar acceso'}
            </button>
            <p className="auth-note">
              Te enviaremos un email para verificar tu cuenta. 
              El administrador recibirá tu solicitud una vez verificada.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
