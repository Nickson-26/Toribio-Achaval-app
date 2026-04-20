'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Modal, toast } from '@/components/ui'

export function CambiarPasswordModal({ onClose }: { onClose: () => void }) {
  const [current,  setCurrent]  = useState('')
  const [nueva,    setNueva]    = useState('')
  const [confirma, setConfirma] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  async function handleSave() {
    setError('')
    if (nueva.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (nueva !== confirma) { setError('Las contraseñas no coinciden'); return }

    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: nueva })
      if (error) throw error
      toast('✓ Contraseña actualizada correctamente')
      onClose()
    } catch (e: any) {
      setError(e.message || 'Error al cambiar la contraseña')
    } finally { setSaving(false) }
  }

  return (
    <Modal
      title="Cambiar contraseña"
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Cambiar contraseña'}
        </button>
      </>}
    >
      <div className="form-grid">
        <div className="form-group full">
          <label>Nueva contraseña</label>
          <input
            type="password"
            placeholder="Mínimo 6 caracteres"
            value={nueva}
            onChange={e => setNueva(e.target.value)}
            minLength={6}
          />
        </div>
        <div className="form-group full">
          <label>Confirmar nueva contraseña</label>
          <input
            type="password"
            placeholder="Repetí la contraseña"
            value={confirma}
            onChange={e => setConfirma(e.target.value)}
          />
        </div>
        {error && (
          <div className="form-group full">
            <div className="auth-error">{error}</div>
          </div>
        )}
        <div className="form-group full" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Tu sesión actual no se verá afectada. El cambio se aplica inmediatamente.
          </p>
        </div>
      </div>
    </Modal>
  )
}
