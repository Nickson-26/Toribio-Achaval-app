'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Home, MapPin, ChevronRight } from 'lucide-react'
import { db, supabase, type Reserva } from '@/lib/supabase'
import { Money } from '@/components/HideNumbers'
import { usePermisos } from '@/design/usePermisos'
import { Select, Field, Badge, ErrorState } from '@/design/primitives'
import { usd, ars, fdate, MESES } from '@/lib/utils'
import { toast } from '@/components/ui'
import { apiFetch, apiErrorMessage } from '@/lib/apiClient'
import { ReservaModal } from '@/components/ReservaModal'
import {
  ContextoLinea, Segmentado, BarraExplorar, PanelDetalle, PanelCabecera,
  Dato, Mas, Movimiento, useVentana, Centinela, Vacio, SkeletonRows, type Chip,
} from '@/components/modulo'
import {
  CATEGORIAS, CATEGORIA_LABEL, categoriaDe, porCategoria, contarPorCategoria,
  aplicarFiltros, ordenar, chipsActivos, contarFiltros, hayFiltros,
  opcionesAnio, opcionesUnidad, resumenDelMes,
  codigoCorto, operacionLabel, situacionDe,
  FILTROS_INICIALES, type FiltrosReservas, type Categoria,
} from '@/lib/reservas'

/**
 * RESERVAS.
 *
 * La versión anterior mezclaba un Dashboard con tres tarjetas de KPIs, tres
 * tablas de resumen por unidad, un selector de período, cinco filtros
 * permanentes, dos botones de colores propios para importar y exportar, una
 * tabla de nueve columnas y dos botones por fila. Entrar a la pantalla era
 * elegir por dónde empezar.
 *
 * Ahora sigue el mismo recorrido que Facturación y Recibos:
 *
 *   contexto del mes  ->  categoría  ->  buscar / filtrar  ->  lista  ->  detalle
 *
 * Qué se muestra lo decidieron los datos, no el modelo. Medido sobre las 147
 * reservas de producción:
 *
 *   · `cliente` está vacío en las 147. La identidad de una reserva es la
 *     DIRECCIÓN, así que ese es el título de la fila.
 *   · `modo_pago` está vacío en las 147. No se muestra en ningún lado.
 *   · `firmo` vale 'PENDIENTE' en las 147 y `estado_reserva` es 'Reservada'
 *     o nada. Una columna que dice lo mismo en el 100% de las filas no
 *     distingue nada: los dos bajaron al detalle.
 *   · 120 reservas tienen importe en dólares y 27 en pesos. El precio de
 *     reserva se muestra en su moneda; el total del mes se suma en dólares,
 *     porque mezclar las dos sería inventar una cifra.
 *
 * La lógica de negocio no cambió. Sí se corrigió la clasificación de Canning
 * —ver RESERVAS_CANNING.md—, que ahora sale de `lib/reservas.ts` y es la
 * misma para la pantalla, el sync de PROA, el importador y el export a Sheets.
 */
export default function Reservas() {
  const { puedeHacer } = usePermisos()

  const [todas, setTodas] = useState<Reserva[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoria, setCategoria] = useState<Categoria>('EMPRENDIMIENTOS')
  const [filtros, setFiltros] = useState<FiltrosReservas>(FILTROS_INICIALES)
  const [sel, setSel] = useState<Reserva | null>(null)
  const [modal, setModal] = useState<'nueva' | 'editar' | null>(null)
  const [trabajando, setTrabajando] = useState<'importando' | 'exportando' | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    try { setTodas(await db.getReservas()) }
    catch (e: any) { setError(e?.message ?? 'Error desconocido') }
    finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // ── Derivados ─────────────────────────────────────────────────────────────
  const conteos = useMemo(() => contarPorCategoria(todas), [todas])
  const deCategoria = useMemo(() => porCategoria(todas, categoria), [todas, categoria])
  const filtradas = useMemo(() => ordenar(aplicarFiltros(deCategoria, filtros)), [deCategoria, filtros])
  const contexto = useMemo(() => resumenDelMes(todas), [todas])
  const anios = useMemo(() => opcionesAnio(todas), [todas])
  const unidades = useMemo(() => opcionesUnidad(deCategoria), [deCategoria])

  const set = (p: Partial<FiltrosReservas>) => setFiltros(f => ({ ...f, ...p }))
  const mesLabel = (mm: string) => MESES[Number(mm) - 1] ?? mm

  // Permisos granulares, no uno solo: importar reemplaza TODA la tabla y por
  // eso está reservado a admin. Un editor da de alta y edita, pero no importa.
  const puedeCrear    = puedeHacer('reserva.crear')
  const puedeEditar   = puedeHacer('reserva.editar')
  const puedeEliminar = puedeHacer('reserva.eliminar')
  const puedeImportar = puedeHacer('reserva.importar')
  const puedeExportar = puedeHacer('reserva.exportar')

  function quitar(chip: Chip) {
    set({ [chip.clave]: FILTROS_INICIALES[chip.clave as keyof FiltrosReservas] } as Partial<FiltrosReservas>)
  }

  async function eliminar(r: Reserva) {
    if (!confirm(`¿Eliminar la reserva de ${r.direccion}?`)) return
    const { error } = await supabase.from('reservas').delete().eq('id', r.id)
    if (error) { toast('Error al eliminar'); return }
    toast('Reserva eliminada')
    setSel(null); cargar()
  }

  /**
   * Importar el Excel de PROA REEMPLAZA la tabla entera. Es la operación más
   * destructiva de la aplicación, así que además de la confirmación que exige
   * el servidor, acá se pregunta con todas las letras — y vive detrás del
   * •••, no compitiendo con "Nueva reserva".
   */
  async function importarExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!confirm(
      'Importar el Excel de PROA REEMPLAZA todas las reservas existentes.\n\n' +
      '¿Confirmás que querés reemplazarlas?',
    )) { e.target.value = ''; return }

    setTrabajando('importando')
    try {
      const fd = new FormData()
      fd.append('file', file)
      // El servidor exige esta confirmación explícita. Ver
      // src/app/api/reservas/import-excel/route.ts
      fd.append('confirm', 'REEMPLAZAR')
      const resp = await apiFetch('/api/reservas/import-excel', { method: 'POST', body: fd })
      const json = await resp.json()
      if (json.ok) {
        toast(`✓ ${json.inserted} reservas importadas (reemplazaron ${json.replaced ?? 0})`)
        cargar()
      } else {
        toast('Error al importar: ' + apiErrorMessage(json))
      }
    } catch { toast('Error al importar') }
    finally { setTrabajando(null); e.target.value = '' }
  }

  async function exportarSheets() {
    setTrabajando('exportando')
    try {
      const resp = await apiFetch('/api/reservas/export-sheets', { method: 'POST' })
      const json = await resp.json()
      if (json.url) {
        window.open(json.url, '_blank')
        toast('Sheet creado con ' + json.total + ' reservas')
      } else {
        toast('Error al exportar: ' + apiErrorMessage(json))
      }
    } catch { toast('Error al exportar') }
    finally { setTrabajando(null) }
  }

  if (error) {
    return <ErrorState description="No pudimos traer las reservas." detail={error} onRetry={cargar} />
  }

  return (
    <div className={`ta-mod${sel ? ' is-panel' : ''}`}>
      <div className="ta-mod__main">
        {/* Contexto del mes: dos datos, no diez KPIs. Cuando el mes todavía
            no arrancó, la línea se apaga en vez de mostrar ceros. */}
        <div className="ta-mod__contexto">
          <ContextoLinea
            rotulo="Este mes"
            icono={Home}
            activo={contexto.hayAlgo}
            texto={contexto.hayAlgo
              ? `${contexto.mes} ${contexto.mes === 1 ? 'reserva' : 'reservas'}` +
                (contexto.ventas > 0 ? ` · ${contexto.ventas} de venta` : '')
              : 'todavía sin reservas'}
            monto={contexto.montoUSD > 0 ? <Money>{usd(contexto.montoUSD)}</Money> : undefined}
          />
        </div>

        <section className="ta-explorar">
          {/* Las tres categorías son el contexto de trabajo, igual que los
              tipos de comprobante en Facturación. Mismo control, no tabs con
              borde inferior. */}
          <Segmentado
            etiqueta="Categoría de reserva"
            activa={categoria}
            onCambiar={c => { setCategoria(c as Categoria); setSel(null); set({ unidad: 'all' }) }}
            vistas={CATEGORIAS.map(c => ({
              id: c,
              label: CATEGORIA_LABEL[c],
              corto: c === 'EMPRENDIMIENTOS' ? 'Emprend.' : CATEGORIA_LABEL[c],
              n: conteos[c],
            }))}
          />

          <BarraExplorar
            buscar={filtros.buscar}
            onBuscar={v => set({ buscar: v })}
            placeholder="Buscar dirección, broker o código…"
            placeholderCorto="Buscar…"
            filtrosActivos={contarFiltros(filtros)}
            chips={chipsActivos(filtros, mesLabel) as Chip[]}
            onQuitarChip={quitar}
            onLimpiar={() => setFiltros(FILTROS_INICIALES)}
            // Importar y exportar no son de todos los días, y una de las dos
            // reemplaza la base entera: detrás del •••.
            acciones={[
              ...(puedeExportar ? [{
                id: 'exportar',
                label: trabajando === 'exportando' ? 'Exportando…' : 'Exportar a Google Sheets',
                onClick: exportarSheets,
              }] : []),
              ...(puedeImportar ? [{
                id: 'importar',
                label: trabajando === 'importando' ? 'Importando…' : 'Importar Excel de PROA…',
                peligrosa: true,
                onClick: () => document.getElementById('ta-import-proa')?.click(),
              }] : []),
            ]}
            primaria={puedeCrear
              ? { label: 'Nueva reserva', icon: Plus, onClick: () => setModal('nueva') }
              : undefined}
            primariaMobile="Nueva reserva"
            hojaFiltros={
              <>
                {anios.length > 1 && (
                  <Field label="Año">
                    <Select value={filtros.anio} onChange={e => set({ anio: e.target.value })}>
                      <option value="all">Todos los años</option>
                      {anios.map(a => <option key={a} value={a}>{a}</option>)}
                    </Select>
                  </Field>
                )}
                <Field label="Mes">
                  <Select value={filtros.mes} onChange={e => set({ mes: e.target.value })}>
                    <option value="all">Todos los meses</option>
                    {MESES.map((m, i) => (
                      <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Operación">
                  <Select
                    value={filtros.operacion}
                    onChange={e => set({ operacion: e.target.value as FiltrosReservas['operacion'] })}
                  >
                    <option value="all">Venta y alquiler</option>
                    <option value="VENTA">Solo venta</option>
                    <option value="ALQUILER">Solo alquiler</option>
                  </Select>
                </Field>
                {/* Las unidades ofrecidas son las de ESTA categoría y sólo las
                    que tienen reservas. Un select con opciones que no
                    devuelven nada es una trampa. */}
                {unidades.length > 1 && (
                  <Field label="Unidad">
                    <Select value={filtros.unidad} onChange={e => set({ unidad: e.target.value })}>
                      <option value="all">Todas las unidades</option>
                      {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                    </Select>
                  </Field>
                )}
              </>
            }
          />

          <ReservasVista
            reservas={filtradas}
            cargando={cargando}
            seleccionadaId={sel?.id ?? null}
            onAbrir={setSel}
            hayFiltros={hayFiltros(filtros) || !!filtros.buscar}
          />
        </section>
      </div>

      {sel && (
        <ReservaPanel
          reserva={sel}
          onCerrar={() => setSel(null)}
          onEditar={puedeEditar ? () => setModal('editar') : undefined}
          onEliminar={puedeEliminar ? () => eliminar(sel) : undefined}
        />
      )}

      {/* El input vive fuera del menú: un <input type=file> adentro de un
          popover que se cierra al hacer clic no llega a abrir el diálogo. */}
      {puedeImportar && (
        <input
          id="ta-import-proa" type="file" accept=".xlsx" hidden
          onChange={importarExcel} disabled={trabajando === 'importando'}
        />
      )}

      {modal === 'nueva' && (
        <ReservaModal
          tab={categoria}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); cargar() }}
        />
      )}
      {modal === 'editar' && sel && (
        <ReservaModal
          tab={categoriaDe(sel)}
          reserva={sel}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); setSel(null); cargar() }}
        />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   Las dos formas de mirar la lista
   ══════════════════════════════════════════════════════════════════════════
   Escritorio: cinco columnas. De las nueve anteriores quedaron las que sirven
   para escanear —fecha, propiedad, operación, precio de reserva, situación—;
   código PROA, tipo de inmueble, precio publicado y broker bajaron al detalle
   o aparecen al acercarse. */
function ReservasVista({
  reservas, cargando, seleccionadaId, onAbrir, hayFiltros,
}: {
  reservas: Reserva[]
  cargando: boolean
  seleccionadaId: number | null
  onAbrir: (r: Reserva) => void
  hayFiltros: boolean
}) {
  const { visibles, faltan, centinela, verMas } = useVentana(reservas)

  // `firmo` vale 'PENDIENTE' en las 147 reservas de la base. Una columna que
  // repite "Sin firmar" en todas las filas —y encima en ámbar, que es el
  // color de "prestá atención"— no distingue nada: es ruido con acento.
  // Aparece solamente si en lo que se está mirando hay alguna firmada, que es
  // cuando pasa a haber dos valores y la columna informa.
  const hayFirmadas = reservas.some(r => r.firmo === 'FIRMADO')

  if (cargando) return <SkeletonRows rows={8} />
  if (!reservas.length) {
    return <Vacio icono={MapPin} hayFiltros={hayFiltros}
      vacio="Todavía no hay reservas" filtrado="Ninguna reserva coincide" />
  }

  return (
    <>
      {/* ── Escritorio ── */}
      <div className="ta-tabla-wrap ta-only-desktop">
        <table className="ta-tabla">
          <thead>
            <tr>
              <th className="ta-tabla__fecha">Fecha</th>
              <th className="ta-tabla__prop">Propiedad</th>
              <th className="ta-tabla__op">Operación</th>
              <th className="ta-num ta-tabla__importe">Reserva</th>
              {hayFirmadas && <th className="ta-tabla__estado">Firma</th>}
              <th className="ta-fila__chev"><span className="ta-sr">Abrir</span></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(r => (
              <tr
                key={r.id}
                className={`ta-fila${seleccionadaId === r.id ? ' is-sel' : ''}`}
                onClick={() => onAbrir(r)}
                tabIndex={0}
                role="button"
                aria-label={`Abrir reserva de ${r.direccion}`}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(r) }
                }}
              >
                <td className="ta-fila__fecha">{fdate(r.fecha)}</td>
                <td className="ta-fila__cliente ta-tabla__prop" title={r.direccion}>
                  <span className="ta-fila__n2">{r.direccion}</span>
                  {/* El broker no ayuda a encontrar una propiedad, pero sí
                      confirma que encontraste la correcta. Aparece al
                      acercarse a ESTA fila y vive completo en el detalle. */}
                  <span className="ta-fila__pv">{r.broker || 'Sin broker'}</span>
                </td>
                <td className="ta-tabla__op">
                  <Badge tone={r.operacion === 'VENTA' ? 'brand' : 'info'} sm>
                    {operacionLabel(r.operacion)}
                  </Badge>
                </td>
                <td className="ta-num ta-tabla__importe ta-fila__total">
                  <Money>{precioDe(r)}</Money>
                </td>
                {hayFirmadas && (
                  <td className="ta-tabla__estado">
                    {r.firmo === 'FIRMADO'
                      ? <Badge tone="success" sm>Firmada</Badge>
                      : <span className="ta-fila__nada">—</span>}
                  </td>
                )}
                <td className="ta-fila__chev"><ChevronRight size={15} aria-hidden /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Centinela faltan={faltan} refEl={centinela} onVerMas={verMas} />
      </div>

      {/* ── Mobile ── */}
      <div className="ta-movs ta-only-mobile">
        {visibles.map(r => (
          <Movimiento
            key={r.id}
            titulo={r.direccion}
            monto={<Money>{precioDe(r)}</Money>}
            meta={`${operacionLabel(r.operacion)} · ${fdate(r.fecha).slice(0, 5)}`}
            estado={r.firmo === 'FIRMADO'
              ? <Badge tone="success" sm>Firmada</Badge>
              : <Badge tone="neutral" sm>{r.tipo_inmueble || operacionLabel(r.operacion)}</Badge>}
            onAbrir={() => onAbrir(r)}
            ariaLabel={`${r.direccion}, ${operacionLabel(r.operacion)}, ${precioDe(r)}`}
          />
        ))}
        <Centinela faltan={faltan} refEl={centinela} onVerMas={verMas} />
      </div>
    </>
  )
}

/**
 * El importe de la reserva, en la moneda que tenga.
 *
 * `precio_reserva` es el campo que trae PROA; las reservas cargadas a mano no
 * lo tienen y usan `monto_usd` o `monto_ars`. No se convierte una moneda a la
 * otra: no hay tipo de cambio guardado y estimarlo sería inventar un número.
 */
function precioDe(r: Reserva): string {
  if (r.precio_reserva) return usd(r.precio_reserva)
  if (r.monto_usd) return usd(r.monto_usd)
  if (r.monto_ars) return ars(r.monto_ars)
  return '—'
}

/* ══════════════════════════════════════════════════════════════════════════
   Detalle
   ══════════════════════════════════════════════════════════════════════════ */
function ReservaPanel({
  reserva, onCerrar, onEditar, onEliminar,
}: {
  reserva: Reserva
  onCerrar: () => void
  onEditar?: () => void
  onEliminar?: () => void
}) {
  const secundarias = [
    ...(onEliminar ? [{ id: 'eliminar', label: 'Eliminar reserva', peligrosa: true, onClick: onEliminar }] : []),
  ]

  return (
    <PanelDetalle
      // El identificador de una reserva es su código PROA; el tipo de
      // inmueble es una característica y va con la categoría, arriba.
      tipo={[CATEGORIA_LABEL[categoriaDe(reserva)], reserva.tipo_inmueble]
        .filter(Boolean).join(' · ')}
      titulo={codigoCorto(reserva.proa_codigo) === '—'
        ? 'Reserva'
        : codigoCorto(reserva.proa_codigo)}
      etiqueta={`Reserva de ${reserva.direccion}`}
      onCerrar={onCerrar}
      // Editar SÍ es el siguiente paso natural de una reserva abierta: es lo
      // que se hace cuando se firma o cambia el precio.
      primaria={onEditar ? { label: 'Editar reserva', onClick: onEditar } : null}
      secundarias={secundarias}
      sinAcciones="Sólo lectura"
    >
      <PanelCabecera
        titulo={reserva.direccion}
        monto={<Money>{precioDe(reserva)}</Money>}
        montoAlt={reserva.precio_publicado
          ? <Money>{`Publicado ${usd(reserva.precio_publicado)}`}</Money>
          : undefined}
        estado={
          <Badge tone={reserva.operacion === 'VENTA' ? 'brand' : 'info'} sm>
            {operacionLabel(reserva.operacion)}
          </Badge>
        }
        fecha={fdate(reserva.fecha)}
        situacion={situacionDe(reserva)}
      />

      <div className="ta-datos ta-datos--cobro">
        <Dato label="Unidad"><span>{reserva.unidad}</span></Dato>
        {reserva.broker ? <Dato label="Broker"><span>{reserva.broker}</span></Dato> : null}
      </div>

      <Mas titulo="Más datos">
        <dl className="ta-dl">
          <div><dt>Tipo de inmueble</dt><dd>{reserva.tipo_inmueble || '—'}</dd></div>
          <div><dt>Código PROA</dt><dd className="ta-mono">{codigoCorto(reserva.proa_codigo)}</dd></div>
          {reserva.precio_publicado ? (
            <div><dt>Precio publicado</dt><dd><Money>{usd(reserva.precio_publicado)}</Money></dd></div>
          ) : null}
          {reserva.monto_ars ? (
            <div><dt>Importe ARS</dt><dd><Money>{ars(reserva.monto_ars)}</Money></dd></div>
          ) : null}
          <div><dt>Estado</dt><dd>{reserva.estado_reserva || '—'}</dd></div>
          <div><dt>Firma</dt><dd>{reserva.firmo === 'FIRMADO' ? 'Firmada' : 'Pendiente'}</dd></div>
          <div className="ta-dl__full"><dt>Dirección</dt><dd>{reserva.direccion}</dd></div>
        </dl>
      </Mas>
    </PanelDetalle>
  )
}
