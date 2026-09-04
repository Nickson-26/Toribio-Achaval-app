'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { db, supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useNavigation } from '@/components/NavigationProvider'
import { usePermisos } from '@/design/usePermisos'
import { ErrorState } from '@/design/primitives'
import { NuevoComprobanteModal } from '@/components/ComprobanteForms'
import {
  saludo, aplicarFiltros, calcularAtencion, calcularResumen, construirActividad,
  ultimasFacturas, aniosDisponibles, mostrarFiltroAnio, unidadesDisponibles,
  FILTROS_INICIALES,
  type FiltrosHome, type AttentionItem, type Evento, type ComprobanteHome, type ReciboHome,
} from '@/lib/home'
import { AttentionList } from '@/components/home/AttentionList'
import { HomeFilters } from '@/components/home/HomeFilters'
import { QuickActions } from '@/components/home/QuickActions'
import {
  Section, SectionLink, FinancialSummary, RecentActivity, RecentInvoices, HomeSkeleton,
} from '@/components/home/HomeSections'

/**
 * INICIO — el punto desde donde empieza el trabajo.
 *
 * Reemplaza al dashboard ejecutivo. No es Reportes: no muestra todo lo que se
 * puede calcular, muestra lo que permite actuar.
 *
 * Orden de la pantalla, que es el orden mental del usuario:
 *   1. ¿Qué necesita mi atención?   -> Para revisar
 *   2. ¿Qué quiero hacer?           -> Acciones rápidas
 *   3. ¿Cómo está la situación?     -> Resumen (3 métricas)
 *   4. ¿Qué pasó recientemente?     -> Actividad
 *   5. ¿Dónde continúo?             -> Últimas facturas
 *
 * Cero gráficos. Todo el cálculo vive en `lib/home.ts`, que es puro y testeado.
 */
export default function Inicio({ onPendientesChange }: { onPendientesChange?: (n: number) => void }) {
  const { user } = useAuth()
  const { navigate } = useNavigation()
  const { puedeHacer } = usePermisos()

  const [comprobantes, setComprobantes] = useState<ComprobanteHome[]>([])
  const [recibos, setRecibos]           = useState<ReciboHome[]>([])
  const [solicitudes, setSolicitudes]   = useState(0)
  const [cargando, setCargando]         = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [filtros, setFiltros]           = useState<FiltrosHome>(FILTROS_INICIALES)
  const [nuevaFactura, setNuevaFactura] = useState(false)

  const puedeVerUsuarios = puedeHacer('usuarios.gestionar')

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      const { comprobantes: cs, recibos: rs } = await db.getInicioData()
      setComprobantes(cs); setRecibos(rs)

      // Sólo se consulta si el rol puede actuar sobre las solicitudes.
      if (puedeVerUsuarios) {
        const { count } = await supabase
          .from('usuarios').select('id', { count: 'exact', head: true }).eq('aprobado', false)
        setSolicitudes(count ?? 0)
      } else {
        setSolicitudes(0)
      }
    } catch (e: any) {
      setError(e?.message ?? 'Error desconocido')
    } finally {
      setCargando(false)
    }
  }, [puedeVerUsuarios])

  useEffect(() => { cargar() }, [cargar])

  // ── Derivados ─────────────────────────────────────────────────────────────
  const filtrados = useMemo(() => aplicarFiltros(comprobantes, filtros), [comprobantes, filtros])

  const atencion = useMemo(
    () => calcularAtencion(filtrados, { solicitudesPendientes: solicitudes, puedeVerUsuarios }),
    [filtrados, solicitudes, puedeVerUsuarios]
  )
  const resumen   = useMemo(() => calcularResumen(filtrados), [filtrados])
  const actividad = useMemo(() => construirActividad(filtrados, recibos, 6), [filtrados, recibos])
  const recientes = useMemo(() => ultimasFacturas(filtrados, 6), [filtrados])

  const anios     = useMemo(() => aniosDisponibles(comprobantes), [comprobantes])
  const hayAnios  = useMemo(() => mostrarFiltroAnio(comprobantes), [comprobantes])
  const unidades  = useMemo(() => unidadesDisponibles(comprobantes), [comprobantes])

  // El pill de la sidebar sigue reflejando las pendientes del universo completo,
  // no del filtro activo: es un contador global.
  useEffect(() => {
    const n = comprobantes.filter(
      c => (c.tipo ?? '').startsWith('FACT') && c.estado === 'pendiente'
    ).length
    onPendientesChange?.(n)
  }, [comprobantes, onPendientesChange])

  // ── Navegación desde los items ────────────────────────────────────────────
  function abrirAtencion(item: AttentionItem) {
    if (item.id === 'solicitudes') { navigate({ to: 'usuarios' }); return }
    navigate({ to: 'facturas', ...(item.estados ? { estado: item.estados } : {}) })
  }
  const abrirEvento = (e: Evento) =>
    navigate(e.tipo === 'recibo' ? { to: 'recibos' } : { to: 'facturas' })

  const set = (p: Partial<FiltrosHome>) => setFiltros(f => ({ ...f, ...p }))

  // ── Estados de pantalla ───────────────────────────────────────────────────
  if (cargando) return <HomeSkeleton />
  if (error) {
    return (
      <ErrorState
        description="No pudimos traer la información de tu inicio."
        detail={error}
        onRetry={cargar}
      />
    )
  }

  return (
    <div className="ta-home">
      {/* ── Encabezado: humano y simple. No es un hero.
             El subtítulo lo escribe el dato, no la plantilla: prometer "esto
             es lo que requiere tu atención" arriba de una lista vacía es la
             clase de texto que enseña a no leer los textos. ── */}
      <header className="ta-home__head">
        <div className="ta-home__id">
          <h1 className="ta-home__saludo">{saludo(user?.nombre)}</h1>
          <p className="ta-home__sub">
            {atencion.length > 0
              ? 'Esto es lo que requiere tu atención.'
              : 'No hay nada pendiente de tu lado.'}
          </p>
        </div>

        <HomeFilters
          filtros={filtros}
          onChange={set}
          anios={anios}
          unidades={unidades}
          mostrarAnio={hayAnios}
        />
      </header>

      {/* ── 1. Para revisar ──
             Sin encabezado propio: el subtítulo del saludo ya dijo qué es
             esto, y un "Para revisar" del mismo tamaño que los otros cuatro
             títulos convertía lo más importante de la pantalla en uno más de
             la fila. Es lo primero que se ve y va pegado al saludo. */}
      <AttentionList items={atencion} onAbrir={abrirAtencion} />

      {/* ── 2. Acciones rápidas ── */}
      <Section title="Accesos rápidos">
        <QuickActions onNuevaFactura={() => setNuevaFactura(true)} />
      </Section>

      {/* ── 3. Resumen ── */}
      <Section title="Resumen">
        <FinancialSummary r={resumen} />
      </Section>

      {/* ── 4 y 5. Actividad y últimas facturas ── */}
      <div className="ta-home__cols">
        <Section title="Actividad reciente">
          <RecentActivity eventos={actividad} onAbrir={abrirEvento} />
        </Section>

        <Section
          title="Últimas facturas"
          action={<SectionLink label="Ver todas" onClick={() => navigate({ to: 'facturas' })} />}
        >
          <RecentInvoices facturas={recientes} onAbrir={() => navigate({ to: 'facturas' })} />
        </Section>
      </div>

      {/* Reutiliza el alta existente sin tocar su lógica fiscal. */}
      {nuevaFactura && (
        <NuevoComprobanteModal
          clientes={Array.from(new Set(comprobantes.map(c => c.cliente).filter(Boolean) as string[]))}
          onClose={() => setNuevaFactura(false)}
          onSaved={() => { setNuevaFactura(false); cargar() }}
        />
      )}
    </div>
  )
}
