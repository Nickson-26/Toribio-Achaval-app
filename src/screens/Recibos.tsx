'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, ReceiptText, ArrowDownLeft, ChevronRight } from 'lucide-react'
import { db, supabase, type Recibo } from '@/lib/supabase'
import { Money } from '@/components/HideNumbers'
import { usePermisos } from '@/design/usePermisos'
import { Select, Field, Badge, ErrorState } from '@/design/primitives'
import { ars, usd, fdate, MESES, downloadCSV } from '@/lib/utils'
import { toast } from '@/components/ui'
import { NuevoReciboModal, EditarReciboModal } from '@/components/OtrosModales'
import {
  ContextoLinea, BarraExplorar, PanelDetalle, PanelCabecera, Dato, Mas,
  Movimiento, useVentana, Centinela, Vacio, SkeletonRows, type Chip,
} from '@/components/modulo'
import {
  aplicarFiltros, ordenar, chipsActivos, contarFiltros, hayFiltros,
  opcionesAnio, opcionesPersona, formasPagoPresentes,
  resumenHoy, facturasDe, facturaCorta, formaPagoLabel, formaPagoHabitual, situacionDe,
  FILTROS_INICIALES, type FiltrosRecibos,
} from '@/lib/recibos'

/**
 * RECIBOS.
 *
 * La versión anterior era una tabla administrativa de ocho columnas —número,
 * fecha, cliente, factura, persona, forma de pago, ARS, USD— más tres tarjetas
 * de métricas arriba y dos botones por fila. Todo con el mismo peso: había que
 * leerla entera para encontrar un recibo.
 *
 * Ahora usa los mismos patrones que Facturación y Reservas, y muestra cuatro
 * cosas en reposo: número, fecha, cliente e importe. Persona, forma de pago,
 * e-cheq y las facturas asociadas viven en el detalle, que es donde se
 * verifican.
 *
 * Nada de esto toca cómo se crean o editan los recibos: los dos modales son
 * los mismos, con su lógica de numeración y de vínculo con las facturas.
 */
export default function Recibos() {
  const { puedeHacer } = usePermisos()

  const [todos, setTodos] = useState<Recibo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtros, setFiltros] = useState<FiltrosRecibos>(FILTROS_INICIALES)
  const [sel, setSel] = useState<Recibo | null>(null)
  const [modal, setModal] = useState<'nuevo' | 'editar' | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    try { setTodos(await db.getRecibos()) }
    catch (e: any) { setError(e?.message ?? 'Error desconocido') }
    finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // ── Derivados ─────────────────────────────────────────────────────────────
  const filtrados = useMemo(() => ordenar(aplicarFiltros(todos, filtros)), [todos, filtros])
  const contexto = useMemo(() => resumenHoy(todos), [todos])
  const anios = useMemo(() => opcionesAnio(todos), [todos])
  const personas = useMemo(() => opcionesPersona(todos), [todos])
  const formasPago = useMemo(() => formasPagoPresentes(todos), [todos])
  // Cuál es la forma de pago que NO hace falta nombrar en cada fila.
  const habitual = useMemo(() => formaPagoHabitual(todos), [todos])

  const set = (p: Partial<FiltrosRecibos>) => setFiltros(f => ({ ...f, ...p }))
  const mesLabel = (mm: string) => MESES[Number(mm) - 1] ?? mm

  const puedeCrear = puedeHacer('recibo.crear')
  const puedeEditar = puedeHacer('recibo.editar')
  const puedeEliminar = puedeHacer('recibo.eliminar')

  function quitar(chip: Chip) {
    set({ [chip.clave]: FILTROS_INICIALES[chip.clave as keyof FiltrosRecibos] } as Partial<FiltrosRecibos>)
  }

  async function eliminar(r: Recibo) {
    if (!confirm(`¿Eliminar recibo ${r.id}? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase.from('recibos').delete().eq('id', r.id)
    if (error) { toast('Error al eliminar'); return }
    toast(`Recibo ${r.id} eliminado`)
    setSel(null); cargar()
  }

  async function guardarEdicion(patch: Partial<Recibo>) {
    if (!sel) return
    const { error } = await supabase.from('recibos').update(patch).eq('id', sel.id)
    if (error) { toast('Error al guardar'); return }
    toast('✓ Recibo actualizado')
    setModal(null); cargar()
  }

  const exportarCSV = () => downloadCSV(
    [['N° Recibo', 'Fecha', 'Cliente', 'Facturas', 'Unidad', 'Forma de pago', 'ARS', 'USD'],
      ...filtrados.map(r => [
        r.id, r.fecha, r.cliente, facturasDe(r).join(' | '),
        r.persona, r.forma_pago, r.monto_ars, r.monto_usd,
      ])],
    'recibos.csv',
  )

  if (error) {
    return <ErrorState description="No pudimos traer los recibos." detail={error} onRetry={cargar} />
  }

  return (
    <div className={`ta-mod${sel ? ' is-panel' : ''}`}>
      <div className="ta-mod__main">
        {/* Contexto: una línea. Cuando no se emitió nada hoy, se apaga y da el
            dato de la semana, en vez de mostrar un cero grande. */}
        <div className="ta-mod__contexto">
          <ContextoLinea
            rotulo="Hoy"
            icono={ArrowDownLeft}
            activo={contexto.hayAlgo}
            texto={contexto.hayAlgo
              ? `${contexto.hoy} ${contexto.hoy === 1 ? 'recibo emitido' : 'recibos emitidos'}`
              : <>sin recibos emitidos{contexto.semana > 0 && ` · ${contexto.semana} en la semana`}</>}
            monto={contexto.montoHoyARS > 0 ? <Money>{ars(contexto.montoHoyARS)}</Money> : undefined}
          />
        </div>

        <section className="ta-explorar">
          <BarraExplorar
            buscar={filtros.buscar}
            onBuscar={v => set({ buscar: v })}
            placeholder="Buscar cliente, N° de recibo o factura…"
            placeholderCorto="Buscar…"
            filtrosActivos={contarFiltros(filtros)}
            chips={chipsActivos(filtros, mesLabel) as Chip[]}
            onQuitarChip={quitar}
            onLimpiar={() => setFiltros(FILTROS_INICIALES)}
            acciones={[{ id: 'csv', label: 'Exportar la lista a CSV', onClick: exportarCSV }]}
            primaria={puedeCrear
              ? { label: 'Nuevo recibo', icon: Plus, onClick: () => setModal('nuevo') }
              : undefined}
            primariaMobile="Nuevo recibo"
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
                <Field label="Unidad">
                  <Select value={filtros.persona} onChange={e => set({ persona: e.target.value })}>
                    <option value="all">Todas las unidades</option>
                    {personas.map(p => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </Field>
                {/* Las opciones salen de los datos: si mañana aparece otra
                    forma de pago, el filtro la ofrece sin tocar código. */}
                <Field label="Forma de pago">
                  <Select
                    value={filtros.formaPago}
                    onChange={e => set({ formaPago: e.target.value as FiltrosRecibos['formaPago'] })}
                  >
                    <option value="all">Todas las formas</option>
                    {formasPago.map(f => <option key={f} value={f}>{formaPagoLabel(f)}</option>)}
                  </Select>
                </Field>
                <Field label="Moneda">
                  <Select
                    value={filtros.moneda}
                    onChange={e => set({ moneda: e.target.value as FiltrosRecibos['moneda'] })}
                  >
                    <option value="all">Todas las monedas</option>
                    <option value="ars">Solo pesos</option>
                    <option value="usd">Solo dólares</option>
                  </Select>
                </Field>
              </>
            }
          />

          <RecibosVista
            recibos={filtrados}
            cargando={cargando}
            seleccionadoId={sel?.id ?? null}
            onAbrir={setSel}
            hayFiltros={hayFiltros(filtros) || !!filtros.buscar}
            formaPagoHabitual={habitual}
          />
        </section>
      </div>

      {sel && (
        <ReciboPanel
          recibo={sel}
          onCerrar={() => setSel(null)}
          onEditar={puedeEditar ? () => setModal('editar') : undefined}
          onEliminar={puedeEliminar ? () => eliminar(sel) : undefined}
        />
      )}

      {modal === 'nuevo' && (
        <NuevoReciboModal onClose={() => setModal(null)} onSaved={() => { setModal(null); cargar() }} />
      )}
      {modal === 'editar' && sel && (
        <EditarReciboModal recibo={sel} onClose={() => setModal(null)} onSaved={guardarEdicion} />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   Las dos formas de mirar la lista
   ══════════════════════════════════════════════════════════════════════════
   Escritorio: tabla de cuatro columnas. Mobile: movimientos. Misma decisión
   que en Facturación y Reservas, y por la misma razón: la tabla comprimida no
   es una lista de teléfono. */
function RecibosVista({
  recibos, cargando, seleccionadoId, onAbrir, hayFiltros, formaPagoHabitual,
}: {
  recibos: Recibo[]
  cargando: boolean
  seleccionadoId: number | null
  onAbrir: (r: Recibo) => void
  hayFiltros: boolean
  /** La forma de pago mayoritaria: en las filas no se nombra. */
  formaPagoHabitual: string | null
}) {
  const { visibles, faltan, centinela, verMas } = useVentana(recibos)

  if (cargando) return <SkeletonRows rows={8} />
  if (!recibos.length) {
    return <Vacio icono={ReceiptText} hayFiltros={hayFiltros}
      vacio="Todavía no hay recibos" filtrado="Ningún recibo coincide" />
  }

  return (
    <>
      {/* ── Escritorio ── */}
      <div className="ta-tabla-wrap ta-only-desktop">
        <table className="ta-tabla">
          <thead>
            <tr>
              <th className="ta-tabla__num">N°</th>
              <th className="ta-tabla__fecha">Fecha</th>
              <th>Cliente</th>
              <th className="ta-num ta-tabla__importe">Importe</th>
              <th className="ta-fila__chev"><span className="ta-sr">Abrir</span></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(r => (
              <tr
                key={r.id}
                className={`ta-fila${seleccionadoId === r.id ? ' is-sel' : ''}`}
                onClick={() => onAbrir(r)}
                tabIndex={0}
                role="button"
                aria-label={`Abrir recibo ${r.id} de ${r.cliente}`}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(r) }
                }}
              >
                <td className="ta-tabla__num">
                  <span className="ta-fila__n">{r.id}</span>
                  {/* La factura vinculada no distingue un recibo de otro
                      cuando estás buscando por cliente, pero sí confirma que
                      encontraste el correcto. Aparece al acercarte, igual que
                      el punto de venta en Facturación. */}
                  <span className="ta-fila__pv">Fac. {facturaCorta(r)}</span>
                </td>
                <td className="ta-fila__fecha">{fdate(r.fecha)}</td>
                <td className="ta-fila__cliente" title={r.cliente}>{r.cliente}</td>
                <td className="ta-num ta-tabla__importe ta-fila__total">
                  <Money>{r.monto_usd ? usd(r.monto_usd) : ars(r.monto_ars)}</Money>
                  {r.monto_usd && r.monto_ars
                    ? <Money className="ta-fila__usd">{ars(r.monto_ars)}</Money>
                    : null}
                </td>
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
            titulo={r.cliente}
            monto={<Money>{r.monto_usd ? usd(r.monto_usd) : ars(r.monto_ars)}</Money>}
            meta={`Recibo ${r.id} · ${fdate(r.fecha).slice(0, 5)}`}
            // Sólo la excepción. Un "Transferencia" repetido diez veces no
            // distingue un recibo de otro; un e-cheq sí.
            estado={r.forma_pago && r.forma_pago !== formaPagoHabitual
              ? <Badge tone={r.forma_pago === 'e-cheq' ? 'violet' : 'neutral'} sm>
                  {formaPagoLabel(r.forma_pago)}
                </Badge>
              : null}
            onAbrir={() => onAbrir(r)}
            ariaLabel={`${r.cliente}, recibo ${r.id}, ${r.monto_usd ? usd(r.monto_usd) : ars(r.monto_ars)}`}
          />
        ))}
        <Centinela faltan={faltan} refEl={centinela} onVerMas={verMas} />
      </div>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   Detalle
   ══════════════════════════════════════════════════════════════════════════ */
function ReciboPanel({
  recibo, onCerrar, onEditar, onEliminar,
}: {
  recibo: Recibo
  onCerrar: () => void
  onEditar?: () => void
  onEliminar?: () => void
}) {
  const facturas = facturasDe(recibo)
  const enUSD = !!recibo.monto_usd

  const secundarias = [
    ...(onEditar ? [{ id: 'editar', label: 'Editar recibo', onClick: onEditar }] : []),
    ...(onEliminar ? [{ id: 'eliminar', label: 'Eliminar recibo', peligrosa: true, onClick: onEliminar }] : []),
  ]

  return (
    <PanelDetalle
      tipo="Recibo"
      titulo={`N° ${recibo.id}`}
      etiqueta={`Recibo ${recibo.id} — ${recibo.cliente}`}
      onCerrar={onCerrar}
      // Un recibo ya emitido no tiene un "siguiente paso": editarlo y
      // eliminarlo son excepcionales y viven detrás del •••.
      primaria={null}
      secundarias={secundarias}
      sinAcciones="Recibo emitido"
    >
      <PanelCabecera
        titulo={recibo.cliente}
        monto={<Money>{enUSD ? usd(recibo.monto_usd) : ars(recibo.monto_ars)}</Money>}
        montoAlt={enUSD && recibo.monto_ars ? <Money>{ars(recibo.monto_ars)}</Money> : undefined}
        estado={<Badge tone="success" sm>{formaPagoLabel(recibo.forma_pago)}</Badge>}
        fecha={fdate(recibo.fecha)}
        situacion={situacionDe(recibo)}
      />

      {/* Qué canceló este recibo. Es la relación real del modelo: hoy el
          vínculo vive en `nro_fact` porque la tabla `recibo_comprobantes`
          está vacía, y los dos caminos se leen igual. */}
      <div className="ta-datos ta-datos--cobro">
        {facturas.length === 0 ? (
          <Dato label="Factura"><span>Sin factura asociada</span></Dato>
        ) : facturas.length === 1 ? (
          <Dato label="Factura"><span>{facturas[0]}</span></Dato>
        ) : (
          <Dato label={`Facturas (${facturas.length})`}>
            <span>{facturas.join(' · ')}</span>
          </Dato>
        )}
        {recibo.nro_echeq ? <Dato label="N° de e-cheq"><span>{recibo.nro_echeq}</span></Dato> : null}
      </div>

      <Mas titulo="Más datos">
        <dl className="ta-dl">
          <div><dt>Unidad</dt><dd>{recibo.persona || '—'}</dd></div>
          <div><dt>Forma de pago</dt><dd>{formaPagoLabel(recibo.forma_pago)}</dd></div>
          {recibo.monto_ars ? (
            <div><dt>Importe ARS</dt><dd><Money>{ars(recibo.monto_ars)}</Money></dd></div>
          ) : null}
          {recibo.monto_usd ? (
            <div><dt>Importe USD</dt><dd><Money>{usd(recibo.monto_usd)}</Money></dd></div>
          ) : null}
          <div><dt>Registrado</dt><dd>{fdate(recibo.created_at?.slice(0, 10))}</dd></div>
        </dl>
      </Mas>
    </PanelDetalle>
  )
}
