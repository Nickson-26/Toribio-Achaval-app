import React from 'react';
export default function AppHeader() {
  const now = new Date();
  const fecha = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <div>
          <div className="text-xl sm:text-2xl font-black leading-none tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
            <span style={{ color: '#CC1C28' }}>Toribio</span><span className="text-black">Achaval</span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5 font-medium">Sistema de Avisos de Ingreso</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs text-gray-500 capitalize hidden sm:block">{fecha}</span>
          <span className="text-xs font-bold px-3 py-0.5 rounded-full text-white" style={{ background: '#CC1C28' }}>PROTOTIPO</span>
        </div>
      </div>
    </header>
  );
}
