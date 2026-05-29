import React from 'react';
import { CheckCircle, Plus } from 'lucide-react';

export default function SuccessScreen({ avisoNum, onReset, title = 'Aviso enviado!', subtitle = 'El director de tu unidad recibio una notificacion y revisara el aviso a la brevedad.', btnLabel = 'Cargar nuevo aviso' }) {
  return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'48px 16px' }}>
      <div style={{
        background:'var(--bg-card)', borderRadius:'var(--radius-xl)',
        border:'1px solid var(--border)', width:'100%', maxWidth:420,
        overflow:'hidden', boxShadow:'var(--shadow-lg)',
      }}>
        <div style={{ height:4, background:'var(--accent, #CC1C28)' }} />
        <div style={{ padding:32, textAlign:'center' }}>
          <div style={{ width:80, height:80, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', background:'var(--bg-tertiary)', border:'2px solid var(--border)' }}>
            <CheckCircle size={40} style={{ color:'var(--accent, #CC1C28)' }} />
          </div>
          <h2 style={{ fontSize:22, fontWeight:900, color:'var(--text-primary)', marginBottom:8 }}>{title}</h2>
          <p style={{ color:'var(--text-secondary)', fontSize:14, marginBottom:24 }}>{subtitle}</p>
          <div style={{ display:'inline-block', borderRadius:'var(--radius-lg)', padding:'12px 24px', marginBottom:8, fontWeight:900, fontSize:20, letterSpacing:'0.1em', background:'var(--bg-tertiary)', color:'var(--accent, #CC1C28)', border:'1px solid var(--border)' }}>
            {avisoNum}
          </div>
          <p style={{ fontSize:11, color:'var(--text-tertiary)', marginBottom:32 }}>Guarda este numero como referencia.</p>
          <button onClick={onReset} style={{
            display:'inline-flex', alignItems:'center', gap:8,
            padding:'12px 24px', borderRadius:'var(--radius-lg)',
            fontWeight:700, fontSize:14, color:'#fff',
            background:'var(--accent, #CC1C28)', border:'none', cursor:'pointer',
          }}>
            <Plus size={16} />{btnLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
