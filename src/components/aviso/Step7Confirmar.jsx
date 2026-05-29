import React from 'react';
import { Card } from './FormField';
import { CANAL_LABELS, fmtUSD } from './constants';
import { AlertTriangle } from 'lucide-react';
function SumSection({ title, rows }) {
  return (
    <div className="mb-5">
      <div className="text-xs font-black uppercase tracking-widest mb-2 pb-2 border-b-2" style={{ color: '#CC1C28', borderColor: '#CC1C28' }}>{title}</div>
      <div className="space-y-1">
        {rows.map(([key, val], i) => (
          <div key={i} className="flex justify-between py-1.5 border-b border-gray-50 text-sm last:border-0">
            <span className="text-gray-500 shrink-0 mr-4">{key}</span>
            <span className="font-semibold text-gray-900 text-right">{val || '-'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
export default function Step7Confirmar({ form, totalOpUSD }) {
  const g = (key) => form[key] || '-';
  const isAlquiler = form.tipo_op === 'alquiler';
  const isConsult = form.tipo_op.includes('consultor');
  const label1 = isConsult ? 'Cliente' : isAlquiler ? 'Locador' : 'Vendedor';
  const label2 = isAlquiler ? 'Locatario' : 'Comprador';
  const unidadMap = { residencial: 'Residencial', comercial: 'Comercial', emprendimientos: 'Emprendimientos' };
  const pct_v = parseFloat(form.pct_v) || 0;
  const pct_c = parseFloat(form.pct_c) || 0;
  const netoV = totalOpUSD * pct_v / 100;
  const netoC = totalOpUSD * pct_c / 100;
  const totalComV = netoV * 1.21;
  const totalComC = netoC * 1.21;
  const parts = [];
  if (form.prod) parts.push([`Productor/a`, `${form.prod} - ${form.prod_pct}%`]);
  if (form.coord) parts.push([`Coordinador/a`, `${form.coord} - 10%`]);
  if (form.tas) parts.push([`Tasador/a`, form.tas]);
  if (form.vend) parts.push([`Vendedor/Broker`, form.vend]);
  return (
    <>
      <Card title="Confirmacion del Aviso" subtitle="Revisa los datos antes de enviar">
        <SumSection title="General" rows={[['Broker', g('broker')], ['Unidad', unidadMap[form.unidad] || '-'], ['Tipo de operacion', form.tipo_op.replace(/_/g, ' ')], ['Monto total', totalOpUSD ? `U$S ${fmtUSD(totalOpUSD)}` : '-']]} />
        {!isConsult && (<SumSection title="Inmueble" rows={[['Direccion', g('dir')], ['Tipo', g('tipo_inmueble')], ['M2', form.m2 ? `${form.m2} m2` : '-'], ...(form.reserva ? [['Reserva', `U$S ${parseInt(form.reserva).toLocaleString('es-AR')}`]] : [])]} />)}
        <SumSection title="Comisiones" rows={[[`Com. ${label1} (${pct_v}%)`, totalOpUSD ? `U$S ${fmtUSD(totalComV)}` : '-'], ...(form.v_pendiente ? [['Pendiente vendedor', `U$S ${fmtUSD(parseFloat(form.v_pendiente))}`]] : []), [`Com. ${label2} (${pct_c}%)`, totalOpUSD ? `U$S ${fmtUSD(totalComC)}` : '-'], ...(form.c_pendiente ? [['Pendiente comprador', `U$S ${fmtUSD(parseFloat(form.c_pendiente))}`]] : [])]} />
        <SumSection title={label1} rows={[['Nombre', g('v_nombre')], ['Documento', `${g('v_tipo_doc')} ${g('v_num_doc')}`], ['Telefono', g('v_tel')], ['Email', g('v_email')]]} />
        {!isConsult && (<SumSection title={label2} rows={[['Nombre', g('c_nombre')], ['Documento', `${g('c_tipo_doc')} ${g('c_num_doc')}`], ['Telefono', g('c_tel')], ['Email', g('c_email')]]} />)}
        <SumSection title="Canal y Colega" rows={[['Canal', CANAL_LABELS[form.canal] || g('canal')], ...(form.obs_canal ? [['Observaciones', form.obs_canal]] : []), ['Colega externo', form.hasColega ? `${form.col_nombre} - ${form.col_inmob}` : 'No'], ...(form.hasColega && form.col_parte ? [['Opera por parte', form.col_parte]] : [])]} />
        {parts.length > 0 && <SumSection title="Participantes" rows={parts} />}
      </Card>
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4">
        <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-800"><strong>Al confirmar</strong>, el aviso se enviara al director de tu unidad para validacion. Una vez enviado no podras modificarlo.</p>
      </div>
    </>
  );
}
