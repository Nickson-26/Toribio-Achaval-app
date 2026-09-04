'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { today } from '@/lib/utils'
import { Modal, FG, toast } from '@/components/ui'
import type { Reserva } from '@/lib/supabase'
import { UNIDADES_EMPRENDIMIENTOS, UNIDADES_COMERCIAL, type Categoria } from '@/lib/reservas'

/**
 * Alta y edición de una reserva.
 *
 * Se movió desde `Reservas.tsx` sin tocar su lógica de guardado: mismos
 * campos, mismo payload, misma tabla. Lo único que cambió es de dónde saca
 * las unidades ofrecidas — ahora de `lib/reservas.ts`, que es la única
 * definición de qué unidad pertenece a qué categoría.
 */

/** Unidades que se ofrecen al dar de alta dentro de cada categoría. */
const UNIDADES_POR_CATEGORIA: Record<Categoria, string[]> = {
  EMPRENDIMIENTOS: UNIDADES_EMPRENDIMIENTOS,
  RESIDENCIAL: [
    'PLAT. PALERMO', 'PLAT. BELGRANO', 'PLAT. CABALLITO', 'PLAT. RECOLETA',
    'PLAT. BARILOCHE', 'PLAT. ANGOSTURA', 'PLAT. PILAR',
    'DPTO DE BÚSQUEDA', 'RESIDENCIAL',
  ],
  COMERCIAL: UNIDADES_COMERCIAL,
}

export function ReservaModal({ tab, reserva, onClose, onSaved }: {
  tab: Categoria
  reserva?: Reserva; onClose:()=>void; onSaved:()=>void
}) {
  const isEdit = !!reserva
  const [saving,  setSaving]  = useState(false)
  const [fecha,   setFecha]   = useState(reserva?.fecha || today())
  const [dir,     setDir]     = useState(reserva?.direccion || '')
  const [broker,  setBroker]  = useState(reserva?.broker || '')
  const [cliente, setCliente] = useState(reserva?.cliente || '')
  const [op,      setOp]      = useState(reserva?.operacion || 'VENTA')
  const [unidad,  setUnidad]  = useState(reserva?.unidad || '')
  const [arsV,    setArs]     = useState(String(reserva?.monto_ars || ''))
  const [usdV,    setUsd]     = useState(String(reserva?.monto_usd || ''))
  const [pago,    setPago]    = useState(reserva?.modo_pago || 'EFECTIVO')
  const [firmo,   setFirmo]   = useState(reserva?.firmo || 'PENDIENTE')

  const unidades = UNIDADES_POR_CATEGORIA[tab] ?? [tab]

  async function save() {
    if (!dir.trim()) { toast('La dirección es obligatoria'); return }
    setSaving(true)
    try {
      const payload = {
        fecha, direccion: dir.trim(),
        broker: broker.trim()||null, cliente: cliente.trim()||null,
        operacion: op, unidad: unidad||unidades[0],
        monto_ars: arsV?parseFloat(arsV):null,
        monto_usd: usdV?parseFloat(usdV):null,
        modo_pago: pago, firmo,
      }
      if (isEdit && reserva) {
        await supabase.from('reservas').update(payload).eq('id', reserva.id)
        toast('✓ Reserva actualizada')
      } else {
        await supabase.from('reservas').insert(payload)
        toast('✓ Reserva creada')
      }
      onSaved()
    } catch (e: any) {
      toast('Error: '+(e.message||''))
    } finally { setSaving(false) }
  }

  return (
    <Modal
      title={isEdit ? `Editar — ${reserva?.direccion?.slice(0,30)}` : `Nueva reserva — ${tab.charAt(0)+tab.slice(1).toLowerCase()}`}
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" style={{ background:'#1a6bc8', borderColor:'#1a6bc8' }} onClick={save} disabled={saving}>
          {saving?'Guardando…':isEdit?'Guardar cambios':'Crear reserva'}
        </button>
      </>}
    >
      <div className="form-grid">
        <FG label="Fecha *"><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></FG>
        <FG label="Operación *">
          <select value={op} onChange={e=>setOp(e.target.value)}>
            <option value="VENTA">Venta</option>
            <option value="ALQUILER">Alquiler</option>
          </select>
        </FG>
        <FG label="Dirección *" full><input placeholder="Ej: Av. Santa Fe 1234 3° A" value={dir} onChange={e=>setDir(e.target.value)}/></FG>
        <FG label="Broker"><input placeholder="Nombre del broker" value={broker} onChange={e=>setBroker(e.target.value)}/></FG>
        <FG label="Cliente"><input placeholder="Nombre del cliente" value={cliente} onChange={e=>setCliente(e.target.value)}/></FG>
        <FG label="Unidad">
          <select value={unidad} onChange={e=>setUnidad(e.target.value)}>
            {unidades.map(u=><option key={u} value={u}>{u}</option>)}
          </select>
        </FG>
        <FG label="Forma de pago">
          <select value={pago} onChange={e=>setPago(e.target.value)}>
            {['EFECTIVO','TRANSFERENCIA','CHEQUE','OTRO'].map(p=><option key={p}>{p}</option>)}
          </select>
        </FG>
        <FG label="Monto ARS"><input type="number" min="0" placeholder="0" value={arsV} onChange={e=>setArs(e.target.value)}/></FG>
        <FG label="Monto USD"><input type="number" min="0" placeholder="0" value={usdV} onChange={e=>setUsd(e.target.value)}/></FG>
        <FG label="Estado firma">
          <select value={firmo} onChange={e=>setFirmo(e.target.value)}>
            <option value="PENDIENTE">Pendiente</option>
            <option value="FIRMADO">Firmado</option>
          </select>
        </FG>
      </div>
    </Modal>
  )
}
