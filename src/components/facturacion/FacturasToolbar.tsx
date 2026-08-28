'use client'
import { useState } from 'react'
import { useEsMobile } from '@/design/useEsMobile'
import { SlidersHorizontal, X, Plus, Download } from 'lucide-react'
import {
  Button, IconButton, SearchInput, Select, Field, Modal, StatusBadge,
} from '@/design/primitives'
import { estadoLabel } from '@/design/status'
import type { ComprobanteEstado } from '@/lib/supabase'
import {
  chipsActivos, contarFiltros, hayFiltros, FILTROS_INICIALES,
  TIPOS_FACTURA, TIPO_LABEL, TIPO_CORTO,
  type FiltrosFacturacion, type ChipFiltro, type TipoFactura,
} from '@/lib/facturacion'

/**
 * Explorar facturas: vistas, buscador y una puerta a los filtros.
 *
 * Nada más. La versión anterior tenía a la vista los estados como chips, año,
 * mes, moneda, unidad, punto de venta, exportación y dos CTA — un panel de
 * control que había que atravesar antes de ver una factura.
 *
 * Ahora lo permanente es: en qué tipo estoy, qué busco, y un botón de filtros
 * con badge. Todo lo demás vive dentro de la hoja. Lo que sí queda visible son
 * los filtros ACTIVOS, porque sin eso una lista corta es indistinguible de una
 * vacía y el usuario no ve por qué le faltan filas.
 */
export function FacturasToolbar({
  filtros, onChange, vista, onVista, conteos,
  estados, anios, unidades, puntosVenta,
  puedeCrear, onNueva, onExportar,
}: {
  filtros: FiltrosFacturacion
  onChange: (p: Partial<FiltrosFacturacion>) => void
  vista: TipoFactura
  onVista: (t: TipoFactura) => void
  conteos: Record<TipoFactura, number>
  estados: ComprobanteEstado[]
  anios: string[]
  unidades: string[]
  puntosVenta: string[]
  puedeCrear: boolean
  onNueva: () => void
  onExportar: () => void
}) {
  const [sheet, setSheet] = useState(false)
  const esMobile = useEsMobile()
  const activos = contarFiltros(filtros)
  const chips = chipsActivos(filtros, estadoLabel)

  function toggleEstado(e: ComprobanteEstado) {
    onChange({
      estados: filtros.estados.includes(e)
        ? filtros.estados.filter(x => x !== e)
        : [...filtros.estados, e],
    })
  }

  function quitar(chip: ChipFiltro) {
    if (chip.clave === 'estados') {
      onChange({ estados: filtros.estados.filter(e => e !== chip.valor) })
    } else {
      onChange({ [chip.clave]: FILTROS_INICIALES[chip.clave] } as Partial<FiltrosFacturacion>)
    }
  }

  const limpiarTodo = () => onChange(FILTROS_INICIALES)

  return (
    <div className="ta-fbar">
      {/* Las vistas son el contexto de trabajo, no un select escondido: de
          ellas hereda el tipo la factura que se crea desde acá. */}
      {/* Un solo control, no cuatro botones: la cápsula es un elemento único
          que se desplaza. --i lleva el índice activo y --n la cantidad, así
          el CSS calcula la posición sin medir nada en JS. */}
      <div
        className="ta-vistas" role="tablist" aria-label="Tipo de factura"
        style={{
          ['--n' as string]: TIPOS_FACTURA.length,
          ['--i' as string]: TIPOS_FACTURA.indexOf(vista),
        }}
      >
        <span className="ta-vistas__capsula" aria-hidden />
        {TIPOS_FACTURA.map(t => (
          <button
            key={t}
            role="tab"
            aria-selected={vista === t}
            className={`ta-vista${vista === t ? ' is-on' : ''}`}
            onClick={() => onVista(t)}
          >
            {/* "Facturas A" en cuatro pestañas no entra en 390px. En mobile
                queda sólo la letra; el resto se esconde por CSS. */}
            <span className="ta-vista__label--largo">Facturas&nbsp;</span>
            {TIPO_CORTO[t]}
            <span className="ta-vista__n">{conteos[t]}</span>
          </button>
        ))}
      </div>

      <div className="ta-fbar__row">
        <SearchInput
          value={filtros.buscar}
          onChange={v => onChange({ buscar: v })}
          placeholder={esMobile ? 'Buscar…' : 'Buscar factura o cliente…'}
          ariaLabel="Buscar facturas"
          className="ta-fbar__search"
        />

        <button
          type="button"
          className="ta-fbar__filtros"
          onClick={() => setSheet(true)}
          aria-label={`Filtros${activos ? `, ${activos} activos` : ''}`}
        >
          <SlidersHorizontal size={15} aria-hidden />
          <span>Filtros</span>
          {activos > 0 && <span className="ta-fbar__dot">{activos}</span>}
        </button>

        <span className="ta-fbar__sep" />

        {/* Exportar es ocasional y de escritorio: bajar un Excel de cobranzas
            en un teléfono no es un caso real, y esos 40px hacen la diferencia
            entre ver el placeholder del buscador y no verlo. */}
        <IconButton
          icon={Download} label="Exportar pendientes a Excel"
          onClick={onExportar} className="ta-only-desktop"
        />

        {/* El alta vive acá y no en la topbar, porque acá sabe de qué tipo:
            hereda la vista activa. En mobile no hay ancho para el texto, así
            que es el mismo botón sin label — no desaparece, que sería
            dejar al usuario sin poder facturar desde el teléfono. */}
        {puedeCrear && (
          <>
            <Button
              variant="primary" size="sm" icon={Plus}
              onClick={onNueva}
              className="ta-only-desktop"
            >
              Nueva factura
            </Button>
            <button
              type="button"
              className="ta-btn ta-btn--primary ta-fbar__nueva"
              onClick={onNueva}
              aria-label={`Nueva ${TIPO_LABEL[vista].toLowerCase()}`}
              title={`Nueva ${TIPO_LABEL[vista].toLowerCase()}`}
            >
              <Plus size={18} aria-hidden />
            </button>
          </>
        )}
      </div>

      {chips.length > 0 && (
        <div className="ta-fbar__chips">
          {chips.map((c, i) => (
            <button
              key={`${c.clave}-${c.valor ?? i}`}
              type="button"
              className="ta-fbar__chip"
              onClick={() => quitar(c)}
              aria-label={`Quitar filtro ${c.label}`}
            >
              {c.label}
              <X size={12} aria-hidden />
            </button>
          ))}
          <button type="button" className="ta-fbar__limpiar" onClick={limpiarTodo}>
            Limpiar
          </button>
        </div>
      )}

      {sheet && (
        <Modal
          title="Filtros"
          size="sm"
          onClose={() => setSheet(false)}
          footer={<>
            <Button variant="ghost" onClick={limpiarTodo} disabled={!hayFiltros(filtros)}>Limpiar</Button>
            <Button variant="primary" onClick={() => setSheet(false)}>Ver resultados</Button>
          </>}
        >
          <div className="ta-fsheet">
            <Field label="Estado">
              <div className="ta-fsheet__estados">
                {estados.map(e => (
                  <button
                    key={e}
                    type="button"
                    className={`ta-fsheet__estado${filtros.estados.includes(e) ? ' is-on' : ''}`}
                    aria-pressed={filtros.estados.includes(e)}
                    onClick={() => toggleEstado(e)}
                  >
                    <StatusBadge estado={e} sm />
                  </button>
                ))}
              </div>
            </Field>

            {anios.length > 1 && (
              <Field label="Año">
                <Select value={filtros.anio} onChange={e => onChange({ anio: e.target.value })}>
                  <option value="all">Todos los años</option>
                  {anios.map(a => <option key={a} value={a}>{a}</option>)}
                </Select>
              </Field>
            )}

            <Field label="Unidad">
              <Select value={filtros.unidad} onChange={e => onChange({ unidad: e.target.value })}>
                <option value="all">Todas las unidades</option>
                {unidades.map(u => <option key={u} value={u}>{u}</option>)}
              </Select>
            </Field>

            {puntosVenta.length > 1 && (
              <Field label="Punto de venta">
                <Select value={filtros.puntoVenta} onChange={e => onChange({ puntoVenta: e.target.value })}>
                  <option value="all">Todos los puntos de venta</option>
                  {puntosVenta.map(p => <option key={p} value={p}>PV {p}</option>)}
                </Select>
              </Field>
            )}

            <Field label="Moneda">
              <Select
                value={filtros.moneda}
                onChange={e => onChange({ moneda: e.target.value as FiltrosFacturacion['moneda'] })}
              >
                <option value="all">Todas las monedas</option>
                <option value="ars">Solo pesos</option>
                <option value="usd">Solo dólares</option>
              </Select>
            </Field>
          </div>
        </Modal>
      )}
    </div>
  )
}
