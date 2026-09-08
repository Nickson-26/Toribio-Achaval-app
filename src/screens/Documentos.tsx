'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, FileMinus2, ChevronRight, Scale } from 'lucide-react'
import { db, supabase, type Comprobante } from '@/lib/supabase'
import { Money } from '@/components/HideNumbers'
import { usePermisos } from '@/design/usePermisos'
import { useNavigation } from '@/components/NavigationProvider'
import { Select, Field, Badge, ErrorState, EmptyState } from '@/design/primitives'
import { ars, usd, fdate, MESES } from '@/lib/utils'
import { toast } from '@/components/ui'
import { NuevoNCModal, EditarNCModal } from '@/components/NotasModales'
import {
  ContextoLinea, Segmentado, BarraExplorar, PanelDetalle, PanelCabecera,
  Dato, Mas, Movimiento, useVentana, Centinela, Vacio, SkeletonRows, type Chip,
} from '@/components/modulo'
import {
  CLASES, CLASE_LABEL, CLASE_CORTO, CLASE_SINGULAR, claseDe, soloNotas,
  porClase, contarPorClase, aplicarFiltros, ordenar, chipsActivos,
  contarFiltros, hayFiltros, opcionesAnio, opcionesUnidad, opcionesPuntoVenta,
  puntoVentaDe, resumen, situacionDe, muestraDesagregado,
  FILTROS_INICIALES, type Clase, type FiltrosDocumentos,
} from '@/lib/documentos'

/**
 * DOCUMENTOS — Notas de Crédito y Notas de Débito.
 *
 * Antes eran dos pantallas separadas en la navegación: dos tablas de once y
 * diez columnas, con el desglose fiscal completo en cada fila y dos botones
 * por registro. Se leían como dos sistemas distintos cuando en realidad son
 * dos clases del mismo documento y viven en la misma tabla.
 *
 * Ahora es una sola pantalla con el mismo control segmentado que usa
 * Facturación para A/B/FCE/E, y el mismo recorrido:
 *
 *   contexto  ->  clase  ->  buscar / filtrar  ->  lista  ->  detalle
 *
 * ── Decisión sobre Notas de Débito ────────────────────────────────────────
 *
 * Hoy hay 7 NC y CERO ND. La pantalla vieja de ND tenía filtro por punto de
 * venta, tabla de diez columnas, ningún alta, y un "Editar" que abría un
 * modal diciendo "Edición disponible desde Supabase" — una acción que no
 * hacía nada.
 *
 * Se eligió la opción (A) del brief: ND mantiene su pestaña, con conteo real
 * y un vacío que dice la verdad. Las razones:
 *
 *   · el soporte técnico se conserva entero —tipo, clasificación, filtros,
 *     detalle— así que el día que se emita la primera ND aparece sola, sin
 *     rediseño;
 *   · esconderla mientras no haya datos obliga a acordarse de volver a
 *     mostrarla, que es la clase de deuda que nadie paga;
 *   · una pestaña con "0" al lado no es ruido: es información, y es la misma
 *     regla que ya usa el segmentado de Facturación, donde Facturas E dice 1.
 *
 * Lo que sí se retiró es la funcionalidad ficticia: no hay alta de ND porque
 * nunca la hubo, y el "Editar" que no editaba dejó de ofrecerse. Nada de
 * backend, modelo ni rutas se tocó.
 *
 * ── Fiscal ────────────────────────────────────────────────────────────────
 *
 * `discriminaIVA`, `desdeNeto`, la numeración, el punto de venta, la anulación
 * de la factura al emitir una NC y su restauración al eliminarla siguen
 * exactamente como estaban: viven en los modales, que se movieron de archivo
 * sin tocarles una línea.
 */
export default function Documentos() {
  const { puedeHacer } = usePermisos()
  const { route, navigate } = useNavigation()

  const [todos, setTodos] = useState<Comprobante[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Las dos entradas de la navegación llevan a esta misma pantalla; lo único
  // que cambia es con qué clase abre. Los enlaces /notas-credito y
  // /notas-debito siguen funcionando igual que antes.
  const [clase, setClase] = useState<Clase>(route.to === 'nd' ? 'ND' : 'NC')
  const [filtros, setFiltros] = useState<FiltrosDocumentos>(FILTROS_INICIALES)
  const [sel, setSel] = useState<Comprobante | null>(null)
  const [modal, setModal] = useState<'nueva' | 'editar' | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    try { setTodos(soloNotas(await db.getComprobantes())) }
    catch (e: any) { setError(e?.message ?? 'Error desconocido') }
    finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Cambiar de ítem en la navegación cambia la clase, no la pantalla.
  useEffect(() => {
    if (route.to === 'nc' || route.to === 'nd') {
      setClase(route.to === 'nd' ? 'ND' : 'NC')
      setSel(null)
    }
  }, [route.to])

  // ── Derivados ─────────────────────────────────────────────────────────────
  const conteos = useMemo(() => contarPorClase(todos), [todos])
  const deClase = useMemo(() => porClase(todos, clase), [todos, clase])
  const filtrados = useMemo(() => ordenar(aplicarFiltros(deClase, filtros)), [deClase, filtros])
  const contexto = useMemo(() => resumen(deClase), [deClase])
  const anios = useMemo(() => opcionesAnio(todos), [todos])
  const unidades = useMemo(() => opcionesUnidad(deClase), [deClase])
  const puntosVenta = useMemo(() => opcionesPuntoVenta(deClase), [deClase])

  const set = (p: Partial<FiltrosDocumentos>) => setFiltros(f => ({ ...f, ...p }))
  const mesLabel = (mm: string) => MESES[Number(mm) - 1] ?? mm

  const puedeCrear = puedeHacer('comprobante.crear')
  const puedeEditar = puedeHacer('comprobante.editar')
  const puedeEliminar = puedeHacer('comprobante.eliminar')

  function quitar(chip: Chip) {
    set({ [chip.clave]: FILTROS_INICIALES[chip.clave as keyof FiltrosDocumentos] } as Partial<FiltrosDocumentos>)
  }

  /**
   * Eliminar una NC restaura la factura que había anulado.
   *
   * Es la lógica que ya existía, movida tal cual: la NC anula la factura al
   * emitirse, así que borrarla tiene que devolverla a `emitida`. Sin esto, una
   * factura quedaría anulada por una nota que ya no existe.
   */
  async function eliminar(d: Comprobante) {
    if (!confirm(`¿Eliminar ${d.id}? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase.from('comprobantes').delete().eq('id', d.id)
    if (error) { toast('Error al eliminar'); return }
    if (d.factura_asociada_id) {
      await supabase.from('comprobantes')
        .update({ estado: 'emitida' }).eq('id', d.factura_asociada_id)
      toast(`✓ ${d.id} eliminada — factura ${d.factura_asociada_id} restaurada a emitida`)
    } else {
      toast(`${d.id} eliminada`)
    }
    setSel(null); cargar()
  }

  async function guardarEdicion(patch: Partial<Comprobante>) {
    if (!sel) return
    const { error } = await supabase.from('comprobantes').update(patch).eq('id', sel.id)
    if (error) { toast('Error al guardar'); return }
    toast('✓ Guardado')
    setModal(null); cargar()
  }

  if (error) {
    return <ErrorState description="No pudimos traer los documentos." detail={error} onRetry={cargar} />
  }

  // El alta existe sólo para notas de crédito: nunca hubo una de débito, y
  // fabricarla ahora sería inventar un circuito fiscal que no está definido.
  const puedeCrearEstaClase = puedeCrear && clase === 'NC'

  return (
    <div className={`ta-mod${sel ? ' is-panel' : ''}`}>
      <div className="ta-mod__main">
        <div className="ta-mod__contexto">
          <ContextoLinea
            rotulo={CLASE_CORTO[clase]}
            icono={Scale}
            activo={contexto.hayAlgo}
            texto={contexto.hayAlgo
              ? `${contexto.cantidad} ${contexto.cantidad === 1 ? 'documento emitido' : 'documentos emitidos'}`
              : `sin ${CLASE_LABEL[clase].toLowerCase()} emitidas`}
            monto={contexto.ars > 0
              ? <Money>{`${clase === 'NC' ? '−' : '+'}${ars(contexto.ars)}`}</Money>
              : undefined}
          />
        </div>

        <section className="ta-explorar">
          {/* Mismo control que A/B/FCE/E en Facturación. El conteo de ND dice
              0 y eso es información, no ruido. */}
          <Segmentado
            etiqueta="Clase de documento"
            activa={clase}
            // Cambiar de clase navega: si no, el título de la topbar y el
            // ítem resaltado de la navegación quedaban diciendo "Notas de
            // Crédito" mientras la pantalla mostraba las de débito.
            onCambiar={c => navigate({ to: c === 'ND' ? 'nd' : 'nc' })}
            vistas={CLASES.map(c => ({
              id: c, label: CLASE_LABEL[c], corto: CLASE_CORTO[c], n: conteos[c],
            }))}
          />

          <BarraExplorar
            buscar={filtros.buscar}
            onBuscar={v => set({ buscar: v })}
            placeholder="Buscar número, cliente o factura asociada…"
            placeholderCorto="Buscar…"
            filtrosActivos={contarFiltros(filtros)}
            chips={chipsActivos(filtros, mesLabel) as Chip[]}
            onQuitarChip={quitar}
            onLimpiar={() => setFiltros(FILTROS_INICIALES)}
            primaria={puedeCrearEstaClase
              ? { label: 'Nueva nota de crédito', icon: Plus, onClick: () => setModal('nueva') }
              : undefined}
            primariaMobile="Nueva nota de crédito"
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
                {unidades.length > 1 && (
                  <Field label="Unidad">
                    <Select value={filtros.unidad} onChange={e => set({ unidad: e.target.value })}>
                      <option value="all">Todas las unidades</option>
                      {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                    </Select>
                  </Field>
                )}
                {puntosVenta.length > 1 && (
                  <Field label="Punto de venta">
                    <Select value={filtros.puntoVenta} onChange={e => set({ puntoVenta: e.target.value })}>
                      <option value="all">Todos los puntos de venta</option>
                      {puntosVenta.map(p => <option key={p} value={p}>PV {p}</option>)}
                    </Select>
                  </Field>
                )}
              </>
            }
          />

          <DocumentosVista
            documentos={filtrados}
            clase={clase}
            cargando={cargando}
            seleccionadoId={sel?.id ?? null}
            onAbrir={setSel}
            hayFiltros={hayFiltros(filtros) || !!filtros.buscar}
          />
        </section>
      </div>

      {sel && (
        <DocumentoPanel
          doc={sel}
          onCerrar={() => setSel(null)}
          onEditar={puedeEditar && claseDe(sel) === 'NC' ? () => setModal('editar') : undefined}
          onEliminar={puedeEliminar ? () => eliminar(sel) : undefined}
        />
      )}

      {modal === 'nueva' && (
        <NuevoNCModal
          clientes={[...new Set(todos.map(d => d.cliente).filter(Boolean))]}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); cargar() }}
        />
      )}
      {modal === 'editar' && sel && (
        <EditarNCModal comp={sel} onClose={() => setModal(null)} onSaved={guardarEdicion} />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   Las dos formas de mirar la lista
   ══════════════════════════════════════════════════════════════════════════
   De once columnas a cuatro. Neto, IVA, concepto, unidad y punto de venta
   bajaron al detalle: son datos de verificación, y verificar es justamente lo
   que se hace con un documento abierto, no escaneando una lista. */
function DocumentosVista({
  documentos, clase, cargando, seleccionadoId, onAbrir, hayFiltros,
}: {
  documentos: Comprobante[]
  clase: Clase
  cargando: boolean
  seleccionadoId: string | null
  onAbrir: (d: Comprobante) => void
  hayFiltros: boolean
}) {
  const { visibles, faltan, centinela, verMas } = useVentana(documentos)

  if (cargando) return <SkeletonRows rows={6} />

  // El vacío dice la verdad sobre por qué está vacío. Para ND, que no tiene
  // ninguna emitida, eso es más honesto que un "no se encontraron resultados".
  if (!documentos.length) {
    if (hayFiltros) {
      return <Vacio icono={FileMinus2} hayFiltros
        vacio="" filtrado={`Ninguna ${CLASE_SINGULAR[clase].toLowerCase()} coincide`} />
    }
    return (
      <EmptyState
        icon={FileMinus2}
        title={`Todavía no se emitieron ${CLASE_LABEL[clase].toLowerCase()}`}
        description={clase === 'ND'
          ? 'Cuando se emita la primera va a aparecer acá.'
          : undefined}
      />
    )
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
              <th className="ta-tabla__estado">Factura</th>
              <th className="ta-fila__chev"><span className="ta-sr">Abrir</span></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(d => (
              <tr
                key={d.id}
                className={`ta-fila${seleccionadoId === d.id ? ' is-sel' : ''}`}
                onClick={() => onAbrir(d)}
                tabIndex={0}
                role="button"
                aria-label={`Abrir ${d.tipo} ${d.numero} de ${d.cliente}`}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(d) }
                }}
              >
                <td className="ta-tabla__num">
                  <span className="ta-fila__n">{d.numero}</span>
                  <span className="ta-fila__pv">{d.tipo} · PV {puntoVentaDe(d)}</span>
                </td>
                <td className="ta-fila__fecha">{fdate(d.fecha)}</td>
                <td className="ta-fila__cliente" title={d.cliente}>{d.cliente}</td>
                <td className="ta-num ta-tabla__importe ta-fila__total">
                  <Money>{d.monto_usd ? usd(d.monto_usd) : ars(d.monto_ars)}</Money>
                </td>
                <td className="ta-tabla__estado">
                  {d.factura_asociada_id
                    ? <Badge tone="info" sm>{d.factura_asociada_id}</Badge>
                    : <span className="ta-fila__nada">—</span>}
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
        {visibles.map(d => (
          <Movimiento
            key={d.id}
            titulo={d.cliente}
            monto={<Money>{d.monto_usd ? usd(d.monto_usd) : ars(d.monto_ars)}</Money>}
            meta={`${d.tipo} ${d.numero} · ${fdate(d.fecha).slice(0, 5)}`}
            estado={d.factura_asociada_id
              ? <Badge tone="info" sm>{d.factura_asociada_id}</Badge>
              : null}
            onAbrir={() => onAbrir(d)}
            ariaLabel={`${d.tipo} ${d.numero} de ${d.cliente}. ${situacionDe(d)}`}
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
function DocumentoPanel({
  doc, onCerrar, onEditar, onEliminar,
}: {
  doc: Comprobante
  onCerrar: () => void
  onEditar?: () => void
  onEliminar?: () => void
}) {
  const clase = claseDe(doc)
  const enUSD = !!doc.monto_usd

  const secundarias = [
    ...(onEditar ? [{ id: 'editar', label: 'Editar documento', onClick: onEditar }] : []),
    ...(onEliminar ? [{
      id: 'eliminar',
      label: doc.factura_asociada_id
        ? `Eliminar y restaurar la factura ${doc.factura_asociada_id}`
        : 'Eliminar documento',
      peligrosa: true,
      onClick: onEliminar,
    }] : []),
  ]

  return (
    <PanelDetalle
      tipo={clase ? CLASE_SINGULAR[clase] : 'Documento'}
      titulo={`${doc.tipo} ${doc.numero}`}
      etiqueta={`${doc.tipo} ${doc.numero} — ${doc.cliente}`}
      onCerrar={onCerrar}
      // Una nota emitida no tiene un siguiente paso: ya cumplió su función.
      // Editar y eliminar son excepcionales y viven detrás del •••.
      primaria={null}
      secundarias={secundarias}
      sinAcciones="Documento emitido"
    >
      <PanelCabecera
        titulo={doc.cliente}
        monto={<Money>{enUSD ? usd(doc.monto_usd) : ars(doc.monto_ars)}</Money>}
        montoAlt={enUSD && doc.monto_ars ? <Money>{ars(doc.monto_ars)}</Money> : undefined}
        estado={<Badge tone={clase === 'NC' ? 'danger' : 'warning'} sm>{doc.tipo}</Badge>}
        fecha={fdate(doc.fecha)}
        situacion={situacionDe(doc)}
      />

      {/* La relación con la factura, si existe. Hoy las 7 NC de producción la
          tienen vacía; el bloque aparece solo cuando hay algo que mostrar. */}
      {doc.factura_asociada_id && (
        <div className="ta-datos ta-datos--cobro">
          <Dato label={clase === 'NC' ? 'Factura anulada' : 'Factura ajustada'}>
            <span>{doc.factura_asociada_id}</span>
          </Dato>
        </div>
      )}

      <Mas titulo="Detalle contable">
        <div className="ta-datos">
          {/* Los tipos B no discriminan IVA: el desglose no se ofrece vacío. */}
          {muestraDesagregado(doc) ? (
            <>
              {doc.neto_ars ? <Dato label="Neto"><Money>{ars(doc.neto_ars)}</Money></Dato> : null}
              {doc.iva ? <Dato label="IVA 21%"><Money>{ars(doc.iva)}</Money></Dato> : null}
            </>
          ) : null}
          {doc.monto_ars ? <Dato label="Total ARS"><Money>{ars(doc.monto_ars)}</Money></Dato> : null}
          {doc.monto_usd ? <Dato label="Total USD"><Money>{usd(doc.monto_usd)}</Money></Dato> : null}
          {doc.tipo_cambio ? <Dato label="Tipo de cambio"><span className="ta-mono">${doc.tipo_cambio}</span></Dato> : null}
        </div>

        <dl className="ta-dl">
          <div><dt>Unidad</dt><dd>{doc.persona || '—'}</dd></div>
          <div><dt>Punto de venta</dt><dd>{puntoVentaDe(doc)}</dd></div>
          {doc.concepto && (
            <div className="ta-dl__full"><dt>Concepto</dt><dd>{doc.concepto}</dd></div>
          )}
        </dl>
      </Mas>
    </PanelDetalle>
  )
}
