import React from 'react';
import { Card, FormField, Select, Textarea, ToggleGroup, SectionLabel, Divider, Input } from './FormField';
import { NON_PAID } from './constants';
export default function Step5Canal({ form, updateForm }) {
  const showObs = NON_PAID.includes(form.canal);
  return (
    <Card title="Canal de Arribo" subtitle="Por que canal llego el cliente?">
      <FormField label="Canal de arribo" required>
        <Select value={form.canal} onChange={e => updateForm({ canal: e.target.value, obs_canal: '' })}>
          <option value="">Seleccionar canal...</option>
          <optgroup label="Canales Pagos">
            <option value="zonaprop">Zonaprop</option>
            <option value="web">Web Toribio Achaval</option>
            <option value="mercadolibre">Mercado Libre</option>
            <option value="argenprop">ArgenProp</option>
            <option value="google_ads">Google Ads</option>
            <option value="cartel">Cartel</option>
            <option value="email_mkt">Email Marketing</option>
            <option value="visita">Visita Sucursal</option>
          </optgroup>
          <optgroup label="Canales No Pagos">
            <option value="referido">Referido</option>
            <option value="proactividad">Proactividad</option>
            <option value="cliente">Cliente (ya era cliente)</option>
            <option value="firma">Firma</option>
            <option value="colega_ext">Colega</option>
          </optgroup>
        </Select>
      </FormField>
      {showObs && (
        <div className="mt-4">
          <FormField label="Observaciones del canal" required hint="Obligatorio para canales no pagos">
            <Textarea value={form.obs_canal} rows={3} placeholder="Especifica el origen..." onChange={e => updateForm({ obs_canal: e.target.value })} />
          </FormField>
        </div>
      )}
      <Divider />
      <SectionLabel>Colega Externo</SectionLabel>
      <FormField label="Interviene un colega de otra inmobiliaria?" required>
        <ToggleGroup value={form.hasColega ? 'si' : 'no'} onChange={v => updateForm({ hasColega: v === 'si' })} options={[{ value: 'si', label: 'Si' }, { value: 'no', label: 'No' }]} />
      </FormField>
      {form.hasColega && (
        <div className="mt-4 border border-dashed border-gray-300 rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Nombre del colega" required><Input value={form.col_nombre} placeholder="Nombre completo" onChange={e => updateForm({ col_nombre: e.target.value })} /></FormField>
            <FormField label="Inmobiliaria" required><Input value={form.col_inmob} placeholder="Nombre de la inmobiliaria" onChange={e => updateForm({ col_inmob: e.target.value })} /></FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Telefono" required><Input value={form.col_tel} onChange={e => updateForm({ col_tel: e.target.value })} /></FormField>
            <FormField label="Email" required><Input type="email" value={form.col_email} onChange={e => updateForm({ col_email: e.target.value })} /></FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Matricula" required><Input value={form.col_mat} onChange={e => updateForm({ col_mat: e.target.value })} /></FormField>
            <FormField label="Opera por parte" required>
              <Select value={form.col_parte} onChange={e => updateForm({ col_parte: e.target.value })}>
                <option value="">Seleccionar...</option>
                <option value="compradora">Compradora</option>
                <option value="vendedora">Vendedora</option>
              </Select>
            </FormField>
          </div>
        </div>
      )}
    </Card>
  );
}
