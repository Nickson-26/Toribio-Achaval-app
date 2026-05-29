import React, { useState } from 'react';
import StepProgress from '../components/aviso/StepProgress';
import AppFooter from '../components/aviso/AppFooter';
import Step1General from '../components/aviso/Step1General';
import Step2Inmueble from '../components/aviso/Step2Inmueble';
import Step3Montos from '../components/aviso/Step3Montos';
import Step4Partes from '../components/aviso/Step4Partes';
import Step5Canal from '../components/aviso/Step5Canal';
import Step6Participantes from '../components/aviso/Step6Participantes';
import Step7Confirmar from '../components/aviso/Step7Confirmar';
import SuccessScreen from '../components/aviso/SuccessScreen';

const STEPS = ['General', 'Inmueble', 'Montos', 'Partes', 'Canal', 'Participantes', 'Confirmar'];
const TOTAL_STEPS = STEPS.length;

export default function AvisoIngreso() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [avisoNum, setAvisoNum] = useState('');
  const [errors, setErrors] = useState([]);
  const [form, setForm] = useState({
    fecha: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    broker: '', unidad: '', plataforma: '', tipo_op: '',
    op_usd: '', alq_usd: '', alq_meses: '', hon_moneda: 'usd', hon_usd: '', hon_ars: '',
    hasProa: true, proa_code: '', proa_loaded: false,
    dir: '', tipo_inmueble: '', m2: '', piso: '', reserva: '',
    pct_v: '2', pct_c: '4',
    v_pago_ars: '', v_pago_usd: '', v_pago_tc: '', c_pago_ars: '', c_pago_usd: '', c_pago_tc: '',
    v_pendiente: '', c_pendiente: '',
    v_nombre: '', v_sexo: '', v_tipo_doc: '', v_num_doc: '', v_tel: '', v_email: '',
    c_nombre: '', c_sexo: '', c_tipo_doc: '', c_num_doc: '', c_tel: '', c_email: '',
    canal: '', obs_canal: '', hasColega: false,
    col_nombre: '', col_inmob: '', col_tel: '', col_email: '', col_mat: '', col_parte: '',
    prod: '', prod_pct: '10', coord: '', tas: '', vend: '',
  });

  const updateForm = (fields) => setForm(prev => ({ ...prev, ...fields }));

  const totalOpUSD = (() => {
    const tipo = form.tipo_op;
    if (tipo.includes('alquiler')) return (parseFloat(form.alq_usd) || 0) * (parseFloat(form.alq_meses) || 0);
    if (tipo.includes('consultor')) return form.hon_moneda === 'usd' ? parseFloat(form.hon_usd) || 0 : 0;
    return parseFloat(form.op_usd) || 0;
  })();

  const validate = (s) => {
    const errs = [];
    if (s === 1) {
      if (!form.broker) errs.push('Selecciona un broker');
      if (!form.unidad) errs.push('Selecciona la unidad de negocio');
      if (!form.plataforma) errs.push('Selecciona la plataforma');
      if (!form.tipo_op) errs.push('Selecciona el tipo de operacion');
      const isConsult = form.tipo_op.includes('consultor');
      if (isConsult && form.hon_moneda === 'ars') {
        if (!(parseFloat(form.hon_ars) > 0)) errs.push('Ingresa el monto del servicio en pesos');
      } else if (totalOpUSD === 0) errs.push('Ingresa el monto de la operacion en dolares');
    }
    if (s === 2) {
      if (!form.tipo_op.includes('consultor')) {
        if (!form.dir.trim()) errs.push('Ingresa la direccion del inmueble');
        if (!form.tipo_inmueble) errs.push('Selecciona el tipo de inmueble');
        if (!form.m2) errs.push('Ingresa los m2');
      }
    }
    if (s === 3) {
      if (!form.pct_v) errs.push('Ingresa el % de comision del vendedor');
      if (!form.pct_c) errs.push('Ingresa el % de comision del comprador');
    }
    if (s === 4) {
      if (['v_nombre','v_sexo','v_tipo_doc','v_num_doc','v_tel','v_email'].some(f => !form[f]?.trim()))
        errs.push('Completa todos los campos de la parte principal');
      if (form.tipo_op === 'venta' && ['c_nombre','c_sexo','c_tipo_doc','c_num_doc','c_tel','c_email'].some(f => !form[f]?.trim()))
        errs.push('En Venta los datos del comprador son obligatorios');
    }
    if (s === 5) {
      if (!form.canal) errs.push('Selecciona el canal de arribo');
      const NON_PAID = ['referido','proactividad','cliente','firma','colega_ext'];
      if (NON_PAID.includes(form.canal) && !form.obs_canal.trim()) errs.push('Ingresa las observaciones');
      if (form.hasColega) {
        if (!form.col_nombre.trim()) errs.push('Ingresa el nombre del colega');
        if (!form.col_inmob.trim()) errs.push('Ingresa la inmobiliaria del colega');
        if (!form.col_parte) errs.push('Selecciona por que parte opera el colega');
      }
    }
    if (s === 6) {
      if (!form.prod && !form.coord && !form.tas && !form.vend) errs.push('Asigna al menos un participante');
    }
    return errs;
  };

  const goNext = () => {
    if (step === TOTAL_STEPS) {
      const uCodes = { residencial: 'RES', comercial: 'COM', emprendimientos: 'EMP' };
      const cod = uCodes[form.unidad] || 'GEN';
      setAvisoNum(`AI-2026-${cod}-${Math.floor(Math.random() * 900) + 100}`);
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
      avisoNum={avisoNum}
      onReset={() => { setStep(1); setSubmitted(false); setAvisoNum(''); setErrors([]); setForm(f => ({ ...f, broker: '', unidad: '', plataforma: '', tipo_op: '' })); }}
    />
  );

  const stepProps = { form, updateForm, totalOpUSD, errors };
  return (
    <>
      <StepProgress steps={STEPS} currentStep={step} />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-28">
        {step === 1 && <Step1General {...stepProps} />}
        {step === 2 && <Step2Inmueble {...stepProps} />}
        {step === 3 && <Step3Montos {...stepProps} />}
        {step === 4 && <Step4Partes {...stepProps} />}
        {step === 5 && <Step5Canal {...stepProps} />}
        {step === 6 && <Step6Participantes {...stepProps} />}
        {step === 7 && <Step7Confirmar form={form} totalOpUSD={totalOpUSD} />}
      </main>
      <AppFooter step={step} total={TOTAL_STEPS} onNext={goNext} onBack={goBack} errors={errors} />
    </>
  );
}
