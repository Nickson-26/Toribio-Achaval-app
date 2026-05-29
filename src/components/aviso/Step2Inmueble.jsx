import React, { useState } from 'react';
import { Card, FormField, Input, Select, ToggleGroup, InfoBox } from './FormField';
import { TIPOS_INMUEBLE, PROA_DB } from './constants';
import { Search, CheckCircle, XCircle } from 'lucide-react';
export default function Step2Inmueble({ form, updateForm }) {
  const isConsult = form.tipo_op.includes('consultor');
  const [proaStatus, setProaStatus] = useState(null);
  const [proaMsg, setProaMsg] = useState('');
  if (isConsult) {
    return (
      <Card title="Datos de la operacion" subtitle="Consultoria / Tasacion">
        <InfoBox>Para Consultoria / Tasacion no se requieren datos del inmueble. Podes avanzar al siguiente paso.</InfoBox>
      </Card>
    );
  }
  const tiposInmueble = TIPOS_INMUEBLE[form.unidad] || [];
  const buscarPROA = () => {
    const code = form.proa_code.trim().toUpperCase();
    const data = PROA_DB[code];
    if (data) {
      updateForm({ dir: data.dir, m2: String(data.m2), reserva: String(data.reserva), proa_loaded: true });
      setProaStatus('ok');
      setProaMsg(`Cargado: ${data.dir} - ${data.m2} m2`);
    } else {
      setProaStatus('err');
      setProaMsg(`Codigo "${code}" no encontrado. Verifica el numero o carga manualmente.`);
    }
  };
  return (
    <Card title="Datos del Inmueble" subtitle="Informacion de la propiedad">
      <FormField label="Tiene codigo PROA?" required>
        <ToggleGroup
          value={form.hasProa ? 'si' : 'no'}
          onChange={v => { updateForm({ hasProa: v === 'si', proa_loaded: false }); setProaStatus(null); }}
          options={[{ value: 'si', label: 'Si, tengo el codigo' }, { value: 'no', label: 'No / Ingreso manual' }]}
        />
      </FormField>
      {form.hasProa && (
        <div className="mt-4">
          <FormField label="Codigo PROA" required hint="Proba con PROA-001 / PROA-002 / PROA-003 / PROA-004 / PROA-005">
            <div className="flex gap-2">
              <Input value={form.proa_code} placeholder="Ej: PROA-001" onChange={e => updateForm({ proa_code: e.target.value })} onKeyDown={e => e.key === 'Enter' && buscarPROA()} />
              <button type="button" onClick={buscarPROA} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold text-white whitespace-nowrap transition-all hover:opacity-90" style={{ background: 'var(--accent, #CC1C28)' }}>
                <Search size={14} />Buscar
              </button>
            </div>
          </FormField>
          {proaStatus === 'ok' && (<div className="mt-2 flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3"><CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" /><p className="text-sm text-green-700 font-medium">{proaMsg}</p></div>)}
          {proaStatus === 'err' && (<div className="mt-2 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3"><XCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" /><p className="text-sm text-red-700 font-medium">{proaMsg}</p></div>)}
        </div>
      )}
      <div className="mt-4">
        <FormField label="Direccion" required>
          <Input value={form.dir} placeholder="Calle, numero, piso, unidad" readOnly={form.proa_loaded} onChange={e => updateForm({ dir: e.target.value })} />
        </FormField>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <FormField label="Tipo de inmueble" required>
          <Select value={form.tipo_inmueble} onChange={e => updateForm({ tipo_inmueble: e.target.value })}>
            <option value="">Seleccionar...</option>
            {tiposInmueble.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </FormField>
        <FormField label="M2 totales" required>
          <Input type="number" value={form.m2} placeholder="Ej: 85" readOnly={form.proa_loaded} onChange={e => updateForm({ m2: e.target.value })} />
        </FormField>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <FormField label="Piso / Unidad"><Input value={form.piso} placeholder="Ej: 3B" onChange={e => updateForm({ piso: e.target.value })} /></FormField>
        <FormField label="Reserva"><Input type="number" value={form.reserva} placeholder="Monto" readOnly={form.proa_loaded} onChange={e => updateForm({ reserva: e.target.value })} /></FormField>
      </div>
    </Card>
  );
}
