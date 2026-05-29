import React from 'react';
import { CheckCircle, Plus } from 'lucide-react';
export default function SuccessScreen({ avisoNum, onReset, title = 'Aviso enviado!', subtitle = 'El director de tu unidad recibio una notificacion y revisara el aviso a la brevedad.', btnLabel = 'Cargar nuevo aviso' }) {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 w-full max-w-md overflow-hidden">
        <div className="h-2" style={{ background: '#CC1C28' }} />
        <div className="p-8 text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: '#111' }}>
            <CheckCircle size={40} className="text-white" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">{title}</h2>
          <p className="text-gray-500 text-sm mb-6">{subtitle}</p>
          <div className="inline-block rounded-xl px-6 py-3 mb-2 font-black text-xl tracking-widest" style={{ background: '#111', color: '#CC1C28' }}>{avisoNum}</div>
          <p className="text-xs text-gray-400 mb-8">Guarda este numero como referencia.</p>
          <button onClick={onReset} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95" style={{ background: '#CC1C28' }}>
            <Plus size={16} />{btnLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
