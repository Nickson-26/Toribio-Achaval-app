'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { db, type Comprobante } from '@/lib/supabase'
import { usePermisos } from '@/design/usePermisos'
import { useEsMobile } from '@/design/useEsMobile'
import { useRouteParams } from '@/components/NavigationProvider'
import { ESTADOS_ORDEN } from '@/design/status'
import {
  Button, ConfirmDialog, ErrorState, toast,
} from '@/design/primitives'
import { Money } from '@/components/HideNumbers'
import { ars, usd } from '@/lib/utils'
import {
  NuevoComprobanteModal, EditarComprobanteModal, MarcarCobradaModal,
  ConfirmarAcreditacionModal, GestionarRetencionesModal,
} from '@/components/ComprobanteForms'
import { ExportarPendientesModal } from '@/components/facturacion/ExportarPendientes'
import { FacturasToolbar } from '@/components/facturacion/FacturasToolbar'
import { FacturasTabla, FacturasLista } from '@/components/facturacion/FacturasVistas'
import { FacturaPanel } from '@/components/facturacion/FacturaPanel'
import {
  soloFacturas, aplicarFiltros, ordenar, contarPorTipo, calcularTotales,
  opcionesAnio, opcionesUnidad, opcionesPuntoVenta, estadosPresentes,
  hayFiltros as tieneFiltros, accionesPara,
  TIPOS_FACTURA, TIPO_LABEL, FILTROS_INICIALES,
  type FiltrosFacturacion, type TipoFactura, type AccionId,
} from '@/lib/facturacion'

/**
 * FACTURACIÓN — la pantalla operativa.
 *
 * Esta pantalla orquesta; no calcula. Filtros, totales, conteos y sobre todo
 * QUÉ ACCIONES existen viven en `lib/facturacion.ts`, que es puro y testeado.
 *
 * Lo que cambió respecto de la versión anterior:
 *
 *   · La búsqueda dejó de ir al servidor. Antes buscar recargaba desde la base
 *     mientras los otros filtros trabajaban en memoria — dos universos, y los
 *     conteos no cerraban entre sí. Se carga una vez y todo se filtra sobre
 *     ese mismo conjunto.
 *   · Los permisos existen. La versión anterior no importaba usePermisos: un
 *     viewer veía Editar, Anular y Eliminar. Ahora las acciones salen de
 *     accionesPara(), que ya filtra por rol.
 *   · El detalle es un panel al costado, no un modal que tapa la lista.
 *   · Mobile tiene su propia lista de tarjetas.
 *
 * Lo que NO cambió, a propósito: la lógica fiscal, el alta y la edición de
 * comprobantes, y todo el circuito de cobranza —`db.registrarCobro()`, las
 * ramas de cobrada / faltan retenciones / e-cheq / acreditación—. Se rediseñó
 * cómo se llega a esos formularios, no lo que hacen.
 */
type Modal =
  | { tipo: 'nueva' }
  | { tipo: 'exportar' }
  | { tipo: 'editar' | 'cobrar' | 'acreditacion' | 'retenciones' | 'anular' | 'eliminar', comp: Comprobante }
  | null

export default function Facturas({ onPendientesChange }: { onPendientesChange?: (n: number) => void }) {
  const params = useRouteParams('facturas')
  const { puedeHacer } = usePermisos()
  const esMobile = useEsMobile()

  const [todas,    setTodas]    = useState<Comprobante[]>([])
  const [cargando, setCargando] = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [modal,    setModal]    = useState<Modal>(null)
  const [abierta,  setAbierta]  = useState<Comprobante | null>(null)
  const [pdfSubiendo, setPdfSubiendo] = useState(false)
  const [ocupado,  setOcupado]  = useState(false)

  const [tab, setTab] = useState<TipoFactura>(
    (params?.tab as TipoFactura) ?? 'FACT A',
  )
  const [filtros, setFiltros] = useState<FiltrosFacturacion>({
    ...FILTROS_INICIALES,
    buscar: params?.buscar ?? '',
    estados: (params?.estado as any) ?? [],
  })

  const set = (p: Partial<FiltrosFacturacion>) => setFiltros(f => ({ ...f, ...p }))

  // ── Carga ─────────────────────────────────────────────────────────────────
  // Una sola vez, sin filtros en la consulta: los filtros son locales para que
  // la búsqueda y el resto hablen del mismo universo.
  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      setTodas(soloFacturas(await db.getComprobantes()))
    } catch (e: any) {
      setError(e?.message ?? 'Error desconocido')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // ── Derivados ─────────────────────────────────────────────────────────────
  const filtradas = useMemo(() => aplicarFiltros(todas, filtros), [todas, filtros])
  const porTipo   = useMemo(() => contarPorTipo(filtradas), [filtradas])
  const delTab    = useMemo(
    () => ordenar(filtradas.filter(c => c.tipo === tab)),
    [filtradas, tab],
  )
  const totales   = useMemo(() => calcularTotales(delTab), [delTab])

  const anios     = useMemo(() => opcionesAnio(todas), [todas])
  const unidades  = useMemo(() => opcionesUnidad(todas), [todas])
  const pvs       = useMemo(() => opcionesPuntoVenta(todas), [todas])
  const estados   = useMemo(() => estadosPresentes(todas, ESTADOS_ORDEN), [todas])

  // Todas las pendientes del universo, no del tab: el Excel de cobranzas se
  // arma con todo lo que hay por cobrar.
  const pendientesTodas = useMemo(
    () => todas.filter(c => c.estado === 'pendiente').sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0)),
    [todas],
  )

  const clientes = useMemo(
    () => [...new Set(todas.map(c => c.cliente).filter(Boolean))],
    [todas],
  )

  // El pill de la sidebar refleja el universo completo, no el filtro activo.
  useEffect(() => {
    onPendientesChange?.(todas.filter(c => c.estado === 'pendiente').length)
  }, [todas, onPendientesChange])

  // ── Navegación entre facturas dentro del panel ────────────────────────────
  const idx = abierta ? delTab.findIndex(c => c.id === abierta.id) : -1
  const irA = (delta: number) => {
    const siguiente = delTab[idx + delta]
    if (siguiente) setAbierta(siguiente)
  }

  // ── Acciones ──────────────────────────────────────────────────────────────
  function ejecutar(comp: Comprobante, id: AccionId) {
    // Segunda barrera: aunque un botón se colara, la acción no corre si el rol
    // no la tiene. La autoridad real sigue siendo RLS.
    if (!accionesPara(comp, puedeHacer).some(a => a.id === id)) return
    if (id === 'ver') { setAbierta(comp); return }
    setModal({ tipo: id as Exclude<AccionId, 'ver'>, comp })
  }

  async function confirmarAnular(comp: Comprobante) {
    setOcupado(true)
    try {
      await db.deleteComprobante(comp.id)
      toast(`Comprobante ${comp.id} anulado`)
      const nuevas = todas.map(c => c.id === comp.id ? { ...c, estado: 'anulada' as const } : c)
      setTodas(nuevas)
      setAbierta(a => a?.id === comp.id ? { ...a, estado: 'anulada' as const } : a)
      setModal(null)
    } catch (e: any) {
      toast('Error al anular: ' + (e.message || ''))
    } finally { setOcupado(false) }
  }

  async function confirmarEliminar(comp: Comprobante) {
    setOcupado(true)
    try {
      await db.eliminarComprobante(comp.id)
      toast(`${comp.id} eliminada`)
      setTodas(cs => cs.filter(c => c.id !== comp.id))
      if (abierta?.id === comp.id) setAbierta(null)
      setModal(null)
    } catch (e: any) {
      toast(e.message || 'Error al eliminar')
    } finally { setOcupado(false) }
  }

  async function subirPDF(comp: Comprobante, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPdfSubiendo(true)
    try {
      const path = await db.uploadComprobantePDF(comp.id, file)
      toast('PDF adjuntado')
      setAbierta(a => a ? { ...a, pdf_url: path } : a)
      setTodas(cs => cs.map(c => c.id === comp.id ? { ...c, pdf_url: path } : c))
    } catch (err: any) {
      toast('Error al subir PDF: ' + err.message)
    } finally {
      setPdfSubiendo(false)
      e.target.value = ''
    }
  }

  async function verPDF(comp: Comprobante) {
    if (!comp.pdf_url) return
    try {
      window.open(await db.getPDFSignedUrl(comp.pdf_url), '_blank')
    } catch (err: any) {
      toast('Error al abrir PDF: ' + err.message)
    }
  }

  /** Tras guardar en cualquier formulario: recargar y refrescar el panel. */
  const trasGuardar = async () => {
    setModal(null)
    const frescas = soloFacturas(await db.getComprobantes())
    setTodas(frescas)
    setAbierta(a => a ? frescas.find(c => c.id === a.id) ?? null : null)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <ErrorState
        description="No pudimos traer las facturas."
        detail={error}
        onRetry={cargar}
      />
    )
  }

  const conFiltros = tieneFiltros(filtros)

  return (
    <div className={`ta-fact${abierta ? ' is-panel' : ''}`}>
      <div className="ta-fact__main">
        <FacturasToolbar
          filtros={filtros}
          onChange={set}
          estados={estados}
          anios={anios}
          unidades={unidades}
          puntosVenta={pvs}
          puedeCrear={puedeHacer('comprobante.crear')}
          onNueva={() => setModal({ tipo: 'nueva' })}
          onExportar={() => setModal({ tipo: 'exportar' })}
          pendientes={pendientesTodas.length}
        />

        {/* Los tabs cuentan con el resto de los filtros ya aplicados: si
            filtro por pendientes, "Facturas B" dice cuántas B pendientes hay. */}
        <div className="ta-ftabs" role="tablist" aria-label="Tipo de comprobante">
          {TIPOS_FACTURA.map(t => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`ta-ftab${tab === t ? ' is-on' : ''}`}
              onClick={() => { setTab(t); setAbierta(null) }}
            >
              {TIPO_LABEL[t]}
              <span className="ta-ftab__n">{porTipo[t]}</span>
            </button>
          ))}
        </div>

        <div className="ta-fkpis">
          <Kpi label="Facturado" valor={<Money>{ars(totales.ars)}</Money>}
            nota={`${totales.cantidad} ${totales.cantidad === 1 ? 'comprobante' : 'comprobantes'}`} />
          <Kpi label="En dólares" valor={<Money>{usd(totales.usd)}</Money>}
            nota={`${totales.cantidadUSD} ${totales.cantidadUSD === 1 ? 'factura' : 'facturas'}`} />
          <Kpi
            label="Por cobrar"
            valor={<span className={totales.pendientes ? 'ta-fkpi__alerta' : ''}>{totales.pendientes}</span>}
            nota={totales.faltanRetenciones > 0
              ? `${totales.faltanRetenciones} con retenciones pendientes`
              : 'sin pendientes de retención'}
          />
        </div>

        {/* Se monta UNA de las dos, no las dos con una escondida por CSS:
            son los mismos comprobantes y dejar la otra en el DOM significa
            construir doscientas filas invisibles en cada render. */}
        {esMobile ? (
          <FacturasLista
            facturas={delTab}
            cargando={cargando}
            onAbrir={setAbierta}
            onAccion={ejecutar}
            puedeHacer={puedeHacer}
            hayFiltros={conFiltros}
          />
        ) : (
          <FacturasTabla
            facturas={delTab}
            tipo={tab}
            cargando={cargando}
            seleccionadaId={abierta?.id ?? null}
            onAbrir={setAbierta}
            hayFiltros={conFiltros}
            compacta={!!abierta}
          />
        )}
      </div>

      {abierta && (
        <FacturaPanel
          comp={abierta}
          onClose={() => setAbierta(null)}
          onAccion={id => ejecutar(abierta, id)}
          puedeHacer={puedeHacer}
          onAnterior={idx > 0 ? () => irA(-1) : undefined}
          onSiguiente={idx >= 0 && idx < delTab.length - 1 ? () => irA(1) : undefined}
          pdfSubiendo={pdfSubiendo}
          onSubirPDF={e => subirPDF(abierta, e)}
          onVerPDF={() => verPDF(abierta)}
        />
      )}

      {/* ── Formularios reutilizados sin tocar su lógica ── */}
      {modal?.tipo === 'nueva' && (
        <NuevoComprobanteModal clientes={clientes} onClose={() => setModal(null)} onSaved={trasGuardar} />
      )}
      {modal?.tipo === 'editar' && (
        <EditarComprobanteModal comp={modal.comp} onClose={() => setModal(null)} onSaved={trasGuardar} />
      )}
      {modal?.tipo === 'cobrar' && (
        <MarcarCobradaModal comp={modal.comp} onClose={() => setModal(null)} onSaved={trasGuardar} />
      )}
      {modal?.tipo === 'acreditacion' && (
        <ConfirmarAcreditacionModal comp={modal.comp} onClose={() => setModal(null)} onSaved={trasGuardar} />
      )}
      {modal?.tipo === 'retenciones' && (
        <GestionarRetencionesModal comp={modal.comp} onClose={() => setModal(null)} onSaved={trasGuardar} />
      )}
      {modal?.tipo === 'exportar' && (
        <ExportarPendientesModal pendientes={pendientesTodas} onClose={() => setModal(null)} />
      )}

      {modal?.tipo === 'anular' && (
        <ConfirmDialog
          title={`Anular ${modal.comp.id}`}
          message={<>
            <p><strong>{modal.comp.cliente}</strong> — <Money>{ars(modal.comp.monto_ars)}</Money></p>
            <p style={{ marginTop: 8 }}>
              Queda marcada como anulada y deja de sumar a la facturación. El comprobante no se borra.
            </p>
          </>}
          confirmLabel="Anular factura"
          loading={ocupado}
          onConfirm={() => confirmarAnular(modal.comp)}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.tipo === 'eliminar' && (
        <ConfirmDialog
          title={`Eliminar ${modal.comp.id}`}
          message={<>
            <p><strong>{modal.comp.cliente}</strong> — <Money>{ars(modal.comp.monto_ars)}</Money></p>
            <p style={{ marginTop: 8 }}>
              Se borra la fila de forma permanente. Si sólo querés que deje de contar, usá Anular.
            </p>
          </>}
          confirmLabel="Eliminar definitivamente"
          danger
          loading={ocupado}
          onConfirm={() => confirmarEliminar(modal.comp)}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  )
}

function Kpi({ label, valor, nota }: { label: string; valor: React.ReactNode; nota: string }) {
  return (
    <div className="ta-fkpi">
      <span className="ta-fkpi__label">{label}</span>
      <span className="ta-fkpi__valor">{valor}</span>
      <span className="ta-fkpi__nota">{nota}</span>
    </div>
  )
}
