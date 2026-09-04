'use client'
import { useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Select, Modal, Button, Field } from '@/design/primitives'
import { MESES } from '@/lib/utils'
import type { FiltrosHome } from '@/lib/home'

/**
 * Filtros del Inicio — un solo control, en las dos composiciones.
 *
 * Antes escritorio mostraba dos o tres selects permanentes al lado del saludo
 * ("Todos los meses", "Todas las unidades"). Ocupaban el lugar más caro de la
 * pantalla para decir que NO había ningún filtro puesto: información cero,
 * presencia máxima, y el aire inconfundible de una barra de ERP.
 *
 * Ahora es el mismo botón que ya usa Facturación —badge con la cantidad, hoja
 * con los campos— y lo que sí queda a la vista son los filtros ACTIVOS, como
 * chips que se quitan de a uno. Progressive disclosure de verdad: en reposo
 * no hay nada; con intención está todo; con filtro puesto se ve cuál y cómo
 * sacarlo.
 *
 * El selector de año sólo existe si hay más de un año en los datos.
 */

/** Etiqueta de un filtro puesto. `null` = ese filtro no está activo. */
function chipsDe(f: FiltrosHome): { clave: keyof FiltrosHome; label: string }[] {
  const out: { clave: keyof FiltrosHome; label: string }[] = []
  if (f.anio !== 'all') out.push({ clave: 'anio', label: f.anio })
  if (f.mes !== 'all') {
    const i = Number(f.mes) - 1
    out.push({ clave: 'mes', label: MESES[i] ?? f.mes })
  }
  if (f.unidad !== 'all') out.push({ clave: 'unidad', label: f.unidad })
  return out
}

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
  const chips = chipsDe(filtros)
  const activos = chips.length

  const limpiar = () => onChange({ mes: 'all', unidad: 'all', anio: 'all' })

  return (
    <div className="ta-hfiltros">
      {/* Los chips van ANTES del botón: se leen como "esto es lo que estás
          mirando", y el botón queda como la puerta a cambiarlo. */}
      {chips.map(c => (
        <button
          key={c.clave}
          type="button"
          className="ta-hfiltros__chip"
          onClick={() => onChange({ [c.clave]: 'all' } as Partial<FiltrosHome>)}
          aria-label={`Quitar filtro ${c.label}`}
        >
          {c.label}
          <X size={12} aria-hidden />
        </button>
      ))}

      <button
        type="button"
        className="ta-hfiltros__btn"
        onClick={() => setSheet(true)}
        aria-label={`Filtros${activos ? `, ${activos} activos` : ''}`}
      >
        <SlidersHorizontal size={15} aria-hidden />
        <span>Filtros</span>
        {activos > 0 && <span className="ta-hfiltros__dot">{activos}</span>}
      </button>

      {sheet && (
        <Modal
          title="Filtros"
          size="sm"
          onClose={() => setSheet(false)}
          footer={<>
            <Button variant="ghost" onClick={limpiar} disabled={activos === 0}>Limpiar</Button>
            <Button variant="primary" onClick={() => setSheet(false)}>Aplicar</Button>
          </>}
        >
          <div className="ta-hfiltros__campos">
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
    </div>
  )
}
