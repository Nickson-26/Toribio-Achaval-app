import React from 'react';
import { ChevronLeft, ChevronRight, Send } from 'lucide-react';

export default function AppFooter({ step, total, onNext, onBack, errors }) {
  const isLast = step === total;
  return (
    <div style={{
      position:'fixed', bottom:0, left:0, right:0,
      background:'var(--bg-card)', borderTop:'1px solid var(--border)',
      boxShadow:'var(--shadow-md)', zIndex:40,
    }}>
      {errors.length > 0 && (
        <div style={{ background:'var(--danger-bg, rgba(239,68,68,0.08))', borderBottom:'1px solid var(--danger, #ef4444)', padding:'8px 16px' }}>
          <p style={{ fontSize:12, color:'var(--danger, #ef4444)', fontWeight:500, margin:0 }}>
            {errors.join(' · ')}
          </p>
        </div>
      )}
      <div style={{ maxWidth:760, margin:'0 auto', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button
          onClick={onBack}
          style={{
            display:'flex', alignItems:'center', gap:6, padding:'10px 16px',
            borderRadius:'var(--radius)', fontSize:14, fontWeight:600, cursor:'pointer',
            background:'var(--bg-secondary)', color:'var(--text-secondary)',
            border:'1px solid var(--border-strong)', transition:'all 150ms',
            opacity: step > 1 ? 1 : 0, pointerEvents: step > 1 ? 'auto' : 'none',
          }}>
          <ChevronLeft size={16} />Anterior
        </button>
        <span style={{ fontSize:12, fontWeight:600, color:'var(--text-tertiary)' }}>Paso {step} de {total}</span>
        <button
          onClick={onNext}
          style={{
            display:'flex', alignItems:'center', gap:6, padding:'10px 20px',
            borderRadius:'var(--radius)', fontSize:14, fontWeight:700, cursor:'pointer',
            background: isLast ? 'var(--text-primary)' : 'var(--accent, #CC1C28)',
            color:'#fff', border:'none', transition:'all 150ms',
          }}>
          {isLast ? <><Send size={15} />Confirmar y enviar</> : <>Siguiente<ChevronRight size={16} /></>}
        </button>
      </div>
    </div>
  );
}
