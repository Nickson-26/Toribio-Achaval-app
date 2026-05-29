import React from 'react';

const ACCENT = 'var(--accent, #CC1C28)';

export function FormField({ label, required, hint, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <label style={{ fontSize:11, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>
        {label}{required && <span style={{ color:'var(--danger, #ef4444)', marginLeft:2 }}>*</span>}
      </label>
      {children}
      {hint && <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>{hint}</span>}
    </div>
  );
}

export function Input({ className = '', style = {}, ...props }) {
  return (
    <input
      className={className}
      style={{
        width:'100%', padding:'10px 12px',
        border:'1px solid var(--border-strong)',
        borderRadius:'var(--radius)',
        fontSize:14, color:'var(--text-primary)',
        background:'var(--bg-secondary)',
        outline:'none', transition:'border-color 150ms',
        ...style,
      }}
      onFocus={e => e.target.style.borderColor = ACCENT}
      onBlur={e => e.target.style.borderColor = 'var(--border-strong)'}
      {...props}
    />
  );
}

export function Select({ className = '', style = {}, children, ...props }) {
  return (
    <select
      className={className}
      style={{
        width:'100%', padding:'10px 12px',
        border:'1px solid var(--border-strong)',
        borderRadius:'var(--radius)',
        fontSize:14, color:'var(--text-primary)',
        background:'var(--bg-secondary)',
        outline:'none', cursor:'pointer', transition:'border-color 150ms',
        ...style,
      }}
      onFocus={e => e.target.style.borderColor = ACCENT}
      onBlur={e => e.target.style.borderColor = 'var(--border-strong)'}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className = '', style = {}, ...props }) {
  return (
    <textarea
      className={className}
      style={{
        width:'100%', padding:'10px 12px',
        border:'1px solid var(--border-strong)',
        borderRadius:'var(--radius)',
        fontSize:14, color:'var(--text-primary)',
        background:'var(--bg-secondary)',
        outline:'none', resize:'none', transition:'border-color 150ms',
        ...style,
      }}
      onFocus={e => e.target.style.borderColor = ACCENT}
      onBlur={e => e.target.style.borderColor = 'var(--border-strong)'}
      {...props}
    />
  );
}

export function ToggleGroup({ options, value, onChange }) {
  return (
    <div style={{ display:'flex', gap:8 }}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
            style={{
              flex:1, padding:'10px 12px', borderRadius:'var(--radius)',
              border: `1px solid ${active ? ACCENT : 'var(--border-strong)'}`,
              background: active ? ACCENT : 'var(--bg-secondary)',
              color: active ? '#fff' : 'var(--text-secondary)',
              fontSize:14, fontWeight:600, cursor:'pointer', transition:'all 150ms',
            }}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function Card({ title, subtitle, children }) {
  return (
    <div style={{
      background:'var(--bg-card)',
      borderRadius:'var(--radius-xl)',
      border:'1px solid var(--border)',
      overflow:'hidden', marginBottom:16,
      boxShadow:'var(--shadow-sm)',
    }}>
      {title && (
        <div style={{ padding:'16px 20px', background:'var(--bg-tertiary)', borderBottom:'1px solid var(--border)' }}>
          <h2 style={{ color:'var(--text-primary)', fontWeight:700, fontSize:15, margin:0 }}>{title}</h2>
          {subtitle && <p style={{ color:'var(--text-secondary)', fontSize:12, marginTop:2, marginBottom:0 }}>{subtitle}</p>}
        </div>
      )}
      <div style={{ padding:20 }}>{children}</div>
    </div>
  );
}

export function SectionLabel({ children }) {
  return <p style={{ fontSize:11, fontWeight:900, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12, color: ACCENT }}>{children}</p>;
}

export function Divider() {
  return <hr style={{ border:'none', borderTop:'1px solid var(--border)', margin:'16px 0' }} />;
}

export function InfoBox({ children }) {
  return (
    <div style={{
      background:'var(--bg-secondary)', border:'1px solid var(--border)',
      borderRadius:'var(--radius-lg)', padding:'12px 16px',
      fontSize:14, color:'var(--text-secondary)', lineHeight:1.6,
    }}>
      {children}
    </div>
  );
}

export function TotalDisplay({ label, value }) {
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      borderRadius:'var(--radius-lg)', padding:'12px 16px', marginTop:12,
      background:'var(--bg-tertiary)', border:'1px solid var(--border)',
    }}>
      <span style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize:18, fontWeight:900, color: ACCENT }}>{value}</span>
    </div>
  );
}
