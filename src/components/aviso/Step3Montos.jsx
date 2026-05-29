import React from 'react';
import { Card, FormField, Input, SectionLabel, Divider } from './FormField';
import { fmtUSD } from './constants';
function calcComisiones(total, pct) {
  const neto = total * pct / 100;
  const iva = neto * 0.21;
  return { neto, iva, total: neto + iva };
}
function AmountCol({ title, pct, pctKey, totalOpUSD, form, updateForm, side }) {
  const com = calcComisiones(totalOpUSD, parseFloat(pct) || 0);
  const hasUSD = parseFloat(form[`${side}_pago_usd`]) > 0;
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
      <div className="text-xs font-black uppercase tracking-widest pb-3 mb-3 border-b-2" style={{ color: 'var(--accent, #CC1C28)', borderColor: 'var(--accent, #CC1C28)' }}>{title}</div>
      <FormField label="% Comision" required hint={`Default: ${pct}%`}>
        <Input type="number" value={form[pctKey]} step="0.5" min="0" max="20" onChange={e => updateForm({ [pctKey]: e.target.value })} />
      </FormField>
      <div className="mt-3 space-y-1">
        <AutoLine label="Comision neta" value={totalOpUSD ? `U$S ${fmtUSD(com.neto)}` : '-'} />
        <AutoLine label="IVA 21%" value={totalOpUSD ? `U$S ${fmtUSD(com.iva)}` : '-'} />
        <AutoLine label="Total comision" value={totalOpUSD ? `U$S ${fmtUSD(com.total)}` : '-'} bold accent />
      </div>
      <Divider />
      <SectionLabel>Desglose del pago</SectionLabel>
      <div className="space-y-3">
        <FormField label="Monto en pesos (ARS)"><Input type="number" value={form[`${side}_pago_ars`]} placeholder="0" onChange={e => updateForm({ [`${side}_pago_ars`]: e.target.value })} /></FormField>
        <FormField label="Monto en dolares (USD)"><Input type="number" value={form[`${side}_pago_usd`]} placeholder="" onChange={e => updateForm({ [`${side}_pago_usd`]: e.target.value })} /></FormField>
        {hasUSD && (<FormField label="Tipo de cambio" required><Input type="number" value={form[`${side}_pago_tc`]} placeholder="Ej: 1.050" onChange={e => updateForm({ [`${side}_pago_tc`]: e.target.value })} /></FormField>)}
        <FormField label="Pendiente de facturacion (U$S)"><Input type="number" value={form[`${side}_pendiente`]} placeholder="Ingresa el monto libremente" onChange={e => updateForm({ [`${side}_pendiente`]: e.target.value })} /></FormField>
      </div>
    </div>
  );
}
function AutoLine({ label, value, bold, accent }) {
  return (
    <div className={`flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0 text-sm ${bold ? 'font-bold' : ''}`}>
      <span className="text-gray-500">{label}</span>
      <span style={{ color: accent ? 'var(--accent, #CC1C28)' : undefined, fontWeight: bold ? 700 : 600, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
export default function Step3Montos({ form, updateForm, totalOpUSD }) {
  const isAlquiler = form.tipo_op === 'alquiler';
  const isConsult = form.tipo_op.includes('consultor');
  const vTitle = isConsult ? 'Vendedor / Cliente' : isAlquiler ? 'Locador' : 'Vendedor';
  const cTitle = isConsult ? 'Cliente' : isAlquiler ? 'Locatario' : 'Comprador';
  return (
    <Card title="Montos y Comisiones" subtitle="Las comisiones se calculan sobre el monto total de la operacion">
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-4 text-xs text-gray-500">
        <span className="font-semibold">Monto total de la operacion:</span>
        <span className="font-black" style={{ color: 'var(--accent, #CC1C28)' }}>{totalOpUSD ? `U$S ${fmtUSD(totalOpUSD)}` : '-'}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AmountCol title={vTitle} pct={form.pct_v} pctKey="pct_v" totalOpUSD={totalOpUSD} form={form} updateForm={updateForm} side="v" />
        <AmountCol title={cTitle} pct={form.pct_c} pctKey="pct_c" totalOpUSD={totalOpUSD} form={form} updateForm={updateForm} side="c" />
      </div>
    </Card>
  );
}
