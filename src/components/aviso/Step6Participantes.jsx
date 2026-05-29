import React from 'react';
import { Card, FormField, Select, InfoBox } from './FormField';
import { BROKERS } from './constants';
import { UserCheck } from 'lucide-react';
function ParticipantCard({ role, fieldKey, pctDisplay, showPct, pctOptions, pctKey, form, updateForm }) {
  const assigned = !!form[fieldKey];
  return (
    <div className="border-2 rounded-xl p-4 transition-all" style={{ borderColor: assigned ? '#CC1C28' : '#E5E7EB', background: assigned ? '#FFF5F5' : '#FAFAFA' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-black uppercase tracking-widest" style={{ color: assigned ? '#CC1C28' : '#9CA3AF' }}>{role}</span>
        {assigned && <UserCheck size={14} style={{ color: '#CC1C28' }} />}
      </div>
      <FormField label="">
        <Select value={form[fieldKey]} onChange={e => updateForm({ [fieldKey]: e.target.value })}>
          <option value="">Sin asignar</option>
          {BROKERS.map(b => <option key={b} value={b}>{b}</option>)}
        </Select>
      </FormField>
      <div className="mt-2 flex items-center justify-between">
        <span className="inline-block text-xs font-bold px-3 py-1 rounded-full" style={{ background: assigned ? '#CC1C28' : '#E5E7EB', color: assigned ? '#fff' : '#9CA3AF' }}>{pctDisplay}</span>
        {showPct && assigned && (
          <Select className="w-24 text-xs" value={form[pctKey]} onChange={e => updateForm({ [pctKey]: e.target.value })}>
            {(pctOptions || []).map(p => <option key={p} value={p}>{p}%</option>)}
          </Select>
        )}
      </div>
    </div>
  );
}
export default function Step6Participantes({ form, updateForm }) {
  const tipo = form.tipo_op;
  const unidad = form.unidad;
  const plat = form.plataforma;
  const isConsult = tipo.includes('consultor');
  const isEmp = unidad === 'emprendimientos';
  const isDptoBusqueda = plat === 'dpto._de_busqueda';
  const showProd = !isDptoBusqueda;
  const showCoord = !isConsult && !isEmp && !isDptoBusqueda;
  const showTas = !isEmp && !isDptoBusqueda;
  const showVend = !isConsult;
  return (
    <Card title="Participantes y Comisiones" subtitle="Asigna los brokers participantes. Al menos uno es obligatorio.">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {showProd && (<ParticipantCard role="Productor/a" fieldKey="prod" pctDisplay={`${form.prod_pct}%`} showPct={true} pctOptions={[0, 5, 10, 13]} pctKey="prod_pct" form={form} updateForm={updateForm} />)}
        {showCoord && (<ParticipantCard role="Coordinador/a" fieldKey="coord" pctDisplay="10%" form={form} updateForm={updateForm} />)}
        {showTas && (<ParticipantCard role="Tasador/a" fieldKey="tas" pctDisplay={isConsult ? '50%' : '5%'} form={form} updateForm={updateForm} />)}
        {showVend && (<ParticipantCard role="Vendedor / Broker" fieldKey="vend" pctDisplay={isEmp ? '20/25%' : '15%'} form={form} updateForm={updateForm} />)}
      </div>
      {isConsult && (<div className="mt-4"><InfoBox>Consultoria / Tasacion: El productor comisiona el 10% solo sobre el neto. El tasador comisiona el 50% del total.</InfoBox></div>)}
      {isEmp && (<div className="mt-4"><InfoBox>Emprendimientos: El % del vendedor es 20% hasta U$S 2.000 acumulados, y 25% superando ese monto.</InfoBox></div>)}
    </Card>
  );
}
