import React from 'react';
import { FileText, BookOpen, Receipt } from 'lucide-react';

const TABS = [
  { id: 'avisos', label: 'Avisos de Ingreso', icon: FileText },
  { id: 'reservas', label: 'Reservas', icon: BookOpen },
  { id: 'facturas', label: 'Facturas', icon: Receipt },
];

export default function MainNav({ active, onChange }) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 flex gap-0">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="flex items-center gap-2 px-5 py-3.5 text-sm font-bold border-b-2 transition-all whitespace-nowrap"
              style={{
                borderBottomColor: isActive ? '#CC1C28' : 'transparent',
                color: isActive ? '#CC1C28' : '#6B7280',
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
