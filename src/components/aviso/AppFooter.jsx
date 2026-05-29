import React from 'react';
import { ChevronLeft, ChevronRight, Send } from 'lucide-react';
export default function AppFooter({ step, total, onNext, onBack, errors }) {
  const isLast = step === total;
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
      {errors.length > 0 && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2">
          <p className="text-xs text-red-700 font-medium">Errores: {errors.join(' - ')}</p>
        </div>
      )}
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <button onClick={onBack} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${step > 1 ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'opacity-0 pointer-events-none'}`}>
          <ChevronLeft size={16} />Anterior
        </button>
        <span className="text-xs font-semibold text-gray-400">Paso {step} de {total}</span>
        <button onClick={onNext} className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95" style={{ background: isLast ? '#111' : '#CC1C28' }}>
          {isLast ? (<><Send size={15} />Confirmar y enviar</>) : (<>Siguiente<ChevronRight size={16} /></>)}
        </button>
      </div>
    </div>
  );
}
