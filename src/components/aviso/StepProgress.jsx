import React from 'react';
import { Check } from 'lucide-react';

export default function StepProgress({ steps, currentStep }) {
  return (
    <div style={{ background:'var(--bg-card)', borderBottom:'1px solid var(--border)', overflowX:'auto' }}>
      <div style={{ maxWidth:760, margin:'0 auto', padding:'16px' }}>
        <div style={{ display:'flex', alignItems:'center', minWidth:'max-content', margin:'0 auto' }}>
          {steps.map((label, i) => {
            const num = i + 1;
            const isDone = num < currentStep;
            const isActive = num === currentStep;
            const circleStyle = {
              width:32, height:32, borderRadius:'50%',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:12, fontWeight:700, transition:'all 200ms', zIndex:1,
              background: isDone ? 'var(--text-primary)' : isActive ? 'var(--accent, #CC1C28)' : 'var(--bg-secondary)',
              border: `2px solid ${isDone ? 'var(--text-primary)' : isActive ? 'var(--accent, #CC1C28)' : 'var(--border-strong)'}`,
              color: isDone || isActive ? '#fff' : 'var(--text-tertiary)',
            };
            return (
              <React.Fragment key={num}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth:64 }}>
                  <div style={circleStyle}>
                    {isDone ? <Check size={14} strokeWidth={3} /> : num}
                  </div>
                  <span style={{
                    fontSize:11, marginTop:4, fontWeight:600,
                    color: isDone ? 'var(--text-primary)' : isActive ? 'var(--accent, #CC1C28)' : 'var(--text-tertiary)',
                  }}>{label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div style={{
                    flex:1, height:2, margin:'0 4px 16px',
                    minWidth:20,
                    background: num < currentStep ? 'var(--text-primary)' : 'var(--border-strong)',
                  }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
