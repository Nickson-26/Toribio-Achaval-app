'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { db, type Comprobante } from '@/lib/supabase'
import { usePermisos } from '@/design/usePermisos'
import { useEsMobile } from '@/design/useEsMobile'
import { useRouteParams } from '@/components/NavigationProvider'
import { ESTADOS_ORDEN } from '@/design/status'
import { ConfirmDialog, ErrorState, toast } from '@/design/primitives'
import { Money } from '@/components/HideNumbers'
import { ars } from '@/lib/utils'
import {
  NuevoComprobanteModal, EditarComprobanteModal, MarcarCobradaModal,
  ConfirmarAcreditacionModal, GestionarRetencionesModal,
} from '@/components/ComprobanteForms'
import { ExportarPendientesModal } from '@/components/facturacion/ExportarPendientes'
import { FacturasToolbar } from '@/components/facturacion/FacturasToolbar'
import { FacturasTabla, FacturasLista } from '@/components/facturacion/FacturasVistas'
import { FacturaPanel } from '@/components/facturacion/FacturaPanel'
import { Hoy, PorResolver } from '@/components/facturacion/PorResolver'
import {
  soloFacturas, aplicarFiltros, ordenar, contarPorTipo,
  opcionesAnio, opcionesUnidad, opcionesPuntoVenta, estadosPresentes,
  hayFiltros as tieneFiltros, accionesPara, calcularSenales, resumenHoy,
  tipoInicialPara, FILTROS_INICIALES,
  type FiltrosFacturacion, type TipoFactura, type AccionId, type Senal,
} from '@/lib/facturacion'

/**
 * FACTURACIÓN
 *
 * Tres capas, en el orden en que se trabaja:
 *
 *   HOY          una línea de contexto. Qué pasó recién.
 *   POR RESOLVER sólo las situaciones que existen hoy. Si no hay e-cheqs
 *                pendientes, no hay tarjeta de e-cheqs.
 *   EXPLORAR     las vistas A/B/FCE/E, buscador, filtros y la lista.
 *
 * La versión anterior era un panel de control: diez controles a la vista,
 * tres KPI permanentes y una tabla de once columnas. Se veía moderna, pero
 * seguía obligando a preguntarse "¿qué filtro pongo?" antes de poder trabajar.
 *
 * La regla acá es mostrar menos y mostrar lo correcto. Todo lo que se calcula
 * —las señales, el resumen del día, qué acciones existen— vive en
 * `lib/facturacion.ts`, que es puro y testeado; esta pantalla orquesta.
 *
 * Lo que NO cambió, a propósito: la lógica fiscal, el alta y la edición de
 * comprobantes, y todo el circuito de cobranza —`db.registrarCobro()` y las
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

  // Las señales miran el universo completo, no el tab ni los filtros: "tenés
  // 6 pagos esperando retenciones" no debe cambiar porque estés parado en
  // Facturas B. Son un recordatorio, no un reporte de lo que estás mirando.
  const senales   = useMemo(() => calcularSenales(todas), [todas])
  const hoy       = useMemo(() => resumenHoy(todas), [todas])

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

  /** Abrir una señal = filtrar la lista por sus estados y bajar hasta ella. */
  function abrirSenal(sen: Senal) {
    set({ ...FILTROS_INICIALES, estados: sen.estados })
    setAbierta(null)
    document.querySelector('.ta-explorar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className={`ta-mod${abierta ? ' is-panel' : ''}`}>
      <div className="ta-mod__main">
        {!cargando && (
          <header className="ta-mod__contexto">
            <Hoy r={hoy} />
            <PorResolver senales={senales} onAbrir={abrirSenal} />
          </header>
        )}

        <section className="ta-explorar" aria-label="Explorar facturas">
          <FacturasToolbar
            filtros={filtros}
            onChange={set}
            vista={tab}
            onVista={t => { setTab(t); setAbierta(null) }}
            conteos={porTipo}
            estados={estados}
            anios={anios}
            unidades={unidades}
            puntosVenta={pvs}
            puedeCrear={puedeHacer('comprobante.crear')}
            onNueva={() => setModal({ tipo: 'nueva' })}
            onExportar={() => setModal({ tipo: 'exportar' })}
          />

        {/* Se monta UNA de las dos, no las dos con una escondida por CSS:
            son los mismos comprobantes y dejar la otra en el DOM significa
            construir doscientas filas invisibles en cada render. */}
        {esMobile ? (
          <FacturasLista
            facturas={delTab}
            cargando={cargando}
            onAbrir={setAbierta}
            hayFiltros={conFiltros}
          />
        ) : (
          <FacturasTabla
            facturas={delTab}
            cargando={cargando}
            seleccionadaId={abierta?.id ?? null}
            onAbrir={setAbierta}
            hayFiltros={conFiltros}
          />
        )}
        </section>
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
        <NuevoComprobanteModal
          clientes={clientes}
          tipoInicial={tipoInicialPara(tab)}
          onClose={() => setModal(null)}
          onSaved={trasGuardar}
        />
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
