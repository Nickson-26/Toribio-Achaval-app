import React from 'react';
import { Card, FormField, Input, Select, SectionLabel, Divider } from './FormField';
function ParteForm({ prefix, label, required, form, updateForm, optional }) {
  const f = (key) => form[`${prefix}_${key}`] || '';
  const u = (key, val) => updateForm({ [`${prefix}_${key}`]: val });
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <SectionLabel>{label}</SectionLabel>
        {optional && (<span className="text-xs font-semibold text-gray-400 bg-gray-100 border border-gray-200 rounded-full px-2.5 py-0.5 -mt-3">Opcional</span>)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <FormField label="Nombre / Razon social" required={required}><Input value={f('nombre')} placeholder="Nombre completo o empresa" onChange={e => u('nombre', e.target.value)} /></FormField>
        <FormField label="Sexo / Tipo" required={required}>
          <Select value={f('sexo')} onChange={e => u('sexo', e.target.value)}>
            <option value="">Seleccionar...</option>
            <option>Masculino</option><option>Femenino</option><option>Empresa</option><option>Otro</option>
          </Select>
        </FormField>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <FormField label="Tipo de documento" required={required}>
          <Select value={f('tipo_doc')} onChange={e => u('tipo_doc', e.target.value)}>
            <option value="">Seleccionar...</option>
            <option>DNI</option><option>CUIL</option><option>CUIT</option><option>CI</option>
          </Select>
        </FormField>
        <FormField label="Numero de documento" required={required}><Input value={f('num_doc')} placeholder="Sin puntos ni guiones" onChange={e => u('num_doc', e.target.value)} /></FormField>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Telefono" required={required}><Input value={f('tel')} placeholder="+54 11 XXXX-XXXX" onChange={e => u('tel', e.target.value)} /></FormField>
        <FormField label="Email" required={required}><Input type="email" value={f('email')} placeholder="email@ejemplo.com" onChange={e => u('email', e.target.value)} /></FormField>
      </div>
    </div>
  );
}
export default function Step4Partes({ form, updateForm }) {
  const tipo = form.tipo_op;
  const isConsult = tipo.includes('consultor');
  const isAlquiler = tipo === 'alquiler';
  const isVenta = tipo === 'venta';
  const label1 = isConsult ? 'Cliente' : isAlquiler ? 'Locador' : 'Vendedor';
  const label2 = isAlquiler ? 'Locatario' : 'Comprador';
  const showParte2 = !isConsult;
  const parte2Optional = isAlquiler;
  return (
    <Card title="Datos de las Partes" subtitle="Informacion de las partes intervinientes">
      <ParteForm prefix="v" label={label1} required={true} form={form} updateForm={updateForm} />
      {showParte2 && (<><Divider /><ParteForm prefix="c" label={label2} required={isVenta} optional={parte2Optional} form={form} updateForm={updateForm} /></>)}
    </Card>
  );
}
