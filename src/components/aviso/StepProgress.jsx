import React from 'react';
import { Check } from 'lucide-react';
export default function StepProgress({ steps, currentStep }) {
  return (
    <div className="bg-white border-b border-gray-200 overflow-x-auto">
      <div className="max-w-3xl mx-auto px-4 py-4">
        <div className="flex items-center min-w-max mx-auto" style={{ gap: 0 }}>
          {steps.map((label, i) => {
            const num = i + 1;
            const isDone = num < currentStep;
            const isActive = num === currentStep;
            return (
              <React.Fragment key={num}>
                <div className="flex flex-col items-center" style={{ minWidth: 64 }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 z-10"
                    style={{ background: isDone ? '#111' : isActive ? '#CC1C28' : '#fff', border: isDone ? '2px solid #111' : isActive ? '2px solid #CC1C28' : '2px solid #D1D5DB', color: isDone || isActive ? '#fff' : '#9CA3AF' }}>
                    {isDone ? <Check size={14} strokeWidth={3} /> : num}
                  </div>
                  <span className="text-xs mt-1 font-semibold" style={{ color: isDone ? '#111' : isActive ? '#CC1C28' : '#9CA3AF' }}>{label}</span>
                </div>
                {i < steps.length - 1 && (<div className="flex-1 h-0.5 mb-4 mx-1" style={{ background: num < currentStep ? '#111' : '#E5E7EB', minWidth: 20 }} />)}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
