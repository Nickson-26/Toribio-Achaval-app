import React from 'react';
import { Card, FormField, Input, Select, ToggleGroup, Divider, TotalDisplay } from './FormField';
import { BROKERS, PLATAFORMAS, TIPOS_OP, slug, fmtUSD } from './constants';
export default function Step1General({ form, updateForm, totalOpUSD }) {
  const plataformas = form.unidad ? PLATAFORMAS[form.unidad] || [] : [];
  const tiposOp = form.unidad ? TIPOS_OP[form.unidad] || [] : [];
  const isVenta = form.tipo_op === 'venta';
  const isAlquiler = form.tipo_op === 'alquiler';
  const isConsult = form.tipo_op.includes('consultor');
  const onUnidadChange = (u) => {
    updateForm({ unidad: u, plataforma: '', tipo_op: '', op_usd: '', alq_usd: '', alq_meses: '', hon_usd: '', hon_ars: '' });
  };
  return (
    <Card title="Datos Generales" subtitle="Informacion basica de la operacion">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <FormField label="Fecha"><Input value={form.fecha} readOnly /></FormField>
        <FormField label="Broker" required>
          <Select value={form.broker} onChange={e => updateForm({ broker: e.target.value })}>
            <option value="">Seleccionar broker...</option>
            {BROKERS.map(b => <option key={b} value={b}>{b}</option>)}
          </Select>
        </FormField>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <FormField label="Unidad de negocio" required>
          <Select value={form.unidad} onChange={e => onUnidadChange(e.target.value)}>
            <option value="">Seleccionar...</option>
            <option value="residencial">Residencial</option>
            <option value="comercial">Comercial</option>
            <option value="emprendimientos">Emprendimientos</option>
          </Select>
        </FormField>
        <FormField label="Plataforma / Area" required>
          <Select value={form.plataforma} disabled={!form.unidad} onChange={e => updateForm({ plataforma: e.target.value, tipo_op: '' })}>
            <option value="">{form.unidad ? 'Seleccionar plataforma...' : 'Primero elegi la unidad'}</option>
            {plataformas.map(p => <option key={p} value={slug(p)}>{p}</option>)}
          </Select>
        </FormField>
      </div>
      <FormField label="Tipo de operacion" required>
        <Select value={form.tipo_op} disabled={!form.plataforma} onChange={e => updateForm({ tipo_op: e.target.value })}>
          <option value="">{form.plataforma ? 'Seleccionar tipo...' : 'Primero elegi la plataforma'}</option>
          {tiposOp.map(t => <option key={t} value={slug(t)}>{t}</option>)}
        </Select>
      </FormField>
      {isVenta && (<><Divider /><MontoBlock title="Monto de la operacion">
        <FormField label="Monto (U$S)" required><Input type="number" value={form.op_usd} placeholder="0" onChange={e => updateForm({ op_usd: e.target.value })} /></FormField>
        {totalOpUSD > 0 && <TotalDisplay label="Total operacion" value={`U$S ${fmtUSD(totalOpUSD)}`} />}
      </MontoBlock></>)}
      {isAlquiler && (<><Divider /><MontoBlock title="Monto del alquiler">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Monto mensual (U$S)" required><Input type="number" value={form.alq_usd} placeholder="0" onChange={e => updateForm({ alq_usd: e.target.value })} /></FormField>
          <FormField label="Cantidad de meses" required><Input type="number" value={form.alq_meses} placeholder="Ej: 24" onChange={e => updateForm({ alq_meses: e.target.value })} /></FormField>
        </div>
        {totalOpUSD > 0 && <TotalDisplay label="Total del contrato" value={`U$S ${fmtUSD(totalOpUSD)}`} />}
      </MontoBlock></>)}
      {isConsult && (<><Divider /><MontoBlock title="Honorarios del servicio">
        <FormField label="Moneda" required>
          <ToggleGroup value={form.hon_moneda} onChange={v => updateForm({ hon_moneda: v, hon_usd: '', hon_ars: '' })}
            options={[{ value: 'usd', label: 'U$S Dolares' }, { value: 'ars', label: '$ Pesos' }]} />
        </FormField>
        <div className="mt-3">
          {form.hon_moneda === 'usd' ? (
            <FormField label="Monto del servicio (U$S)" required><Input type="number" value={form.hon_usd} placeholder="0" onChange={e => updateForm({ hon_usd: e.target.value })} /></FormField>
          ) : (
            <FormField label="Monto del servicio ($)" required><Input type="number" value={form.hon_ars} placeholder="0" onChange={e => updateForm({ hon_ars: e.target.value })} /></FormField>
          )}
        </div>
        {form.hon_moneda === 'usd' && totalOpUSD > 0 && <TotalDisplay label="Total honorarios" value={`U$S ${fmtUSD(totalOpUSD)}`} />}
        {form.hon_moneda === 'ars' && parseFloat(form.hon_ars) > 0 && (
          <TotalDisplay label="Total honorarios" value={`$ ${Math.round(parseFloat(form.hon_ars)).toLocaleString('es-AR')}`} />
        )}
      </MontoBlock></>)}
    </Card>
  );
}
function MontoBlock({ title, children }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-2">
      <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: '#CC1C28' }}>{title}</p>
      {children}
    </div>
  );
}
