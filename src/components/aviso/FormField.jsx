import React from 'react';
export function FormField({ label, required, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </div>
  );
}
export function Input({ className = '', ...props }) {
  return (
    <input className={`w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100 read-only:bg-gray-50 read-only:text-gray-500 read-only:cursor-not-allowed placeholder:text-gray-400 ${className}`} {...props} />
  );
}
export function Select({ className = '', children, ...props }) {
  return (
    <select className={`w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white outline-none cursor-pointer transition-all focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed ${className}`} {...props}>
      {children}
    </select>
  );
}
export function Textarea({ className = '', ...props }) {
  return (
    <textarea className={`w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white outline-none transition-all resize-none focus:border-red-500 focus:ring-2 focus:ring-red-100 placeholder:text-gray-400 ${className}`} {...props} />
  );
}
export function ToggleGroup({ options, value, onChange }) {
  return (
    <div className="flex gap-2">
      {options.map(opt => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)} className="flex-1 py-2.5 px-3 rounded-lg border text-sm font-semibold transition-all"
          style={{ borderColor: value === opt.value ? '#CC1C28' : '#E5E7EB', background: value === opt.value ? '#CC1C28' : '#fff', color: value === opt.value ? '#fff' : '#6B7280' }}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
export function Card({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
      {title && (<div className="px-5 py-4" style={{ background: '#111' }}><h2 className="text-white font-bold text-base">{title}</h2>{subtitle && <p className="text-gray-400 text-xs mt-0.5">{subtitle}</p>}</div>)}
      <div className="p-5">{children}</div>
    </div>
  );
}
export function SectionLabel({ children }) {
  return <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#CC1C28' }}>{children}</p>;
}
export function Divider() {
  return <hr className="border-gray-100 my-4" />;
}
export function InfoBox({ children }) {
  return <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 leading-relaxed">{children}</div>;
}
export function TotalDisplay({ label, value }) {
  return (
    <div className="flex justify-between items-center rounded-xl px-4 py-3 mt-3" style={{ background: '#111' }}>
      <span className="text-xs font-semibold text-gray-400">{label}</span>
      <span className="text-lg font-black" style={{ color: '#CC1C28' }}>{value}</span>
    </div>
  );
}
