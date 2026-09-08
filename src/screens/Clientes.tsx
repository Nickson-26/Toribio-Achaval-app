'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Users, AlertCircle, ChevronRight } from 'lucide-react'
import { db, type Comprobante, type Recibo } from '@/lib/supabase'
import { Money } from '@/components/HideNumbers'
import { useNavigation } from '@/components/NavigationProvider'
import { Select, Field, Badge, StatusBadge, ErrorState } from '@/design/primitives'
import { ars, usd, fdate } from '@/lib/utils'
import {
  ContextoLinea, BarraExplorar, PanelDetalle, PanelCabecera, Dato, Mas,
  Movimiento, useVentana, Centinela, Vacio, SkeletonRows, type Chip,
} from '@/components/modulo'
import {
  agregarClientes, aplicarFiltros, chipsActivos, contarFiltros, hayFiltros,
  opcionesUnidad, resumenClientes, movimientosDe, situacionDe, volumenDe,
  montoPrincipal, montoSecundario,
  FILTROS_INICIALES, type Cliente, type FiltrosClientes,
} from '@/lib/clientes'

/**
 * CLIENTES.
 *
 * La versión anterior era una tabla de seis columnas ordenada por facturación,
 * sin detalle, sin acciones y sin mobile. Ordenar por "quién facturó más" con
 * 111 de 184 clientes que tienen un solo documento deja arriba una lista que
 * nadie busca.
 *
 * Ahora sigue el mismo recorrido que el resto de la aplicación:
 *
 *   contexto  ->  buscar / filtrar  ->  lista  ->  detalle con sus documentos
 *
 * No es un CRM y no lo va a ser: no hay pipeline, ni scoring, ni etiquetas, ni
 * fichas. Todo lo que se ve sale de documentos que ya existen. La tabla
 * `clientes` está vacía y no se escribe: la lista se deriva de los nombres que
 * aparecen en `comprobantes` y en `recibos`.
 */
export default function Clientes() {
  const { route, navigate } = useNavigation()

  const [comprobantes, setComprobantes] = useState<Comprobante[]>([])
  const [recibos, setRecibos] = useState<Recibo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtros, setFiltros] = useState<FiltrosClientes>({
    ...FILTROS_INICIALES,
    // La ruta ya sabía traer un término de búsqueda; hasta ahora nadie lo leía.
    buscar: (route.to === 'clientes' && route.buscar) || '',
  })
  const [sel, setSel] = useState<Cliente | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      const [cs, rs] = await Promise.all([db.getComprobantes(), db.getRecibos()])
      setComprobantes(cs); setRecibos(rs)
    } catch (e: any) { setError(e?.message ?? 'Error desconocido') }
    finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // ── Derivados ─────────────────────────────────────────────────────────────
  const todos = useMemo(
    () => agregarClientes(comprobantes, recibos), [comprobantes, recibos])
  const filtrados = useMemo(() => aplicarFiltros(todos, filtros), [todos, filtros])
  const contexto = useMemo(() => resumenClientes(todos), [todos])
  const unidades = useMemo(() => opcionesUnidad(todos), [todos])

  const set = (p: Partial<FiltrosClientes>) => setFiltros(f => ({ ...f, ...p }))

  function quitar(chip: Chip) {
    set({ [chip.clave]: FILTROS_INICIALES[chip.clave as keyof FiltrosClientes] } as Partial<FiltrosClientes>)
  }

  if (error) {
    return <ErrorState description="No pudimos traer los clientes." detail={error} onRetry={cargar} />
  }

  return (
    <div className={`ta-mod${sel ? ' is-panel' : ''}`}>
      <div className="ta-mod__main">
        {/* El contexto no es "cuántos clientes hay" —ese número no cambia
            nada— sino cuántos tienen algo sin cobrar. Sin pendientes, la
            línea se apaga. */}
        <div className="ta-mod__contexto">
          <ContextoLinea
            rotulo="Cobranza"
            icono={AlertCircle}
            activo={contexto.hayAlgo}
            texto={contexto.hayAlgo
              ? `${contexto.conPendientes} ${contexto.conPendientes === 1 ? 'cliente' : 'clientes'} ` +
                `con ${contexto.facturasPendientes} ${contexto.facturasPendientes === 1 ? 'factura pendiente' : 'facturas pendientes'}`
              : `sin facturas pendientes · ${contexto.total} clientes`}
          />
        </div>

        <section className="ta-explorar">
          <BarraExplorar
            buscar={filtros.buscar}
            onBuscar={v => set({ buscar: v })}
            placeholder="Buscar cliente o unidad…"
            placeholderCorto="Buscar cliente…"
            filtrosActivos={contarFiltros(filtros)}
            chips={chipsActivos(filtros) as Chip[]}
            onQuitarChip={quitar}
            onLimpiar={() => setFiltros(FILTROS_INICIALES)}
            hojaFiltros={
              <>
                <Field label="Unidad">
                  <Select value={filtros.unidad} onChange={e => set({ unidad: e.target.value })}>
                    <option value="all">Todas las unidades</option>
                    {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                  </Select>
                </Field>
                <Field label="Situación">
                  <Select
                    value={filtros.soloPendientes ? 'pend' : 'all'}
                    onChange={e => set({ soloPendientes: e.target.value === 'pend' })}
                  >
                    <option value="all">Todos los clientes</option>
                    <option value="pend">Sólo con facturas pendientes</option>
                  </Select>
                </Field>
              </>
            }
          />

          <ClientesVista
            clientes={filtrados}
            cargando={cargando}
            seleccionado={sel?.nombre ?? null}
            onAbrir={setSel}
            hayFiltros={hayFiltros(filtros) || !!filtros.buscar}
          />
        </section>
      </div>

      {sel && (
        <ClientePanel
          cliente={sel}
          movimientos={movimientosDe(sel.nombre, comprobantes, recibos)}
          onCerrar={() => setSel(null)}
          onVerFacturas={() => navigate({ to: 'facturas', buscar: sel.nombre })}
        />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   Las dos formas de mirar la lista
   ══════════════════════════════════════════════════════════════════════════
   Escritorio: cuatro columnas. Mobile: contactos —nombre arriba, situación y
   último movimiento abajo—. La misma decisión que en los otros módulos. */
function ClientesVista({
  clientes, cargando, seleccionado, onAbrir, hayFiltros,
}: {
  clientes: Cliente[]
  cargando: boolean
  seleccionado: string | null
  onAbrir: (c: Cliente) => void
  hayFiltros: boolean
}) {
  const { visibles, faltan, centinela, verMas } = useVentana(clientes)

  // La columna de situación sólo existe si en lo que se está mirando hay algo
  // pendiente. Es la misma regla adaptativa que la firma en Reservas: una
  // columna que dice lo mismo en todas las filas no distingue nada.
  const hayPendientes = clientes.some(c => c.pendientes > 0)

  if (cargando) return <SkeletonRows rows={8} />
  if (!clientes.length) {
    return <Vacio icono={Users} hayFiltros={hayFiltros}
      vacio="Todavía no hay clientes" filtrado="Ningún cliente coincide" />
  }

  return (
    <>
      {/* ── Escritorio ── */}
      <div className="ta-tabla-wrap ta-only-desktop">
        <table className="ta-tabla">
          <thead>
            <tr>
              <th className="ta-tabla__prop">Cliente</th>
              <th className="ta-num ta-tabla__docs">Docs.</th>
              {hayPendientes && <th className="ta-tabla__op">Situación</th>}
              <th className="ta-num ta-tabla__importe">Facturado</th>
              <th className="ta-tabla__fecha">Último</th>
              <th className="ta-fila__chev"><span className="ta-sr">Abrir</span></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(c => (
              <tr
                key={c.nombre}
                className={`ta-fila${seleccionado === c.nombre ? ' is-sel' : ''}`}
                onClick={() => onAbrir(c)}
                tabIndex={0}
                role="button"
                aria-label={`Abrir ${c.nombre}. ${situacionDe(c)}`}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(c) }
                }}
              >
                <td className="ta-fila__cliente ta-tabla__prop" title={c.nombre}>
                  <span className="ta-fila__n2">{c.nombre}</span>
                  {/* Las unidades que le facturaron no sirven para elegir un
                      cliente, pero sí para confirmar que es el correcto.
                      Aparecen al acercarse, como en el resto de la app. */}
                  <span className="ta-fila__pv">{c.unidades.join(' · ') || 'Sin unidad'}</span>
                </td>
                {/* Un número, no el desglose: "6 facturas · 3 recibos" se
                    cortaba con el panel abierto, y el detalle lo tiene
                    completo. */}
                <td className="ta-num ta-tabla__docs ta-fila__docs">
                  {c.documentos + c.recibos}
                </td>
                {hayPendientes && (
                  <td className="ta-tabla__op">
                    {/* Lo pendiente es lo único que pide acción: sólo eso
                        lleva color. */}
                    {c.pendientes > 0
                      ? <Badge tone="warning" sm>{c.pendientes} pendiente{c.pendientes === 1 ? '' : 's'}</Badge>
                      : <span className="ta-fila__nada">—</span>}
                  </td>
                )}
                <td className="ta-num ta-tabla__importe ta-fila__total">
                  <Money>{montoPrincipal(c).moneda === 'usd' ? usd(montoPrincipal(c).valor) : ars(montoPrincipal(c).valor)}</Money>
                  {montoSecundario(c) ? <Money className="ta-fila__usd">{usd(montoSecundario(c)!.valor)}</Money> : null}
                </td>
                <td className="ta-fila__fecha">{c.ultimo ? fdate(c.ultimo) : '—'}</td>
                <td className="ta-fila__chev"><ChevronRight size={15} aria-hidden /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Centinela faltan={faltan} refEl={centinela} onVerMas={verMas} />
      </div>

      {/* ── Mobile ── */}
      <div className="ta-movs ta-only-mobile">
        {visibles.map(c => (
          <Movimiento
            key={c.nombre}
            titulo={c.nombre}
            monto={<Money>{montoPrincipal(c).moneda === 'usd' ? usd(montoPrincipal(c).valor) : ars(montoPrincipal(c).valor)}</Money>}
            meta={`${volumenDe(c)}${c.ultimo ? ` · ${fdate(c.ultimo).slice(0, 5)}` : ''}`}
            estado={c.pendientes > 0
              ? <Badge tone="warning" sm>{c.pendientes} pend.</Badge>
              : null}
            onAbrir={() => onAbrir(c)}
            ariaLabel={`${c.nombre}. ${situacionDe(c)}. ${volumenDe(c)}`}
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
function ClientePanel({
  cliente, movimientos, onCerrar, onVerFacturas,
}: {
  cliente: Cliente
  movimientos: ReturnType<typeof movimientosDe>
  onCerrar: () => void
  onVerFacturas: () => void
}) {
  // Diez alcanzan para entender qué pasó; el resto está en Facturación, que
  // es donde se opera. Duplicar acá la lista completa sería un segundo
  // Facturación peor.
  const primeros = movimientos.slice(0, 10)

  return (
    <PanelDetalle
      tipo="Cliente"
      titulo={cliente.nombre}
      etiqueta={`Cliente ${cliente.nombre}`}
      onCerrar={onCerrar}
      // Clientes es una pantalla de consulta: no se opera sobre un cliente,
      // se opera sobre sus documentos. La primaria lleva ahí.
      primaria={cliente.facturas > 0
        ? { label: 'Ver sus facturas', onClick: onVerFacturas }
        : null}
      sinAcciones="Sin documentos para operar"
    >
      {/* El nombre ya está en el encabezado del panel: acá arriba va lo que
          tiene, que es la otra mitad de la respuesta. Repetirlo dos veces a
          cuatro píxeles de distancia no agrega nada. */}
      <PanelCabecera
        titulo={volumenDe(cliente)}
        monto={<Money>{montoPrincipal(cliente).moneda === 'usd'
          ? usd(montoPrincipal(cliente).valor)
          : ars(montoPrincipal(cliente).valor)}</Money>}
        montoAlt={montoSecundario(cliente)
          ? <Money>{usd(montoSecundario(cliente)!.valor)}</Money> : undefined}
        estado={cliente.pendientes > 0
          ? <Badge tone="warning" sm>{cliente.pendientes} pendiente{cliente.pendientes === 1 ? '' : 's'}</Badge>
          : <Badge tone="success" sm>Al día</Badge>}
        fecha={cliente.ultimo ? fdate(cliente.ultimo) : undefined}
        situacion={situacionDe(cliente)}
      />

      {/* La línea de tiempo: facturas, notas y recibos mezclados. Es la
          pregunta que se hace quien abre un cliente —"¿qué pasó con este?"—
          y no tres listas que hay que reconciliar mentalmente. */}
      {primeros.length > 0 && (
        <div className="ta-movcli">
          <h3 className="ta-movcli__titulo">Últimos movimientos</h3>
          {primeros.map(m => (
            <div key={m.clave} className="ta-movcli__row">
              <span className="ta-movcli__id">{m.titulo}</span>
              <span className="ta-movcli__fecha">{fdate(m.fecha)}</span>
              <Money className="ta-movcli__monto">
                {m.usd ? usd(m.usd) : ars(m.ars)}
              </Money>
              {m.estado
                ? <StatusBadge estado={m.estado as any} sm />
                : <Badge tone="success" sm>Recibo</Badge>}
            </div>
          ))}
          {movimientos.length > primeros.length && (
            <p className="ta-movcli__mas">
              y {movimientos.length - primeros.length} movimientos más
            </p>
          )}
        </div>
      )}

      <Mas titulo="Más datos">
        <div className="ta-datos">
          <Dato label="Facturas"><span>{cliente.facturas}</span></Dato>
          {cliente.notas > 0 ? <Dato label="Notas de crédito/débito"><span>{cliente.notas}</span></Dato> : null}
          <Dato label="Recibos"><span>{cliente.recibos}</span></Dato>
          {cliente.pendientes > 0
            ? <Dato label="Facturas pendientes"><span>{cliente.pendientes}</span></Dato> : null}
          {cliente.porCerrar > 0
            ? <Dato label="Cobros sin cerrar"><span>{cliente.porCerrar}</span></Dato> : null}
        </div>
        <dl className="ta-dl">
          <div className="ta-dl__full">
            <dt>Unidades que le facturaron</dt>
            <dd>{cliente.unidades.join(' · ') || '—'}</dd>
          </div>
        </dl>
      </Mas>
    </PanelDetalle>
  )
}
