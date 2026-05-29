import React, { useState } from 'react';
import StepProgress from '../components/aviso/StepProgress';
import AppFooter from '../components/aviso/AppFooter';
import SuccessScreen from '../components/aviso/SuccessScreen';
import { Card, FormField, Input, Select, Textarea, ToggleGroup, SectionLabel, Divider, TotalDisplay, InfoBox } from '../components/aviso/FormField';
import { BROKERS, TIPOS_INMUEBLE, PROA_DB, fmtUSD } from '../components/aviso/constants';
import { AlertTriangle, Search, CheckCircle, XCircle } from 'lucide-react';

const STEPS = ['General', 'Inmueble', 'Partes', 'Condiciones', 'Confirmar'];
const TOTAL_STEPS = STEPS.length;

// ─── Step 1: Datos Generales ───────────────────────────────────────────────
function RStep1({ form, updateForm }) {
  return (
    <Card title="Datos Generales" subtitle="Informacion basica de la reserva">
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
          <Select value={form.unidad} onChange={e => updateForm({ unidad: e.target.value, tipo_inmueble: '' })}>
            <option value="">Seleccionar...</option>
            <option value="residencial">Residencial</option>
            <option value="comercial">Comercial</option>
            <option value="emprendimientos">Emprendimientos</option>
          </Select>
        </FormField>
        <FormField label="Tipo de operacion" required>
          <Select value={form.tipo_op} onChange={e => updateForm({ tipo_op: e.target.value })}>
            <option value="">Seleccionar...</option>
            <option value="venta">Venta</option>
            <option value="alquiler">Alquiler</option>
          </Select>
        </FormField>
      </div>
      <FormField label="Observaciones">
        <Textarea value={form.obs} rows={3} placeholder="Notas adicionales sobre la reserva..." onChange={e => updateForm({ obs: e.target.value })} />
      </FormField>
    </Card>
  );
}

// ─── Step 2: Inmueble ──────────────────────────────────────────────────────
function RStep2({ form, updateForm }) {
  const [proaStatus, setProaStatus] = useState(null);
  const [proaMsg, setProaMsg] = useState('');
  const tiposInmueble = TIPOS_INMUEBLE[form.unidad] || [];

  const buscarPROA = () => {
    const code = form.proa_code.trim().toUpperCase();
    const data = PROA_DB[code];
    if (data) {
      updateForm({ dir: data.dir, m2: String(data.m2), proa_loaded: true });
      setProaStatus('ok');
      setProaMsg(`Cargado: ${data.dir} - ${data.m2} m2`);
    } else {
      setProaStatus('err');
      setProaMsg(`Codigo "${code}" no encontrado.`);
    }
  };

  return (
    <Card title="Datos del Inmueble" subtitle="Propiedad objeto de la reserva">
      <FormField label="Tiene codigo PROA?" required>
        <ToggleGroup
          value={form.hasProa ? 'si' : 'no'}
          onChange={v => { updateForm({ hasProa: v === 'si', proa_loaded: false }); setProaStatus(null); }}
          options={[{ value: 'si', label: 'Si, tengo el codigo' }, { value: 'no', label: 'No / Ingreso manual' }]}
        />
      </FormField>
      {form.hasProa && (
        <div className="mt-4">
          <FormField label="Codigo PROA" hint="Proba con PROA-001 ... PROA-005">
            <div className="flex gap-2">
              <Input value={form.proa_code} placeholder="Ej: PROA-001" onChange={e => updateForm({ proa_code: e.target.value })} onKeyDown={e => e.key === 'Enter' && buscarPROA()} />
              <button type="button" onClick={buscarPROA} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold text-white whitespace-nowrap" style={{ background: '#CC1C28' }}>
                <Search size={14} />Buscar
              </button>
            </div>
          </FormField>
          {proaStatus === 'ok' && <div className="mt-2 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3"><CheckCircle size={16} className="text-green-600" /><p className="text-sm text-green-700 font-medium">{proaMsg}</p></div>}
          {proaStatus === 'err' && <div className="mt-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3"><XCircle size={16} className="text-red-500" /><p className="text-sm text-red-700 font-medium">{proaMsg}</p></div>}
        </div>
      )}
      <div className="mt-4 space-y-4">
        <FormField label="Direccion" required>
          <Input value={form.dir} placeholder="Calle, numero, piso, unidad" readOnly={form.proa_loaded} onChange={e => updateForm({ dir: e.target.value })} />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Tipo de inmueble" required>
            <Select value={form.tipo_inmueble} onChange={e => updateForm({ tipo_inmueble: e.target.value })}>
              <option value="">Seleccionar...</option>
              {tiposInmueble.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </FormField>
          <FormField label="M2 totales">
            <Input type="number" value={form.m2} placeholder="Ej: 85" readOnly={form.proa_loaded} onChange={e => updateForm({ m2: e.target.value })} />
          </FormField>
        </div>
        <FormField label="Piso / Unidad">
          <Input value={form.piso} placeholder="Ej: 3B" onChange={e => updateForm({ piso: e.target.value })} />
        </FormField>
      </div>
    </Card>
  );
}

// ─── Step 3: Partes ────────────────────────────────────────────────────────
function ParteBlock({ title, prefix, form, updateForm, required }) {
  const f = k => form[`${prefix}_${k}`] || '';
  const u = (k, v) => updateForm({ [`${prefix}_${k}`]: v });
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <FormField label="Nombre / Razon social" required={required}>
          <Input value={f('nombre')} placeholder="Nombre completo o empresa" onChange={e => u('nombre', e.target.value)} />
        </FormField>
        <FormField label="Tipo de documento" required={required}>
          <Select value={f('tipo_doc')} onChange={e => u('tipo_doc', e.target.value)}>
            <option value="">Seleccionar...</option>
            <option>DNI</option><option>CUIL</option><option>CUIT</option><option>CI</option>
          </Select>
        </FormField>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <FormField label="Numero de documento" required={required}>
          <Input value={f('num_doc')} placeholder="Sin puntos ni guiones" onChange={e => u('num_doc', e.target.value)} />
        </FormField>
        <FormField label="Telefono">
          <Input value={f('tel')} placeholder="+54 11 XXXX-XXXX" onChange={e => u('tel', e.target.value)} />
        </FormField>
      </div>
      <FormField label="Email">
        <Input type="email" value={f('email')} placeholder="email@ejemplo.com" onChange={e => u('email', e.target.value)} />
      </FormField>
    </div>
  );
}

function RStep3({ form, updateForm }) {
  const isAlq = form.tipo_op === 'alquiler';
  return (
    <Card title="Datos de las Partes" subtitle="Propietario y reservante">
      <ParteBlock title={isAlq ? 'Locador (Propietario)' : 'Vendedor'} prefix="v" form={form} updateForm={updateForm} required />
      <Divider />
      <ParteBlock title={isAlq ? 'Locatario (Reservante)' : 'Comprador (Reservante)'} prefix="c" form={form} updateForm={updateForm} required />
    </Card>
  );
}

// ─── Step 4: Condiciones ────────────────────────────────────────────────────
function RStep4({ form, updateForm }) {
  const isAlq = form.tipo_op === 'alquiler';
  const precioTotal = parseFloat(form.precio_op) || 0;
  const senia = parseFloat(form.senia) || 0;
  const saldoRestante = precioTotal > 0 && senia > 0 ? precioTotal - senia : 0;

  return (
    <Card title="Condiciones Economicas" subtitle="Precio, seña y plazo de la reserva">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <FormField label={isAlq ? 'Precio mensual (U$S)' : 'Precio de venta (U$S)'} required>
          <Input type="number" value={form.precio_op} placeholder="0" onChange={e => updateForm({ precio_op: e.target.value })} />
        </FormField>
        {isAlq && (
          <FormField label="Duracion del contrato (meses)">
            <Input type="number" value={form.duracion_meses} placeholder="Ej: 24" onChange={e => updateForm({ duracion_meses: e.target.value })} />
          </FormField>
        )}
      </div>

      {precioTotal > 0 && !isAlq && (
        <TotalDisplay label="Precio de venta" value={`U$S ${fmtUSD(precioTotal)}`} />
      )}

      <Divider />
      <SectionLabel>Seña / Garantia</SectionLabel>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <FormField label="Monto de la seña (U$S)" required>
          <Input type="number" value={form.senia} placeholder="0" onChange={e => updateForm({ senia: e.target.value })} />
        </FormField>
        <FormField label="Moneda de la seña" required>
          <Select value={form.senia_moneda} onChange={e => updateForm({ senia_moneda: e.target.value })}>
            <option value="">Seleccionar...</option>
            <option value="usd">Dolares (U$S)</option>
            <option value="ars">Pesos ($)</option>
          </Select>
        </FormField>
      </div>

      {!isAlq && saldoRestante > 0 && (
        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex justify-between items-center text-sm mb-4">
          <span className="text-gray-500 font-medium">Saldo restante</span>
          <span className="font-black" style={{ color: '#CC1C28' }}>U$S {fmtUSD(saldoRestante)}</span>
        </div>
      )}

      <Divider />
      <SectionLabel>Plazo y Condiciones</SectionLabel>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <FormField label="Vigencia de la reserva" required>
          <Input type="date" value={form.vencimiento} onChange={e => updateForm({ vencimiento: e.target.value })} />
        </FormField>
        <FormField label="Fecha estimada de escritura / firma">
          <Input type="date" value={form.fecha_escritura} onChange={e => updateForm({ fecha_escritura: e.target.value })} />
        </FormField>
      </div>

      <FormField label="Condiciones especiales">
        <Textarea value={form.condiciones} rows={3} placeholder="Clausulas, condiciones de pago, etc..." onChange={e => updateForm({ condiciones: e.target.value })} />
      </FormField>
    </Card>
  );
}

// ─── Step 5: Confirmar ─────────────────────────────────────────────────────
function SumRow({ label, value }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-50 text-sm last:border-0">
      <span className="text-gray-500 shrink-0 mr-4">{label}</span>
      <span className="font-semibold text-gray-900 text-right">{value || '-'}</span>
    </div>
  );
}
function SumSection({ title, rows }) {
  return (
    <div className="mb-5">
      <div className="text-xs font-black uppercase tracking-widest mb-2 pb-2 border-b-2" style={{ color: '#CC1C28', borderColor: '#CC1C28' }}>{title}</div>
      <div className="space-y-0">{rows.map(([k, v], i) => <SumRow key={i} label={k} value={v} />)}</div>
    </div>
  );
}

function RStep5({ form }) {
  const g = k => form[k] || '-';
  const isAlq = form.tipo_op === 'alquiler';
  const unidadMap = { residencial: 'Residencial', comercial: 'Comercial', emprendimientos: 'Emprendimientos' };
  return (
    <>
      <Card title="Confirmacion de la Reserva" subtitle="Revisa los datos antes de enviar">
        <SumSection title="General" rows={[
          ['Broker', g('broker')],
          ['Unidad', unidadMap[form.unidad] || '-'],
          ['Tipo de operacion', isAlq ? 'Alquiler' : 'Venta'],
          ['Fecha', g('fecha')],
        ]} />
        <SumSection title="Inmueble" rows={[
          ['Direccion', g('dir')],
          ['Tipo', g('tipo_inmueble')],
          ['M2', form.m2 ? `${form.m2} m2` : '-'],
        ]} />
        <SumSection title={isAlq ? 'Locador' : 'Vendedor'} rows={[
          ['Nombre', g('v_nombre')],
          ['Documento', `${g('v_tipo_doc')} ${g('v_num_doc')}`],
          ['Telefono', g('v_tel')],
        ]} />
        <SumSection title={isAlq ? 'Locatario' : 'Comprador'} rows={[
          ['Nombre', g('c_nombre')],
          ['Documento', `${g('c_tipo_doc')} ${g('c_num_doc')}`],
          ['Telefono', g('c_tel')],
        ]} />
        <SumSection title="Condiciones" rows={[
          [isAlq ? 'Precio mensual' : 'Precio de venta', form.precio_op ? `U$S ${fmtUSD(parseFloat(form.precio_op))}` : '-'],
          ...(isAlq && form.duracion_meses ? [['Duracion', `${form.duracion_meses} meses`]] : []),
          ['Seña', form.senia ? `U$S ${fmtUSD(parseFloat(form.senia))} (${form.senia_moneda === 'ars' ? 'Pesos' : 'Dolares'})` : '-'],
          ['Vigencia reserva', g('vencimiento')],
          ...(form.fecha_escritura ? [['Escritura estimada', form.fecha_escritura]] : []),
          ...(form.condiciones ? [['Condiciones especiales', form.condiciones]] : []),
        ]} />
      </Card>
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4">
        <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-800"><strong>Al confirmar</strong>, la reserva se registrara y se notificara al area correspondiente.</p>
      </div>
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  fecha: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  broker: '', unidad: '', tipo_op: '', obs: '',
  hasProa: true, proa_code: '', proa_loaded: false,
  dir: '', tipo_inmueble: '', m2: '', piso: '',
  v_nombre: '', v_tipo_doc: '', v_num_doc: '', v_tel: '', v_email: '',
  c_nombre: '', c_tipo_doc: '', c_num_doc: '', c_tel: '', c_email: '',
  precio_op: '', duracion_meses: '', senia: '', senia_moneda: '',
  vencimiento: '', fecha_escritura: '', condiciones: '',
};

export default function ReservasIngreso() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [refNum, setRefNum] = useState('');
  const [errors, setErrors] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const updateForm = fields => setForm(prev => ({ ...prev, ...fields }));

  const validate = s => {
    const errs = [];
    if (s === 1) {
      if (!form.broker) errs.push('Selecciona un broker');
      if (!form.unidad) errs.push('Selecciona la unidad de negocio');
      if (!form.tipo_op) errs.push('Selecciona el tipo de operacion');
    }
    if (s === 2) {
      if (!form.dir.trim()) errs.push('Ingresa la direccion del inmueble');
      if (!form.tipo_inmueble) errs.push('Selecciona el tipo de inmueble');
    }
    if (s === 3) {
      if (!form.v_nombre.trim()) errs.push('Ingresa el nombre del vendedor/locador');
      if (!form.c_nombre.trim()) errs.push('Ingresa el nombre del comprador/locatario');
    }
    if (s === 4) {
      if (!form.precio_op) errs.push('Ingresa el precio de la operacion');
      if (!form.senia) errs.push('Ingresa el monto de la seña');
      if (!form.senia_moneda) errs.push('Selecciona la moneda de la seña');
      if (!form.vencimiento) errs.push('Ingresa la vigencia de la reserva');
    }
    return errs;
  };

  const goNext = () => {
    if (step === TOTAL_STEPS) {
      setRefNum(`RES-2026-${Math.floor(Math.random() * 9000) + 1000}`);
      setSubmitted(true);
      return;
    }
    const errs = validate(step);
    setErrors(errs);
    if (errs.length) return;
    setErrors([]);
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goBack = () => { setErrors([]); setStep(s => s - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  if (submitted) return (
    <SuccessScreen
      avisoNum={refNum}
      title="Reserva registrada!"
      subtitle="La reserva fue registrada y el area correspondiente fue notificada."
      btnLabel="Cargar nueva reserva"
      onReset={() => { setStep(1); setSubmitted(false); setRefNum(''); setErrors([]); setForm({ ...EMPTY_FORM }); }}
    />
  );

  return (
    <>
      <StepProgress steps={STEPS} currentStep={step} />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-28">
        {step === 1 && <RStep1 form={form} updateForm={updateForm} />}
        {step === 2 && <RStep2 form={form} updateForm={updateForm} />}
        {step === 3 && <RStep3 form={form} updateForm={updateForm} />}
        {step === 4 && <RStep4 form={form} updateForm={updateForm} />}
        {step === 5 && <RStep5 form={form} />}
      </main>
      <AppFooter step={step} total={TOTAL_STEPS} onNext={goNext} onBack={goBack} errors={errors} />
    </>
  );
}
