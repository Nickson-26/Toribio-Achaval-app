'use client'
import { Plus } from 'lucide-react'
import { Select, Field, StatusBadge } from '@/design/primitives'
import { estadoLabel } from '@/design/status'
import type { ComprobanteEstado } from '@/lib/supabase'
import { BarraExplorar, Segmentado, type Chip } from '@/components/modulo'
import {
  chipsActivos, contarFiltros, FILTROS_INICIALES,
  TIPOS_FACTURA, TIPO_LABEL, TIPO_CORTO,
  type FiltrosFacturacion, type TipoFactura,
} from '@/lib/facturacion'

/**
 * Explorar facturas.
 *
 * El segmentado y la barra ya no son de Facturación: son los mismos
 * componentes que usan Recibos y Reservas. Acá quedó únicamente lo que sí es
 * propio —los tipos de comprobante, los estados fiscales— y la hoja con los
 * filtros secundarios.
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
  function toggleEstado(e: ComprobanteEstado) {
    onChange({
      estados: filtros.estados.includes(e)
        ? filtros.estados.filter(x => x !== e)
        : [...filtros.estados, e],
    })
  }

  function quitar(chip: Chip) {
    if (chip.clave === 'estados') {
      onChange({ estados: filtros.estados.filter(e => e !== chip.valor) })
    } else {
      onChange({ [chip.clave]: FILTROS_INICIALES[chip.clave as keyof FiltrosFacturacion] } as Partial<FiltrosFacturacion>)
    }
  }

  return (
    <>
      {/* Las vistas son el contexto de trabajo: de ellas hereda el tipo la
          factura que se crea desde acá. */}
      <Segmentado
        etiqueta="Tipo de factura"
        activa={vista}
        onCambiar={t => onVista(t as TipoFactura)}
        vistas={TIPOS_FACTURA.map(t => ({
          id: t, label: TIPO_LABEL[t], corto: TIPO_CORTO[t], n: conteos[t],
        }))}
      />

      <BarraExplorar
        buscar={filtros.buscar}
        onBuscar={v => onChange({ buscar: v })}
        placeholder="Buscar factura o cliente…"
        placeholderCorto="Buscar…"
        filtrosActivos={contarFiltros(filtros)}
        chips={chipsActivos(filtros, estadoLabel) as Chip[]}
        onQuitarChip={quitar}
        onLimpiar={() => onChange(FILTROS_INICIALES)}
        // Bajar un Excel de cobranzas no es una acción de todos los días:
        // vive detrás del ••• y deja el lugar a lo que sí lo es.
        acciones={[{ id: 'exportar', label: 'Exportar pendientes a Excel', onClick: onExportar }]}
        primaria={puedeCrear
          ? { label: 'Nueva factura', icon: Plus, onClick: onNueva }
          : undefined}
        primariaMobile={`Nueva ${TIPO_LABEL[vista].toLowerCase()}`}
        hojaFiltros={
          <>
            <Field label="Estado">
              <div className="ta-hojaf__estados">
                {estados.map(e => (
                  <button
                    key={e}
                    type="button"
                    className={`ta-hojaf__estado${filtros.estados.includes(e) ? ' is-on' : ''}`}
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
          </>
        }
      />
    </>
  )
}
