'use client'
import { tipoColor, estadoColor } from '@/lib/utils'
import { useEffect, useState } from 'react'

export function TipoBadge({ tipo }: { tipo: string }) {
  return <span className={`badge badge-${tipoColor(tipo).replace('badge-', '')}`}>{tipo}</span>
}

export function EstadoBadge({ estado }: { estado: string }) {
  return <span className={`badge badge-${estadoColor(estado).replace('badge-', '')}`}>{estado}</span>
}

export function Spinner() {
  return <div className="loading-overlay"><div className="spinner" /></div>
}

// ── Toast ──────────────────────────────────────────────────────────────────
let toastFn: ((msg: string) => void) | null = null

export function ToastProvider() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { toastFn = setMsg }, [])
  useEffect(() => {
    if (msg) { const t = setTimeout(() => setMsg(null), 2800); return () => clearTimeout(t) }
  }, [msg])
  if (!msg) return null
  return <div className="toast">{msg}</div>
}

export function toast(msg: string) { toastFn?.(msg) }

// ── Modal wrapper ──────────────────────────────────────────────────────────
export function Modal({
  title, subtitle, onClose, footer, children
}: {
  title: string; subtitle?: React.ReactNode
  onClose: () => void; footer: React.ReactNode; children: React.ReactNode
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        {children}
        <div className="modal-footer">{footer}</div>
      </div>
    </div>
  )
}

// ── FormGroup ──────────────────────────────────────────────────────────────
export function FG({
  label, children, full
}: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`form-group${full ? ' full' : ''}`}>
      <label>{label}</label>
      {children}
    </div>
  )
}
