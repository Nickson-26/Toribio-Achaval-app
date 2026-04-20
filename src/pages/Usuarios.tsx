'use client'
import { useEffect, useState } from 'react'
import { auth, AppUser, ROLE_LABELS, ROLE_COLORS, UserRole } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Modal, FG, toast, Spinner } from '@/components/ui'
import { fdate } from '@/lib/utils'
import { useAuth } from '@/components/AuthProvider'

const DOMAIN = '@toribioachaval.com'

export default function Usuarios(_: any) {
  const { user: me } = useAuth()
  const [users,   setUsers]   = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState<'invite'|'edit'|null>(null)
  const [sel,     setSel]     = useState<AppUser|null>(null)

  const load = () => {
    setLoading(true)
    auth.getAllUsers().then(u => { setUsers(u); setLoading(false) })
  }
  useEffect(() => { load() }, [])

  async function handleSaveEdit(role: UserRole, aprobado: boolean) {
    if (!sel) return
    await auth.updateUser(sel.id, { role, aprobado })
    toast('✓ Usuario actualizado')
    setModal(null); setSel(null); load()
  }

  async function handleDelete(u: AppUser) {
    if (!confirm(`¿Eliminar a ${u.nombre}? Esta acción no se puede deshacer.`)) return
    await auth.deleteUser(u.id)
    toast(`${u.nombre} eliminado`)
    load()
  }

  const pending  = users.filter(u => !u.aprobado)
  const approved = users.filter(u => u.aprobado)

  return (
    <>
      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => setModal('invite')}>
          + Invitar usuario
        </button>
      </div>

      {/* Pending approval */}
      {pending.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--warn)', marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title" style={{ color: 'var(--warn)' }}>
              ⚠ Pendientes de aprobación ({pending.length})
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nombre</th><th>Email</th><th>Solicitado</th><th></th></tr></thead>
              <tbody>
                {pending.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>{u.nombre}</td>
                    <td className="text-dim">{u.email}</td>
                    <td className="text-dim">{fdate(u.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-primary" onClick={async () => {
                          await auth.updateUser(u.id, { aprobado: true })
                          toast(`✓ ${u.nombre} aprobado`)
                          load()
                        }}>Aprobar</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(u)}>Rechazar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active users */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Usuarios activos ({approved.length})</span>
        </div>
        {loading ? <Spinner /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Desde</th><th></th></tr></thead>
              <tbody>
                {approved.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>
                      {u.nombre}
                      {u.id === me?.id && (
                        <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 10 }}>Vos</span>
                      )}
                    </td>
                    <td className="text-dim">{u.email}</td>
                    <td>
                      <span className={`badge ${ROLE_COLORS[u.role]}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="text-dim">{fdate(u.created_at)}</td>
                    <td>
                      {u.id !== me?.id && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm" onClick={() => { setSel(u); setModal('edit') }}>
                            Editar rol
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(u)}>
                            Eliminar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {approved.length === 0 && (
                  <tr><td colSpan={5} className="empty-row">Sin usuarios activos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role reference */}
      <div className="card">
        <div className="card-header"><span className="card-title">Referencia de roles</span></div>
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {([['admin','Administrador','Acceso total: dashboard, facturas, recibos, gestión de usuarios'],
             ['editor','Editor','Puede crear, editar y eliminar comprobantes y recibos'],
             ['viewer','Solo lectura','Solo puede ver el dashboard y los listados, sin modificar nada']] as [UserRole,string,string][])
            .map(([role, label, desc]) => (
              <div key={role} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span className={`badge ${ROLE_COLORS[role]}`} style={{ marginTop: 2, flexShrink: 0 }}>{label}</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{desc}</span>
              </div>
            ))}
        </div>
      </div>

      {modal === 'invite' && (
        <InviteModal onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />
      )}
      {modal === 'edit' && sel && (
        <EditUserModal user={sel} onClose={() => { setModal(null); setSel(null) }} onSave={handleSaveEdit} />
      )}
    </>
  )
}

// ── Invite modal — admin creates user directly ────────────────
function InviteModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [saving,   setSaving]   = useState(false)
  const [nombre,   setNombre]   = useState('')
  const [emailPre, setEmailPre] = useState('')  // part before @
  const [password, setPassword] = useState('')
  const [role,     setRole]     = useState<UserRole>('editor')
  const [error,    setError]    = useState('')

  const fullEmail = emailPre.trim() + DOMAIN

  async function save() {
    setError('')
    if (!nombre.trim())   { setError('El nombre es obligatorio'); return }
    if (!emailPre.trim()) { setError('El email es obligatorio'); return }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }

    setSaving(true)
    try {
      // Use Supabase admin to create user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: fullEmail,
        password,
      })
      if (signUpError) throw signUpError
      if (!data.user) throw new Error('No se pudo crear el usuario')

      // Insert profile as approved
      const { error: insertError } = await supabase.from('usuarios').insert({
        id: data.user.id,
        email: fullEmail,
        nombre: nombre.trim(),
        role,
        aprobado: true,
      })
      if (insertError) throw insertError

      toast(`✓ Usuario ${nombre} creado`)
      onSaved()
    } catch (e: any) {
      setError(e.message || 'Error al crear el usuario')
    } finally { setSaving(false) }
  }

  return (
    <Modal
      title="Invitar nuevo usuario"
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Creando…' : 'Crear usuario'}
        </button>
      </>}
    >
      <div className="form-grid">
        <FG label="Nombre completo *" full>
          <input
            placeholder="Ej: María García"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
          />
        </FG>
        <FG label="Email *" full>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <input
              placeholder="nombre.apellido"
              value={emailPre}
              onChange={e => setEmailPre(e.target.value.replace('@',''))}
              style={{ borderRadius: 'var(--radius) 0 0 var(--radius)', flex: 1 }}
            />
            <span style={{
              padding: '8px 10px', background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-strong)', borderLeft: 'none',
              borderRadius: '0 var(--radius) var(--radius) 0',
              fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap'
            }}>
              @toribioachaval.com
            </span>
          </div>
        </FG>
        <FG label="Contraseña inicial *" full>
          <input
            type="password"
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={e => setPassword(e.target.value)}
            minLength={6}
          />
          <span className="calc-hint">El usuario podrá cambiarla desde su cuenta</span>
        </FG>
        <FG label="Rol" full>
          <select value={role} onChange={e => setRole(e.target.value as UserRole)}>
            <option value="editor">Editor — puede cargar y editar</option>
            <option value="viewer">Solo lectura — solo puede ver</option>
            <option value="admin">Administrador — acceso total</option>
          </select>
        </FG>

        {error && (
          <div className="form-group full">
            <div className="auth-error">{error}</div>
          </div>
        )}

        <div className="form-group full" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            El usuario se crea directamente con acceso aprobado. Compartile el email y la contraseña para que ingrese a la app.
          </p>
        </div>
      </div>
    </Modal>
  )
}

// ── Edit role modal ───────────────────────────────────────────
function EditUserModal({
  user, onClose, onSave
}: {
  user: AppUser
  onClose: () => void
  onSave: (role: UserRole, aprobado: boolean) => void
}) {
  const [role,     setRole]     = useState<UserRole>(user.role)
  const [aprobado, setAprobado] = useState(user.aprobado)

  return (
    <Modal
      title={`Editar — ${user.nombre}`}
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onSave(role, aprobado)}>Guardar</button>
      </>}
    >
      <div className="form-grid">
        <FG label="Nombre" full>
          <input readOnly value={user.nombre} style={{ color: 'var(--text-tertiary)', cursor: 'default' }} />
        </FG>
        <FG label="Email" full>
          <input readOnly value={user.email} style={{ color: 'var(--text-tertiary)', cursor: 'default' }} />
        </FG>
        <FG label="Rol">
          <select value={role} onChange={e => setRole(e.target.value as UserRole)}>
            <option value="admin">Administrador</option>
            <option value="editor">Editor</option>
            <option value="viewer">Solo lectura</option>
          </select>
        </FG>
        <FG label="Estado">
          <select value={aprobado ? '1' : '0'} onChange={e => setAprobado(e.target.value === '1')}>
            <option value="1">Activo</option>
            <option value="0">Suspendido</option>
          </select>
        </FG>
      </div>
    </Modal>
  )
}
