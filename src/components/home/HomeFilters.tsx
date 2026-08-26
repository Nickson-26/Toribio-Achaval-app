'use client'
import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Select, Modal, Button, Field } from '@/design/primitives'
import { MESES } from '@/lib/utils'
import type { FiltrosHome } from '@/lib/home'

/**
 * Filtros del Inicio — secundarios, nunca protagonistas.
 *
 * Dos composiciones distintas, no una comprimida:
 *   · escritorio: los selects en línea, al lado del saludo;
 *   · mobile: un botón compacto que abre una hoja. Dos selects a ancho completo
 *     dominaban la primera pantalla de 390px y empujaban el resumen fuera del
 *     primer recorrido.
 *
 * El selector de año sólo existe si hay más de un año en los datos.
 */
export function HomeFilters({
  filtros, onChange, anios, unidades, mostrarAnio,
}: {
  filtros: FiltrosHome
  onChange: (p: Partial<FiltrosHome>) => void
  anios: string[]
  unidades: string[]
  mostrarAnio: boolean
}) {
  const [sheet, setSheet] = useState(false)

  const activos =
    (filtros.mes !== 'all' ? 1 : 0) +
    (filtros.unidad !== 'all' ? 1 : 0) +
    (filtros.anio !== 'all' ? 1 : 0)

  const selects = (
    <>
      {mostrarAnio && (
        <Select value={filtros.anio} onChange={e => onChange({ anio: e.target.value })} aria-label="Año">
          <option value="all">Todos los años</option>
          {anios.map(a => <option key={a} value={a}>{a}</option>)}
        </Select>
      )}
      <Select value={filtros.mes} onChange={e => onChange({ mes: e.target.value })} aria-label="Mes">
        <option value="all">Todos los meses</option>
        {MESES.map((m, i) => (
          <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
        ))}
      </Select>
      <Select value={filtros.unidad} onChange={e => onChange({ unidad: e.target.value })} aria-label="Unidad">
        <option value="all">Todas las unidades</option>
        {unidades.map(u => <option key={u} value={u}>{u}</option>)}
      </Select>
    </>
  )

  return (
    <>
      {/* Escritorio */}
      <div className="ta-home__filtros ta-only-desktop">{selects}</div>

      {/* Mobile */}
      <button
        className="ta-home__filtros-btn ta-only-mobile"
        onClick={() => setSheet(true)}
        aria-label={`Filtros${activos ? `, ${activos} activos` : ''}`}
      >
        <SlidersHorizontal size={15} aria-hidden />
        <span>Filtros</span>
        {activos > 0 && <span className="ta-home__filtros-dot">{activos}</span>}
      </button>

      {sheet && (
        <Modal
          title="Filtros"
          size="sm"
          onClose={() => setSheet(false)}
          footer={<>
            <Button
              variant="ghost"
              onClick={() => onChange({ mes: 'all', unidad: 'all', anio: 'all' })}
              disabled={activos === 0}
            >Limpiar</Button>
            <Button variant="primary" onClick={() => setSheet(false)}>Aplicar</Button>
          </>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {mostrarAnio && (
              <Field label="Año">
                <Select value={filtros.anio} onChange={e => onChange({ anio: e.target.value })}>
                  <option value="all">Todos los años</option>
                  {anios.map(a => <option key={a} value={a}>{a}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Mes">
              <Select value={filtros.mes} onChange={e => onChange({ mes: e.target.value })}>
                <option value="all">Todos los meses</option>
                {MESES.map((m, i) => (
                  <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                ))}
              </Select>
            </Field>
            <Field label="Unidad">
              <Select value={filtros.unidad} onChange={e => onChange({ unidad: e.target.value })}>
                <option value="all">Todas las unidades</option>
                {unidades.map(u => <option key={u} value={u}>{u}</option>)}
              </Select>
            </Field>
          </div>
        </Modal>
      )}
    </>
  )
}
