'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  SlidersHorizontal, X, MoreHorizontal, ChevronRight,
  ChevronUp as FlechaArriba, ChevronDown as FlechaAbajo,
} from 'lucide-react'
import { Button, IconButton, SearchInput, Modal, EmptyState, SkeletonRows } from '@/design/primitives'
import { useEsMobile } from '@/design/useEsMobile'
import type { LucideIcon } from 'lucide-react'

/**
 * PATRONES DE MÓDULO
 *
 * Facturación, Recibos y Reservas hacen lo mismo: mostrar qué está pasando,
 * dejar encontrar un registro y dejar operar sobre él. Antes cada una lo
 * resolvía por su cuenta —tres toolbars distintas, tres tablas distintas, tres
 * formas de abrir un detalle— y navegar la app se sentía como recorrer tres
 * generaciones del mismo producto.
 *
 * Acá viven las piezas compartidas. No es una abstracción a futuro: son
 * exactamente los componentes que ya funcionaban en Facturación, con los
 * nombres despegados de "factura" y los datos entrando por props.
 *
 * El recorrido que repiten las tres pantallas, y que es lo que hace que la
 * app se aprenda sola:
 *
 *     BUSCAR  ->  SELECCIONAR  ->  ENTENDER  ->  ACTUAR
 */

/* ══════════════════════════════════════════════════════════════════════════
   1. CONTEXTO — una línea, con presencia según el dato
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Un renglón que contesta "¿pasó algo?" y nada más.
 *
 * Cuando pasó algo se enciende: el indicador crece a una pastilla de color y
 * aparece el importe. Cuando no pasó nada es texto terciario que se puede
 * saltear con la vista. Es la misma línea en los dos casos — no una tarjeta
 * que aparece y empuja todo lo de abajo.
 */
export function ContextoLinea({
  rotulo, icono: Icono, activo, texto, monto,
}: {
  rotulo: string
  icono: LucideIcon
  activo: boolean
  texto: React.ReactNode
  monto?: React.ReactNode
}) {
  return (
    <p className={`ta-hoy${activo ? ' is-activo' : ''}`}>
      <span className="ta-hoy__pin" aria-hidden>{activo ? <Icono size={13} /> : null}</span>
      <span className="ta-hoy__label">{rotulo}</span>
      <span className={`ta-hoy__txt${activo ? '' : ' ta-hoy__txt--quieto'}`}>{texto}</span>
      {activo && monto ? <span className="ta-hoy__monto">{monto}</span> : null}
    </p>
  )
}

export type SenalTono = 'warning' | 'info' | 'violet' | 'success'

export type SenalItem = {
  id: string
  titulo: string
  detalle: string
  detalleCorto: string
  nota?: string
  monto?: React.ReactNode
  tono: SenalTono
}

/**
 * Situaciones que requieren acción. Sólo las que existen.
 *
 * Una señal con cero casos ocupa el mismo lugar que una con veinte, así que
 * no se renderiza. Y no hay acciones acá: esto anticipa trabajo, no lo ejecuta.
 */
export function Senales({
  titulo = 'Por resolver', senales, onAbrir,
}: {
  titulo?: string
  senales: SenalItem[]
  onAbrir: (s: SenalItem) => void
}) {
  if (!senales.length) return null
  return (
    <section className="ta-resolver" aria-label="Situaciones que requieren acción">
      <h2 className="ta-resolver__titulo">{titulo}</h2>
      <div className="ta-resolver__lista">
        {senales.map(s => (
          <button
            key={s.id}
            type="button"
            className={`ta-senal ta-senal--${s.tono}`}
            onClick={() => onAbrir(s)}
            aria-label={`${s.titulo}: ${s.detalle}${s.nota ? `. ${s.nota}` : ''}`}
          >
            <span className="ta-senal__pin" aria-hidden />
            <span className="ta-senal__cuerpo">
              <span className="ta-senal__titulo">{s.titulo}</span>
              <span className="ta-senal__detalle ta-senal__detalle--largo">
                {s.detalle}{s.nota && <> · {s.nota}</>}
              </span>
              <span className="ta-senal__detalle ta-senal__detalle--corto">{s.detalleCorto}</span>
            </span>
            {s.monto ? <span className="ta-senal__monto">{s.monto}</span> : null}
            <ChevronRight size={16} className="ta-senal__chev" aria-hidden />
          </button>
        ))}
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   2. SEGMENTADO — un control, no cuatro botones
   ══════════════════════════════════════════════════════════════════════════ */

export type Vista = { id: string; label: string; corto: string; n?: number }

/**
 * La cápsula es un solo elemento que se desplaza: `--i` lleva el índice activo
 * y `--n` la cantidad, así el CSS calcula la posición sin medir nada en JS.
 */
export function Segmentado({
  vistas, activa, onCambiar, etiqueta,
}: {
  vistas: Vista[]
  activa: string
  onCambiar: (id: string) => void
  etiqueta: string
}) {
  const i = Math.max(0, vistas.findIndex(v => v.id === activa))
  return (
    <div
      className="ta-vistas" role="tablist" aria-label={etiqueta}
      style={{ ['--n' as string]: vistas.length, ['--i' as string]: i }}
    >
      <span className="ta-vistas__capsula" aria-hidden />
      {vistas.map(v => (
        <button
          key={v.id}
          role="tab"
          aria-selected={activa === v.id}
          className={`ta-vista${activa === v.id ? ' is-on' : ''}`}
          onClick={() => onCambiar(v.id)}
        >
          {/* El rótulo largo no entra en 390px: en mobile queda el corto. */}
          <span className="ta-vista__label--largo">{v.label}</span>
          <span className="ta-vista__label--corto">{v.corto}</span>
          {v.n !== undefined && <span className="ta-vista__n">{v.n}</span>}
        </button>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   3. BARRA — buscar, filtrar, y una acción primaria
   ══════════════════════════════════════════════════════════════════════════ */

export type Chip = { clave: string; valor?: string; label: string }

/**
 * Lo permanente es: qué busco, un botón de filtros con su badge, y la acción
 * principal. Todo lo demás vive dentro de la hoja.
 *
 * Lo que sí queda a la vista son los filtros ACTIVOS, porque sin eso una
 * lista corta es indistinguible de una vacía y el usuario no ve por qué le
 * faltan filas.
 */
export function BarraExplorar({
  buscar, onBuscar, placeholder, placeholderCorto,
  filtrosActivos, chips, onQuitarChip, onLimpiar,
  hojaFiltros, acciones, primaria, primariaMobile,
}: {
  buscar: string
  onBuscar: (v: string) => void
  placeholder: string
  placeholderCorto?: string
  filtrosActivos: number
  chips: Chip[]
  onQuitarChip: (c: Chip) => void
  onLimpiar: () => void
  /** Contenido de la hoja de filtros secundarios. */
  hojaFiltros: React.ReactNode
  /** Acciones excepcionales, detrás de •••. */
  acciones?: AccionMenu[]
  primaria?: { label: string; icon: LucideIcon; onClick: () => void }
  /** Etiqueta accesible del botón primario reducido a icono en mobile. */
  primariaMobile?: string
}) {
  const [hoja, setHoja] = useState(false)
  const esMobile = useEsMobile()
  const Icono = primaria?.icon

  return (
    <div className="ta-barra">
      <div className="ta-barra__row">
        <SearchInput
          value={buscar}
          onChange={onBuscar}
          placeholder={esMobile && placeholderCorto ? placeholderCorto : placeholder}
          ariaLabel={placeholder}
          className="ta-barra__search"
        />

        <button
          type="button"
          className="ta-barra__filtros"
          onClick={() => setHoja(true)}
          aria-label={`Filtros${filtrosActivos ? `, ${filtrosActivos} activos` : ''}`}
        >
          <SlidersHorizontal size={15} aria-hidden />
          <span>Filtros</span>
          {filtrosActivos > 0 && <span className="ta-barra__dot">{filtrosActivos}</span>}
        </button>

        <span className="ta-barra__sep" />

        {/* Importar, exportar y administrar no son acciones de todos los días.
            Viven detrás del ••• para no competir con la primaria. */}
        {acciones && acciones.length > 0 && <MenuAcciones acciones={acciones} />}

        {primaria && Icono && (
          <>
            <Button
              variant="primary" size="sm" icon={Icono}
              onClick={primaria.onClick} className="ta-only-desktop"
            >
              {primaria.label}
            </Button>
            {/* En mobile no hay ancho para el texto, así que es el mismo botón
                sin rótulo. No desaparece: eso dejaría al usuario sin poder
                dar de alta desde el teléfono. */}
            <button
              type="button"
              className="ta-btn ta-btn--primary ta-barra__nueva"
              onClick={primaria.onClick}
              aria-label={primariaMobile ?? primaria.label}
              title={primariaMobile ?? primaria.label}
            >
              <Icono size={18} aria-hidden />
            </button>
          </>
        )}
      </div>

      {chips.length > 0 && (
        <div className="ta-barra__chips">
          {chips.map((c, i) => (
            <button
              key={`${c.clave}-${c.valor ?? i}`}
              type="button"
              className="ta-barra__chip"
              onClick={() => onQuitarChip(c)}
              aria-label={`Quitar filtro ${c.label}`}
            >
              {c.label}
              <X size={12} aria-hidden />
            </button>
          ))}
          <button type="button" className="ta-barra__limpiar" onClick={onLimpiar}>Limpiar</button>
        </div>
      )}

      {hoja && (
        <Modal
          title="Filtros"
          size="sm"
          onClose={() => setHoja(false)}
          footer={<>
            <Button variant="ghost" onClick={onLimpiar} disabled={filtrosActivos === 0}>Limpiar</Button>
            <Button variant="primary" onClick={() => setHoja(false)}>Ver resultados</Button>
          </>}
        >
          <div className="ta-hojaf">{hojaFiltros}</div>
        </Modal>
      )}
    </div>
  )
}

export type AccionMenu = { id: string; label: string; onClick: () => void; peligrosa?: boolean }

/**
 * Acciones que no son el siguiente paso. Cerrado por defecto.
 *
 * Escape cierra el menú y NO lo que haya detrás: se escucha en fase de
 * captura y se corta la propagación. Si no, abrir el menú por error costaba
 * perder el registro que estabas mirando.
 */
export function MenuAcciones({
  acciones, etiqueta = 'Más acciones',
}: { acciones: AccionMenu[]; etiqueta?: string }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAbierto(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc, true)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', esc, true)
    }
  }, [abierto])

  if (!acciones.length) return null

  return (
    <div className="ta-accmenu" ref={ref}>
      <IconButton
        icon={MoreHorizontal}
        label={etiqueta}
        aria-expanded={abierto}
        onClick={() => setAbierto(v => !v)}
      />
      {abierto && (
        <div className="ta-accmenu__pop" role="menu">
          {acciones.map(a => (
            <button
              key={a.id}
              role="menuitem"
              className={`ta-accmenu__item${a.peligrosa ? ' is-peligro' : ''}`}
              onClick={() => { setAbierto(false); a.onClick() }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   4. RENDER INCREMENTAL
   ══════════════════════════════════════════════════════════════════════════
   No hay paginación server-side: se sigue cargando el universo completo para
   que los totales no cambien de significado. Lo que se evita es pintar
   doscientas filas de una — se renderiza una ventana y crece al llegar al
   final. */
const PAGINA = 60

export function useVentana<T>(items: T[]) {
  const [n, setN] = useState(PAGINA)
  const centinela = useRef<HTMLDivElement>(null)

  useEffect(() => { setN(PAGINA) }, [items])

  useEffect(() => {
    const el = centinela.current
    if (!el || n >= items.length) return
    const io = new IntersectionObserver(
      es => { if (es[0]?.isIntersecting) setN(v => v + PAGINA) },
      { rootMargin: '400px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [n, items.length])

  return {
    visibles: useMemo(() => items.slice(0, n), [items, n]),
    faltan: Math.max(0, items.length - n),
    centinela,
    verMas: () => setN(v => v + PAGINA),
  }
}

export function Centinela({
  faltan, refEl, onVerMas,
}: { faltan: number; refEl: React.RefObject<HTMLDivElement>; onVerMas: () => void }) {
  if (faltan <= 0) return null
  return (
    <div ref={refEl} className="ta-vermas">
      {/* El botón existe para quien navega con teclado o tiene el observer
          bloqueado: el scroll infinito sólo deja gente afuera. */}
      <Button variant="ghost" size="sm" onClick={onVerMas}>
        Ver {Math.min(faltan, PAGINA)} más · quedan {faltan}
      </Button>
    </div>
  )
}

export function Vacio({
  icono, hayFiltros, vacio, filtrado,
}: { icono: LucideIcon; hayFiltros: boolean; vacio: string; filtrado: string }) {
  return (
    <EmptyState
      icon={icono}
      title={hayFiltros ? filtrado : vacio}
      description={hayFiltros ? 'Probá quitando algún filtro.' : undefined}
    />
  )
}

export { SkeletonRows }

/* ══════════════════════════════════════════════════════════════════════════
   5. FILA DE MOVIMIENTO — la lista de mobile
   ══════════════════════════════════════════════════════════════════════════
   Movimientos, no tarjetas. Dos renglones separados por una línea:

     FIDEICOMISO EL CLUB CARDALES          $ 5.033.890
     Recibo 19303 · 31/08                      E-cheq

   La fila entera es el blanco táctil y no hay botones adentro. El listado es
   para CONSULTAR; operar se hace desde el detalle, que es donde el usuario ya
   tiene delante lo que necesita para decidir. */
export function Movimiento({
  titulo, monto, meta, estado, onAbrir, ariaLabel,
}: {
  titulo: string
  monto: React.ReactNode
  meta: React.ReactNode
  estado: React.ReactNode
  onAbrir: () => void
  ariaLabel: string
}) {
  return (
    <button type="button" className="ta-mov" onClick={onAbrir} aria-label={ariaLabel}>
      <span className="ta-mov__l1">
        <span className="ta-mov__cliente">{titulo}</span>
        <span className="ta-mov__monto">{monto}</span>
      </span>
      <span className="ta-mov__l2">
        <span className="ta-mov__meta">{meta}</span>
        {estado}
      </span>
    </button>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   6. PANEL DE DETALLE
   ══════════════════════════════════════════════════════════════════════════
   Escritorio: panel al costado, con la lista visible al lado y la fila
   abierta resaltada, así que no se pierde el lugar. Mobile: hoja que se
   ajusta a lo que trae y deja ver la lista atrás.

   Abre con lo necesario para decidir y guarda el resto detrás de un bloque
   que se despliega. Pie: UNA acción primaria y ••• para lo excepcional. */
export function PanelDetalle({
  tipo, titulo, etiqueta, onCerrar, onAnterior, onSiguiente,
  children, primaria, secundarias, sinAcciones = 'Sin acciones pendientes',
}: {
  /** Renglón chico de arriba: el tipo de registro. */
  tipo: string
  /** Identificador grande: N° 4262, Recibo 19303… */
  titulo: string
  etiqueta: string
  onCerrar: () => void
  onAnterior?: () => void
  onSiguiente?: () => void
  children: React.ReactNode
  primaria?: { label: string; onClick: () => void } | null
  secundarias?: AccionMenu[]
  sinAcciones?: string
}) {
  const ref = useRef<HTMLElement>(null)

  // Escape cierra. El panel no es modal en escritorio, así que no atrapa el
  // foco: el usuario tiene que poder volver a la lista con Tab.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCerrar])

  useEffect(() => { ref.current?.scrollTo({ top: 0 }) }, [titulo])

  const hayPie = !!primaria || !!(secundarias && secundarias.length)

  return (
    <>
      <div className="ta-panel__scrim" onMouseDown={onCerrar} aria-hidden />
      <aside ref={ref} className="ta-panel" role="dialog" aria-label={etiqueta}>
        <header className="ta-panel__head">
          <div className="ta-panel__ident">
            <span className="ta-panel__tipo">{tipo}</span>
            <span className="ta-panel__n">{titulo}</span>
          </div>
          <div className="ta-panel__nav">
            {(onAnterior || onSiguiente) && (
              <span className="ta-panel__flechas ta-only-desktop">
                <IconButton icon={FlechaArriba} label="Anterior" size={15}
                  onClick={onAnterior} disabled={!onAnterior} />
                <IconButton icon={FlechaAbajo} label="Siguiente" size={15}
                  onClick={onSiguiente} disabled={!onSiguiente} />
              </span>
            )}
            <IconButton icon={X} label="Cerrar detalle" onClick={onCerrar} />
          </div>
        </header>

        <div className="ta-panel__body">{children}</div>

        {hayPie && (
          <footer className="ta-panel__foot">
            {secundarias && secundarias.length > 0 && <MenuAcciones acciones={secundarias} />}
            {primaria ? (
              <Button variant="primary" size="sm" onClick={primaria.onClick}>{primaria.label}</Button>
            ) : (
              <span className="ta-panel__cerrado">{sinAcciones}</span>
            )}
          </footer>
        )}
      </aside>
    </>
  )
}

/** La primera lectura del detalle: quién, cuánto, en qué estado. Nada más. */
export function PanelCabecera({
  titulo, monto, montoAlt, estado, fecha, situacion,
}: {
  titulo: string
  monto: React.ReactNode
  montoAlt?: React.ReactNode
  estado?: React.ReactNode
  fecha?: string
  situacion?: string
}) {
  return (
    <div className="ta-pcab">
      <span className="ta-pcab__cliente">{titulo}</span>
      <span className="ta-pcab__monto">{monto}</span>
      {montoAlt ? <span className="ta-pcab__alt">{montoAlt}</span> : null}
      {(estado || fecha) && (
        <span className="ta-pcab__estado">
          {estado}
          {fecha && <span className="ta-pcab__fecha">{fecha}</span>}
        </span>
      )}
      {situacion && <span className="ta-pcab__hint">{situacion}</span>}
    </div>
  )
}

/** Un par etiqueta / valor dentro del detalle. */
export function Dato({
  label, fuerte, children,
}: { label: string; fuerte?: boolean; children: React.ReactNode }) {
  return (
    <div className={`ta-datos__row${fuerte ? ' is-fuerte' : ''}`}>
      <span>{label}</span>
      <span className="ta-datos__v">{children}</span>
    </div>
  )
}

/** El segundo nivel del detalle, plegado. Casi nunca decide el siguiente paso. */
export function Mas({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <details className="ta-mas">
      <summary className="ta-mas__sum">{titulo}</summary>
      {children}
    </details>
  )
}
