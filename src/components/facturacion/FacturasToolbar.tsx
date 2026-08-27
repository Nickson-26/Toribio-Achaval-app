'use client'
import { useState } from 'react'
import { SlidersHorizontal, X, Plus } from 'lucide-react'
import { Button, SearchInput, Select, Field, Modal, StatusBadge } from '@/design/primitives'
import { estadoLabel } from '@/design/status'
import type { ComprobanteEstado } from '@/lib/supabase'
import {
  chipsActivos, contarFiltros, hayFiltros, FILTROS_INICIALES,
  type FiltrosFacturacion, type ChipFiltro,
} from '@/lib/facturacion'

/**
 * Toolbar de Facturación.
 *
 * La versión anterior tenía diez controles en dos filas —117px en escritorio,
 * 214px en un iPhone, o sea media pantalla antes de ver una sola factura— y
 * dos CTA duplicados: "+ Nueva factura" aparecía acá y en la topbar, y
 * "Excel pendientes" abría el mismo modal que "Exportar pendientes".
 *
 * Ahora hay cuatro cosas: buscar, estados, Filtros, y una sola acción de alta.
 * El resto vive detrás del botón Filtros, que lleva un badge con cuántos hay
 * puestos.
 *
 * Los filtros activos se muestran abajo como chips que se pueden sacar de a
 * uno. Sin eso, una lista corta es indistinguible de una lista vacía: el
 * usuario no ve por qué le faltan filas.
 */
export function FacturasToolbar({
  filtros, onChange, estados, anios, unidades, puntosVenta,
  puedeCrear, onNueva, onExportar, pendientes,
}: {
  filtros: FiltrosFacturacion
  onChange: (p: Partial<FiltrosFacturacion>) => void
  estados: ComprobanteEstado[]
  anios: string[]
  unidades: string[]
  puntosVenta: string[]
  puedeCrear: boolean
  onNueva: () => void
  onExportar: () => void
  pendientes: number
}) {
  const [sheet, setSheet] = useState(false)
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
      <div className="ta-fbar__row">
        <SearchInput
          value={filtros.buscar}
          onChange={v => onChange({ buscar: v })}
          placeholder="Buscar N° o cliente…"
          ariaLabel="Buscar facturas"
          className="ta-fbar__search"
        />

        {/* Los estados son el filtro que más se usa: quedan a la vista en
            escritorio y se pliegan dentro de la hoja en mobile. */}
        <div className="ta-fbar__estados ta-only-desktop" role="group" aria-label="Filtrar por estado">
          {estados.map(e => (
            <button
              key={e}
              type="button"
              className={`ta-fchip${filtros.estados.includes(e) ? ' is-on' : ''}`}
              aria-pressed={filtros.estados.includes(e)}
              onClick={() => toggleEstado(e)}
            >
              {estadoLabel(e)}
            </button>
          ))}
        </div>

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

        <div className="ta-fbar__acciones">
          <Button variant="ghost" size="sm" onClick={onExportar}>
            Exportar pendientes{pendientes > 0 ? ` (${pendientes})` : ''}
          </Button>
          {puedeCrear && (
            <Button variant="primary" size="sm" icon={Plus} onClick={onNueva} className="ta-only-desktop">
              Nueva factura
            </Button>
          )}
        </div>
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
            Limpiar todo
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
            {/* En la hoja los estados van con su badge real, para que el
                usuario asocie el filtro con lo que después ve en la lista. */}
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
