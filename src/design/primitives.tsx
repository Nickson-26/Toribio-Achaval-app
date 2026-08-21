'use client'
import {
  forwardRef, useEffect, useId, useRef, useState, useCallback,
  type ButtonHTMLAttributes, type InputHTMLAttributes,
  type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode,
} from 'react'
import {
  X, Search, Check, Info, TriangleAlert, CircleX, Inbox, RotateCcw,
  type LucideIcon,
} from 'lucide-react'
import { estadoDef, tipoTone, type Tone } from './status'

/**
 * PRIMITIVOS DEL DESIGN SYSTEM
 *
 * Todo consume tokens: cero colores hardcodeados.
 * Las clases van prefijadas con `ta-` para convivir con las 158 clases del
 * sistema anterior mientras se migra pantalla por pantalla.
 */

const cx = (...v: (string | false | null | undefined)[]) => v.filter(Boolean).join(' ')

/* ══════════════════════════════════════════════════════════════════════════
   BOTONES
   ══════════════════════════════════════════════════════════════════════════ */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export const Button = forwardRef<HTMLButtonElement, {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: LucideIcon
  iconRight?: LucideIcon
  children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>>(function Button(
  { variant = 'secondary', size = 'md', loading, icon: Icon, iconRight: IconR,
    children, className, disabled, ...rest }, ref
) {
  return (
    <button
      ref={ref}
      className={cx('ta-btn', `ta-btn--${variant}`, size !== 'md' && `ta-btn--${size}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="ta-btn__spinner" aria-hidden /> : Icon && <Icon size={15} aria-hidden />}
      {children}
      {IconR && !loading && <IconR size={15} aria-hidden />}
    </button>
  )
})

export const IconButton = forwardRef<HTMLButtonElement, {
  icon: LucideIcon
  /** Obligatorio: sin texto visible, el lector de pantalla necesita esto. */
  label: string
  active?: boolean
  size?: number
} & ButtonHTMLAttributes<HTMLButtonElement>>(function IconButton(
  { icon: Icon, label, active, size = 17, className, ...rest }, ref
) {
  return (
    <button
      ref={ref}
      className={cx('ta-btn', 'ta-btn--icon', active && 'is-active', className)}
      aria-label={label} title={label} aria-pressed={active}
      {...rest}
    >
      <Icon size={size} aria-hidden />
    </button>
  )
})

/* ══════════════════════════════════════════════════════════════════════════
   CAMPOS
   ══════════════════════════════════════════════════════════════════════════ */
export function Field({
  label, required, hint, error, full, htmlFor, children,
}: {
  label?: string; required?: boolean; hint?: ReactNode; error?: string
  full?: boolean; htmlFor?: string; children: ReactNode
}) {
  return (
    <div className={cx('ta-field', full && 'ta-field--full')}>
      {label && (
        <label className="ta-label" htmlFor={htmlFor}>
          {label}{required && <span className="ta-label__req" aria-hidden>*</span>}
        </label>
      )}
      {children}
      {error ? <span className="ta-error" role="alert">{error}</span>
             : hint ? <span className="ta-hint">{hint}</span> : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, {
  invalid?: boolean
  /** Alinea a la derecha con números tabulares. */
  numeric?: boolean
} & InputHTMLAttributes<HTMLInputElement>>(function Input(
  { invalid, numeric, className, ...rest }, ref
) {
  return (
    <input
      ref={ref}
      className={cx('ta-input', invalid && 'ta-input--error', numeric && 'ta-input--num', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
})

export const Select = forwardRef<HTMLSelectElement, {
  invalid?: boolean
} & SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { invalid, className, children, ...rest }, ref
) {
  // Envuelve el <select> nativo a propósito: mismo comportamiento, teclado y
  // accesibilidad que ya funcionaban. Sólo cambia la piel.
  return (
    <select
      ref={ref}
      className={cx('ta-select', invalid && 'ta-select--error', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    >{children}</select>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cx('ta-textarea', className)} {...rest} />
  }
)

export function SearchInput({
  value, onChange, placeholder = 'Buscar…', autoFocus, className, ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
  ariaLabel?: string
}) {
  return (
    <div className={cx('ta-search', className)}>
      <span className="ta-search__icon"><Search size={15} aria-hidden /></span>
      <input
        className="ta-input" type="search" role="searchbox"
        value={value} placeholder={placeholder} autoFocus={autoFocus}
        aria-label={ariaLabel || placeholder}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <button type="button" className="ta-search__clear" onClick={() => onChange('')} aria-label="Limpiar búsqueda">
          <X size={13} aria-hidden />
        </button>
      )}
    </div>
  )
}

export function Checkbox({
  checked, onChange, label, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <label className="ta-check">
      <input type="checkbox" checked={checked} disabled={disabled}
             onChange={e => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   SUPERFICIES
   ══════════════════════════════════════════════════════════════════════════ */
export function Card({
  children, className, flat, muted, as: Tag = 'div',
}: { children: ReactNode; className?: string; flat?: boolean; muted?: boolean; as?: 'div' | 'section' }) {
  return (
    <Tag className={cx('ta-card', flat && 'ta-card--flat', muted && 'ta-card--muted', className)}>
      {children}
    </Tag>
  )
}

export function CardHeader({ title, hint, action }: { title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="ta-card__header">
      <div>
        <div className="ta-card__title">{title}</div>
        {hint && <div className="ta-card__hint">{hint}</div>}
      </div>
      {action}
    </div>
  )
}

export function CardBody({ children, tight, className }: { children: ReactNode; tight?: boolean; className?: string }) {
  return <div className={cx('ta-card__body', tight && 'ta-card__body--tight', className)}>{children}</div>
}

export function MetricCard({
  label, value, sub, accent, className,
}: { label: string; value: ReactNode; sub?: ReactNode; accent?: boolean; className?: string }) {
  return (
    <div className={cx('ta-card', 'ta-metric', accent && 'ta-metric--accent', className)}>
      <div className="ta-metric__label">{label}</div>
      <div className="ta-metric__value">{value}</div>
      {sub && <div className="ta-metric__sub">{sub}</div>}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   BADGES
   ══════════════════════════════════════════════════════════════════════════ */
export function Badge({
  tone = 'neutral', children, sm, icon: Icon, title,
}: { tone?: Tone; children: ReactNode; sm?: boolean; icon?: LucideIcon; title?: string }) {
  return (
    <span className={cx('ta-badge', `ta-badge--${tone}`, sm && 'ta-badge--sm')} title={title}>
      {Icon && <Icon aria-hidden />}
      {children}
    </span>
  )
}

/**
 * Estado de un comprobante. Traduce el valor de la base a texto humano.
 * NUNCA muestra snake_case.
 */
export function StatusBadge({ estado, sm, withHint }: { estado: string | null | undefined; sm?: boolean; withHint?: boolean }) {
  const def = estadoDef(estado)
  return (
    <Badge tone={def.tone} sm={sm} title={withHint ? def.hint : undefined}>
      {def.label}
    </Badge>
  )
}

export function TipoBadge({ tipo, sm }: { tipo: string; sm?: boolean }) {
  return <Badge tone={tipoTone(tipo)} sm={sm}>{tipo}</Badge>
}

/* ══════════════════════════════════════════════════════════════════════════
   MODAL
   ══════════════════════════════════════════════════════════════════════════ */
/** Escape + bloqueo de scroll + foco inicial. Compartido por Modal y Drawer. */
function useDismissable(onClose: () => void, panelRef: React.RefObject<HTMLElement>) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => {
      const el = panelRef.current
      if (!el) return
      const focusable = el.querySelector<HTMLElement>(
        'input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
      )
      focusable?.focus()
    }, 40)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      clearTimeout(t)
    }
  }, [onClose, panelRef])
}

export function Modal({
  title, subtitle, onClose, footer, children, size = 'md',
}: {
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useDismissable(onClose, ref)

  return (
    <div className="ta-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div
        ref={ref}
        className={cx('ta-modal', size !== 'md' && `ta-modal--${size}`)}
        role="dialog" aria-modal="true" aria-labelledby={titleId}
      >
        <div className="ta-modal__header">
          <div>
            <div className="ta-modal__title" id={titleId}>{title}</div>
            {subtitle && <div className="ta-modal__subtitle">{subtitle}</div>}
          </div>
          <IconButton icon={X} label="Cerrar" onClick={onClose} />
        </div>
        <div className="ta-modal__body">{children}</div>
        {footer && <div className="ta-modal__footer">{footer}</div>}
      </div>
    </div>
  )
}

export function Drawer({
  title, subtitle, onClose, footer, children, wide,
}: {
  title: ReactNode; subtitle?: ReactNode; onClose: () => void
  footer?: ReactNode; children: ReactNode; wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useDismissable(onClose, ref)

  return (
    <>
      <div className="ta-drawer-overlay" onMouseDown={onClose} />
      <aside
        ref={ref}
        className={cx('ta-drawer', wide && 'ta-drawer--wide')}
        role="dialog" aria-modal="true" aria-labelledby={titleId}
      >
        <div className="ta-modal__header">
          <div>
            <div className="ta-modal__title" id={titleId}>{title}</div>
            {subtitle && <div className="ta-modal__subtitle">{subtitle}</div>}
          </div>
          <IconButton icon={X} label="Cerrar" onClick={onClose} />
        </div>
        <div className="ta-modal__body">{children}</div>
        {footer && <div className="ta-modal__footer">{footer}</div>}
      </aside>
    </>
  )
}

/**
 * Reemplaza a window.confirm() como experiencia final.
 * No cambia ninguna lógica de negocio: sólo la superficie de confirmación.
 */
export function ConfirmDialog({
  title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  danger, loading, onConfirm, onCancel,
}: {
  title: string; message: ReactNode
  confirmLabel?: string; cancelLabel?: string
  danger?: boolean; loading?: boolean
  onConfirm: () => void; onCancel: () => void
}) {
  return (
    <Modal
      title={title} onClose={onCancel} size="sm"
      footer={<>
        <Button variant="ghost" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </>}
    >
      <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-normal)' }}>
        {message}
      </div>
    </Modal>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   ESTADOS DE PANTALLA
   ══════════════════════════════════════════════════════════════════════════ */
export function EmptyState({
  icon: Icon = Inbox, title, description, action,
}: { icon?: LucideIcon; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="ta-state">
      <div className="ta-state__icon"><Icon size={20} aria-hidden /></div>
      <div className="ta-state__title">{title}</div>
      {description && <div className="ta-state__desc">{description}</div>}
      {action}
    </div>
  )
}

/**
 * Errores en lenguaje humano.
 * `detail` es opcional y para diagnóstico: nunca se muestra un error crudo de
 * Postgres ni un stack trace como mensaje principal.
 */
export function ErrorState({
  title = 'No pudimos cargar esta información',
  description = 'Algo falló al traer los datos. Podés reintentar.',
  detail, onRetry,
}: { title?: string; description?: ReactNode; detail?: string; onRetry?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="ta-state">
      <div className="ta-state__icon ta-state__icon--danger"><TriangleAlert size={20} aria-hidden /></div>
      <div className="ta-state__title">{title}</div>
      <div className="ta-state__desc">{description}</div>
      {onRetry && <Button variant="secondary" icon={RotateCcw} onClick={onRetry}>Reintentar</Button>}
      {detail && (
        <>
          <button
            className="ta-btn ta-btn--ghost ta-btn--sm"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
          >{open ? 'Ocultar detalle técnico' : 'Ver detalle técnico'}</button>
          {open && (
            <pre style={{
              maxWidth: 460, overflow: 'auto', textAlign: 'left',
              fontSize: 11, fontFamily: 'var(--font-mono)',
              color: 'var(--text-tertiary)', background: 'var(--bg-muted)',
              padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)',
            }}>{detail}</pre>
          )}
        </>
      )}
    </div>
  )
}

export function Skeleton({ width, height = 12, radius, className }: {
  width?: number | string; height?: number | string; radius?: number; className?: string
}) {
  return (
    <div
      className={cx('ta-skeleton', className)}
      style={{ width: width ?? '100%', height, borderRadius: radius }}
      aria-hidden
    />
  )
}

export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)' }}
         role="status" aria-label="Cargando">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={14} width={i === rows - 1 ? '60%' : '100%'} />
      ))}
    </div>
  )
}

export function Spinner({ inline }: { inline?: boolean }) {
  if (inline) return <span className="ta-spinner" role="status" aria-label="Cargando" />
  return <div className="ta-spinner-wrap"><span className="ta-spinner" role="status" aria-label="Cargando" /></div>
}

/* ══════════════════════════════════════════════════════════════════════════
   TOASTS
   ══════════════════════════════════════════════════════════════════════════ */
export type ToastKind = 'success' | 'error' | 'warning' | 'info'
type ToastItem = { id: number; kind: ToastKind; msg: string }

let pushToast: ((k: ToastKind, m: string) => void) | null = null
let seq = 0

const TOAST_ICON: Record<ToastKind, LucideIcon> = {
  success: Check, error: CircleX, warning: TriangleAlert, info: Info,
}

export function ToastProvider() {
  const [items, setItems] = useState<ToastItem[]>([])

  const remove = useCallback((id: number) => setItems(x => x.filter(i => i.id !== id)), [])

  useEffect(() => {
    pushToast = (kind, msg) => {
      const id = ++seq
      setItems(x => [...x.slice(-3), { id, kind, msg }])
      setTimeout(() => remove(id), kind === 'error' ? 6000 : 3200)
    }
    return () => { pushToast = null }
  }, [remove])

  if (!items.length) return null
  return (
    <div className="ta-toast-region" role="region" aria-live="polite" aria-label="Notificaciones">
      {items.map(t => {
        const Icon = TOAST_ICON[t.kind]
        return (
          <div key={t.id} className={cx('ta-toast', `ta-toast--${t.kind}`)}>
            <span className="ta-toast__icon"><Icon size={15} aria-hidden /></span>
            <span>{t.msg}</span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * API de toast.
 *
 * Se mantiene `toast(msg)` como función para no romper los ~60 call-sites
 * existentes, y se agregan variantes tipadas.
 *
 * Compatibilidad: los mensajes viejos venían con "✓ " o "Error: " en el texto.
 * Se detecta el prefijo para inferir el tipo y se limpia el símbolo, así los
 * call-sites no tocados igual muestran el icono correcto.
 */
function inferKind(msg: string): { kind: ToastKind; text: string } {
  const t = msg.trim()
  if (t.startsWith('✓')) return { kind: 'success', text: t.replace(/^✓\s*/, '') }
  if (/^(error|no se pudo|no pudimos|fallo|falló)/i.test(t)) return { kind: 'error', text: t }
  if (t.startsWith('⚠')) return { kind: 'warning', text: t.replace(/^⚠\s*/, '') }
  return { kind: 'info', text: t }
}

export function toast(msg: string) {
  const { kind, text } = inferKind(msg)
  pushToast?.(kind, text)
}
toast.success = (m: string) => pushToast?.('success', m)
toast.error   = (m: string) => pushToast?.('error', m)
toast.warning = (m: string) => pushToast?.('warning', m)
toast.info    = (m: string) => pushToast?.('info', m)
