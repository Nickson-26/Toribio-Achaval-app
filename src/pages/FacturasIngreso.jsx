import React, { useState } from 'react';
import StepProgress from '../components/aviso/StepProgress';
import AppFooter from '../components/aviso/AppFooter';
import SuccessScreen from '../components/aviso/SuccessScreen';
import { Card, FormField, Input, Select, Textarea, ToggleGroup, SectionLabel, Divider, TotalDisplay } from '../components/aviso/FormField';
import { BROKERS, fmtUSD } from '../components/aviso/constants';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';

const STEPS = ['Comprobante', 'Receptor', 'Conceptos', 'Confirmar'];
const TOTAL_STEPS = STEPS.length;

// ─── Step 1: Comprobante ───────────────────────────────────────────────────
function FStep1({ form, updateForm }) {
  return (
    <Card title="Datos del Comprobante" subtitle="Tipo de factura y punto de venta">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <FormField label="Fecha de emision" required>
          <Input type="date" value={form.fecha_emision} onChange={e => updateForm({ fecha_emision: e.target.value })} />
        </FormField>
        <FormField label="Broker responsable" required>
          <Select value={form.broker} onChange={e => updateForm({ broker: e.target.value })}>
            <option value="">Seleccionar broker...</option>
            {BROKERS.map(b => <option key={b} value={b}>{b}</option>)}
          </Select>
        </FormField>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <FormField label="Tipo de comprobante" required>
          <Select value={form.tipo_comp} onChange={e => updateForm({ tipo_comp: e.target.value })}>
            <option value="">Seleccionar...</option>
            <option value="A">Factura A</option>
            <option value="B">Factura B</option>
            <option value="C">Factura C</option>
            <option value="recibo">Recibo</option>
          </Select>
        </FormField>
        <FormField label="Punto de venta" required>
          <Select value={form.punto_venta} onChange={e => updateForm({ punto_venta: e.target.value })}>
            <option value="">Seleccionar...</option>
            <option value="0001">0001 - Casa Central</option>
            <option value="0002">0002 - Palermo</option>
            <option value="0003">0003 - Belgrano</option>
            <option value="0004">0004 - Recoleta</option>
            <option value="0005">0005 - Pilar</option>
          </Select>
        </FormField>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <FormField label="Condicion de pago" required>
          <Select value={form.cond_pago} onChange={e => updateForm({ cond_pago: e.target.value })}>
            <option value="">Seleccionar...</option>
            <option value="contado">Contado</option>
            <option value="cuenta_corriente">Cuenta corriente</option>
            <option value="transferencia">Transferencia bancaria</option>
            <option value="cheque">Cheque</option>
          </Select>
        </FormField>
        <FormField label="Moneda" required>
          <ToggleGroup
            value={form.moneda}
            onChange={v => updateForm({ moneda: v })}
            options={[{ value: 'usd', label: 'U$S Dolares' }, { value: 'ars', label: '$ Pesos' }]}
          />
        </FormField>
      </div>
      <FormField label="Aviso de ingreso asociado (opcional)" hint="Si esta factura corresponde a un aviso registrado">
        <Input value={form.aviso_ref} placeholder="Ej: AI-2026-RES-412" onChange={e => updateForm({ aviso_ref: e.target.value })} />
      </FormField>
    </Card>
  );
}

// ─── Step 2: Receptor ──────────────────────────────────────────────────────
function FStep2({ form, updateForm }) {
  const esFactA = form.tipo_comp === 'A';
  return (
    <Card title="Datos del Receptor" subtitle="Cliente o empresa a quien se factura">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <FormField label="Razon social / Nombre" required>
          <Input value={form.rec_nombre} placeholder="Nombre completo o empresa" onChange={e => updateForm({ rec_nombre: e.target.value })} />
        </FormField>
        <FormField label="Tipo de documento" required>
          <Select value={form.rec_tipo_doc} onChange={e => updateForm({ rec_tipo_doc: e.target.value })}>
            <option value="">Seleccionar...</option>
            <option>DNI</option><option>CUIL</option><option>CUIT</option><option>CI</option><option>Pasaporte</option>
          </Select>
        </FormField>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <FormField label="Numero de documento" required>
          <Input value={form.rec_num_doc} placeholder="Sin puntos ni guiones" onChange={e => updateForm({ rec_num_doc: e.target.value })} />
        </FormField>
        {esFactA && (
          <FormField label="Condicion IVA" required>
            <Select value={form.rec_cond_iva} onChange={e => updateForm({ rec_cond_iva: e.target.value })}>
              <option value="">Seleccionar...</option>
              <option value="ri">Responsable Inscripto</option>
              <option value="mono">Monotributista</option>
              <option value="exento">Exento</option>
              <option value="consumidor">Consumidor Final</option>
            </Select>
          </FormField>
        )}
      </div>
      <Divider />
      <SectionLabel>Domicilio fiscal</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <FormField label="Calle y numero">
          <Input value={form.rec_dir} placeholder="Av. Corrientes 1234" onChange={e => updateForm({ rec_dir: e.target.value })} />
        </FormField>
        <FormField label="Localidad / Ciudad">
          <Input value={form.rec_ciudad} placeholder="Buenos Aires" onChange={e => updateForm({ rec_ciudad: e.target.value })} />
        </FormField>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Email">
          <Input type="email" value={form.rec_email} placeholder="facturacion@empresa.com" onChange={e => updateForm({ rec_email: e.target.value })} />
        </FormField>
        <FormField label="Telefono">
          <Input value={form.rec_tel} placeholder="+54 11 XXXX-XXXX" onChange={e => updateForm({ rec_tel: e.target.value })} />
        </FormField>
      </div>
    </Card>
  );
}

// ─── Step 3: Conceptos ─────────────────────────────────────────────────────
function FStep3({ form, updateForm }) {
  const isUSD = form.moneda === 'usd';
  const currency = isUSD ? 'U$S' : '$';
  const fmt = n => isUSD ? fmtUSD(n) : Math.round(n).toLocaleString('es-AR');

  const addItem = () => {
    updateForm({ items: [...form.items, { desc: '', cantidad: '1', precio: '', alicuota: '21' }] });
  };

  const removeItem = idx => {
    updateForm({ items: form.items.filter((_, i) => i !== idx) });
  };

  const updateItem = (idx, field, value) => {
    const newItems = form.items.map((item, i) => i === idx ? { ...item, [field]: value } : item);
    updateForm({ items: newItems });
  };

  const subtotal = form.items.reduce((acc, item) => {
    return acc + (parseFloat(item.cantidad) || 0) * (parseFloat(item.precio) || 0);
  }, 0);

  const ivaTotal = form.items.reduce((acc, item) => {
    const base = (parseFloat(item.cantidad) || 0) * (parseFloat(item.precio) || 0);
    return acc + base * (parseFloat(item.alicuota) || 0) / 100;
  }, 0);

  const total = subtotal + ivaTotal;

  return (
    <>
      <Card title="Conceptos y Montos" subtitle="Detalle de los servicios a facturar">
        <div className="space-y-3 mb-4">
          {form.items.map((item, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: '#CC1C28' }}>Item {idx + 1}</span>
                {form.items.length > 1 && (
                  <button onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <FormField label="Descripcion" required>
                <Input value={item.desc} placeholder="Ej: Honorarios por intermediacion inmobiliaria" onChange={e => updateItem(idx, 'desc', e.target.value)} />
              </FormField>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <FormField label="Cantidad">
                  <Input type="number" value={item.cantidad} min="1" onChange={e => updateItem(idx, 'cantidad', e.target.value)} />
                </FormField>
                <FormField label={`Precio unit. (${currency})`} required>
                  <Input type="number" value={item.precio} placeholder="0" onChange={e => updateItem(idx, 'precio', e.target.value)} />
                </FormField>
                <FormField label="IVA %">
                  <Select value={item.alicuota} onChange={e => updateItem(idx, 'alicuota', e.target.value)}>
                    <option value="0">0%</option>
                    <option value="10.5">10.5%</option>
                    <option value="21">21%</option>
                    <option value="27">27%</option>
                  </Select>
                </FormField>
              </div>
              {parseFloat(item.precio) > 0 && (
                <div className="mt-2 text-xs text-right text-gray-500">
                  Subtotal: <span className="font-bold text-gray-800">{currency} {fmt((parseFloat(item.cantidad) || 0) * (parseFloat(item.precio) || 0))}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <button onClick={addItem} className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm font-semibold text-gray-500 hover:border-red-300 hover:text-red-500 transition-all">
          <Plus size={15} />Agregar item
        </button>

        {subtotal > 0 && (
          <>
            <Divider />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal neto</span>
                <span className="font-semibold text-gray-800">{currency} {fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>IVA</span>
                <span className="font-semibold text-gray-800">{currency} {fmt(ivaTotal)}</span>
              </div>
            </div>
            <TotalDisplay label="Total a facturar" value={`${currency} ${fmt(total)}`} />
          </>
        )}
      </Card>

      {form.tipo_comp === 'A' && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 mb-4 text-sm text-blue-800">
          <strong>Factura A:</strong> aplica IVA discriminado. Asegurate de completar la condicion IVA del receptor en el paso anterior.
        </div>
      )}
    </>
  );
}

// ─── Step 4: Confirmar ─────────────────────────────────────────────────────
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

function FStep4({ form }) {
  const g = k => form[k] || '-';
  const isUSD = form.moneda === 'usd';
  const currency = isUSD ? 'U$S' : '$';
  const fmt = n => isUSD ? fmtUSD(n) : Math.round(n).toLocaleString('es-AR');

  const subtotal = form.items.reduce((acc, item) => acc + (parseFloat(item.cantidad) || 0) * (parseFloat(item.precio) || 0), 0);
  const ivaTotal = form.items.reduce((acc, item) => {
    const base = (parseFloat(item.cantidad) || 0) * (parseFloat(item.precio) || 0);
    return acc + base * (parseFloat(item.alicuota) || 0) / 100;
  }, 0);
  const total = subtotal + ivaTotal;

  const condPagoLabel = { contado: 'Contado', cuenta_corriente: 'Cuenta corriente', transferencia: 'Transferencia bancaria', cheque: 'Cheque' };
  const compLabel = { A: 'Factura A', B: 'Factura B', C: 'Factura C', recibo: 'Recibo' };

  return (
    <>
      <Card title="Confirmacion de la Factura" subtitle="Revisa los datos antes de emitir">
        <SumSection title="Comprobante" rows={[
          ['Tipo', compLabel[form.tipo_comp] || '-'],
          ['Punto de venta', form.punto_venta || '-'],
          ['Fecha de emision', g('fecha_emision')],
          ['Broker', g('broker')],
          ['Condicion de pago', condPagoLabel[form.cond_pago] || '-'],
          ...(form.aviso_ref ? [['Aviso asociado', form.aviso_ref]] : []),
        ]} />
        <SumSection title="Receptor" rows={[
          ['Nombre', g('rec_nombre')],
          ['Documento', `${g('rec_tipo_doc')} ${g('rec_num_doc')}`],
          ['Email', g('rec_email')],
          ...(form.rec_cond_iva ? [['Condicion IVA', form.rec_cond_iva]] : []),
        ]} />
        <SumSection title="Conceptos" rows={[
          ...form.items.filter(i => i.desc).map((item, idx) => [`Item ${idx + 1}`, `${item.desc} x${item.cantidad} — ${currency} ${fmt((parseFloat(item.cantidad) || 0) * (parseFloat(item.precio) || 0))}`]),
          ['Subtotal neto', `${currency} ${fmt(subtotal)}`],
          ['IVA', `${currency} ${fmt(ivaTotal)}`],
          ['TOTAL', `${currency} ${fmt(total)}`],
        ]} />
      </Card>
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4">
        <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-800"><strong>Al confirmar</strong>, la factura se registrara en el sistema y se notificara al area de administracion.</p>
      </div>
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  fecha_emision: new Date().toISOString().split('T')[0],
  broker: '', tipo_comp: '', punto_venta: '', cond_pago: '', moneda: 'usd', aviso_ref: '',
  rec_nombre: '', rec_tipo_doc: '', rec_num_doc: '', rec_cond_iva: '',
  rec_dir: '', rec_ciudad: '', rec_email: '', rec_tel: '',
  items: [{ desc: '', cantidad: '1', precio: '', alicuota: '21' }],
};

export default function FacturasIngreso() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [refNum, setRefNum] = useState('');
  const [errors, setErrors] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const updateForm = fields => setForm(prev => ({ ...prev, ...fields }));

  const validate = s => {
    const errs = [];
    if (s === 1) {
      if (!form.fecha_emision) errs.push('Ingresa la fecha de emision');
      if (!form.broker) errs.push('Selecciona el broker responsable');
      if (!form.tipo_comp) errs.push('Selecciona el tipo de comprobante');
      if (!form.punto_venta) errs.push('Selecciona el punto de venta');
      if (!form.cond_pago) errs.push('Selecciona la condicion de pago');
    }
    if (s === 2) {
      if (!form.rec_nombre.trim()) errs.push('Ingresa el nombre del receptor');
      if (!form.rec_tipo_doc) errs.push('Selecciona el tipo de documento');
      if (!form.rec_num_doc.trim()) errs.push('Ingresa el numero de documento');
    }
    if (s === 3) {
      const hasItem = form.items.some(i => i.desc.trim() && parseFloat(i.precio) > 0);
      if (!hasItem) errs.push('Agrega al menos un concepto con descripcion y precio');
    }
    return errs;
  };

  const goNext = () => {
    if (step === TOTAL_STEPS) {
      const pv = form.punto_venta || '0001';
      const num = String(Math.floor(Math.random() * 90000) + 10000);
      setRefNum(`FACT-${pv}-${num}`);
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
      title="Factura registrada!"
      subtitle="La factura fue registrada y el area de administracion fue notificada."
      btnLabel="Cargar nueva factura"
      onReset={() => { setStep(1); setSubmitted(false); setRefNum(''); setErrors([]); setForm({ ...EMPTY_FORM }); }}
    />
  );

  return (
    <>
      <StepProgress steps={STEPS} currentStep={step} />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-28">
        {step === 1 && <FStep1 form={form} updateForm={updateForm} />}
        {step === 2 && <FStep2 form={form} updateForm={updateForm} />}
        {step === 3 && <FStep3 form={form} updateForm={updateForm} />}
        {step === 4 && <FStep4 form={form} />}
      </main>
      <AppFooter step={step} total={TOTAL_STEPS} onNext={goNext} onBack={goBack} errors={errors} />
    </>
  );
}
