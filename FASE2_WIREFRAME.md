# FASE 2 — Wireframe del nuevo Inicio

**Nada de esto está implementado.** Documento para aprobar antes de escribir código.
Datos medidos contra producción el 21/08/2026.

---

## ⚠ Bloqueante de git

La Fase 1 **no está mergeada en `main`**. Quedan 5 commits en `redesign/homebanking-ui`:

```
1098dd6  refactor(ui): complete multi-theme design tokens
ad6beab  feat(ui): centralize status mapping, UI permissions and money privacy
3b28677  feat(ui): add reusable UI primitives and compatibility facade
633d23e  feat(ui): redesign app shell with sidebar navigation
d665078  fix(ui): polish de Fase 1 tras el smoke test
```

`main` sigue en `85889b5` (Fase 0). Crear `redesign/home` desde ahí perdería toda
la foundation: tokens, primitivas, AppShell, `StatusBadge`, `permissions`, `Money`.

**Necesito que mergees la Fase 1 primero** (como hiciste con la Fase 0 vía PR #1).
Después creo `redesign/home` desde el `main` actualizado, tal como pediste.

---

## 1. Lo que los datos dicen

Antes del wireframe, cinco hechos que lo condicionan.

| Hallazgo | Consecuencia de diseño |
|---|---|
| **Sólo existe un año de datos: 2026** | Un filtro de año con una sola opción es ruido. Se propone **Mes + Unidad**, y el año aparece sólo cuando haya más de uno. |
| **`echeq_pendiente` = 0 y solicitudes de acceso = 0** | Hoy esos dos items **no se renderizan**. Valida que la sección sea dinámica y no una grilla fija de 4. |
| **18 pendientes con más de 60 días ($53.031.122)** y 5 más entre 31 y 60 | "46 pendientes" como bloque único es poco accionable. **La antigüedad es la señal real.** |
| **`created_at` tiene hora real** en los 263 comprobantes y en los recibos (concentrada 15–19 h) | Se puede mostrar tiempo relativo honesto ("hace 2 h") sin inventar precisión. |
| **4 de 200 recibos están en $0** | Señal de carga incompleta. Se propone como item de revisión, pero es el más discutible — decidí vos. |

Dos cosas que verifiqué y **no** existen, así que no se proponen: facturas cobradas
sin recibo vinculado (0) y facturas en USD sin tipo de cambio (0).

---

## 2. Wireframe — Desktop 1440

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Buen día, Nicolás                          [Ago 2026 ▾] [Todas las unid. ▾] │
│  Esto es lo que requiere tu atención.                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Para revisar                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ⏱  Pendientes hace más de 30 días        23 facturas   $60.778.254  › │  │
│  ├────────────────────────────────────────────────────────────────────────┤  │
│  │ ▤  Facturas pendientes de cobro          46 facturas  $252.600.582  › │  │
│  ├────────────────────────────────────────────────────────────────────────┤  │
│  │ ◷  Faltan retenciones                     2 pagos       $6.158.240  › │  │
│  │    Pago recibido · falta completar retenciones                         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│    (e-cheqs y solicitudes de acceso NO aparecen: hoy son 0)                  │
│                                                                              │
│  ¿Qué querés hacer?                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │ +  Nueva     │ │ $  Registrar │ │ ▦  Nuevo     │ │ ⌕  Buscar    │         │
│  │    factura   │ │    cobro     │ │    recibo    │ │    cliente   │         │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘         │
│                                                                              │
│  ┌──────────────────────┬──────────────────────┬──────────────────────┐      │
│  │ Facturado            │ Cobrado              │ Facturado en USD     │      │
│  │ $2.192.052.199       │ $1.933.293.377       │ U$S 866.992          │      │
│  │ 235 facturas · 2026  │ 80% de las facturas  │ 61 facturas          │      │
│  └──────────────────────┴──────────────────────┴──────────────────────┘      │
│                                                                              │
│  ┌─────────────────────────────────┬──────────────────────────────────────┐  │
│  │ Actividad reciente              │ Últimas facturas          Ver todas › │  │
│  │                                 │                                      │  │
│  │ ▤ Factura FC-A-4258 creada      │ FC-A-4258  MAGNASCO BROKERS          │  │
│  │   MAGNASCO BROKERS · $14.318.920│ 20 ago · $14.318.920  [Pendiente]    │  │
│  │   hace 4 h                      │                                      │  │
│  │                                 │ FC-A-4257  FIDEICOMISO HUDSON        │  │
│  │ ▦ Recibo 19294 registrado       │ 19 ago · $15.000.000  [Pendiente]    │  │
│  │   FINANZAS Y GESTIÓN · $54.994… │                                      │  │
│  │   hace 4 h                      │ FC-A-4256  FIDEICOMISO LAS HERAS     │  │
│  │                                 │ 19 ago · $3.592.974   [Pendiente]    │  │
│  │ ▤ Factura FC-A-4257 creada      │                                      │  │
│  │   FIDEICOMISO HUDSON · $15.000… │ FC-A-4255  INC S.A.                  │  │
│  │   ayer                          │ 18 ago · $508.200     [Pendiente]    │  │
│  │                                 │                                      │  │
│  │ … hasta 6                       │ … hasta 6                            │  │
│  └─────────────────────────────────┴──────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### A 1366×768

Entra sin scroll: saludo + "Para revisar" completo + acciones rápidas + la fila
de resumen. Actividad y facturas recientes quedan abajo del pliegue, que es el
orden correcto de prioridad.

### Mobile 390

Una columna, en este orden: saludo → filtros (colapsados en un botón) →
Para revisar → acciones (grilla 2×2) → resumen (3 apilados) → actividad →
facturas recientes.

---

## 3. Mapa de datos

Todo sale de `db.getDashboardStats()`, que ya existe. **No se agregan queries**
salvo dos lecturas chicas señaladas abajo.

### Saludo

| | |
|---|---|
| Fuente | `useAuth().user.nombre` |
| Cálculo | Primer nombre. Franja horaria: "Buen día" < 13 h, "Buenas tardes" < 20 h, "Buenas noches" |
| Fallback | Sin nombre → "Buen día" solo |
| Permisos | Todos |

### Para revisar — items, en orden de prioridad

**1. Pendientes hace más de 30 días**

| | |
|---|---|
| Fuente | `comprobantes` |
| Filtro | `tipo LIKE 'FACT%'` · `estado = 'pendiente'` · `hoy − fecha > 30 días` |
| Monto | `Σ netoARS()` de `lib/fiscal.ts` (Fase 0) |
| Hoy | **23 facturas · $60.778.254** |
| Click | `navigate({ to: 'facturas', estado: ['pendiente'] })` |
| Si es 0 | No se renderiza |

> El corte a 30 días es el único parámetro que invento. Es un umbral de gestión,
> no un dato. Si preferís 45 o 60, se cambia en una constante.

**2. Facturas pendientes de cobro**

| | |
|---|---|
| Filtro | `estado = 'pendiente'` (todas) |
| Hoy | **46 facturas · $252.600.582** |
| Click | `DESTINOS.facturasPendientes()` |

**3. Faltan retenciones**

| | |
|---|---|
| Filtro | `estado = 'faltan_retenciones'` |
| Copy | "N pagos recibidos esperan retenciones" + sublínea "Pago recibido · falta completar retenciones" |
| Hoy | **2 pagos · $6.158.240** (FC-A-4234 y FC-A-4241, FIDEICOMISO EL CLUB) |
| Click | `DESTINOS.facturasFaltanRetenciones()` |
| Tono | `info`, nunca el amber de pendiente. El dinero ya entró. |

**4. E-cheqs pendientes** — condicional

| | |
|---|---|
| Filtro | `estado = 'echeq_pendiente'` |
| Fecha de acreditación | `referencia_pago` (texto `YYYY-MM-DD`) |
| Hoy | **0 → no se renderiza** |
| Click | `DESTINOS.facturasEcheqPendiente()` |

**5. Solicitudes de acceso** — sólo admin, condicional

| | |
|---|---|
| Fuente | `usuarios` · `aprobado = false` · `count` |
| Query | `select('id', { count: 'exact', head: true })` — la misma que ya usa la sidebar |
| Hoy | **0 → no se renderiza** |
| Permiso | `puedeHacer('usuarios.gestionar')` |
| Click | `navigate({ to: 'usuarios' })` |

**6. Recibos sin importe** — *propuesta, decidí vos*

| | |
|---|---|
| Fuente | `recibos` · `monto_ars` y `monto_usd` nulos o 0 |
| Hoy | **4 de 200** (19194, 19124, 19142, 19156) |
| Click | `navigate({ to: 'recibos' })` |

Es el item más discutible: puede ser carga incompleta o puede ser
intencional (recibo de retención pura). **No lo implemento si no lo aprobás.**

### Empty state

Si los seis dan 0: `EmptyState` con "Todo al día · No hay pendientes que
requieran tu atención" e icono de check. Positivo, no un hueco.

### Acciones rápidas

| Acción | Permiso | Comportamiento |
|---|---|---|
| Nueva factura | `comprobante.crear` | Monta `NuevoComprobanteModal` existente, sin tocarlo |
| Registrar cobro | `comprobante.cobrar` | Ver nota abajo |
| Nuevo recibo | `recibo.crear` | `navigate({ to: 'recibos' })` |
| Buscar cliente | — (todos) | `navigate({ to: 'clientes' })` |
| Reservas | — (todos) | `navigate({ to: 'reservas' })` — sólo si sobra lugar |

Un **viewer** ve únicamente *Buscar cliente* y *Reservas*. No se construye un
Home distinto: la lista se filtra con `puedeHacer()`.

> **Registrar cobro.** El `MarcarCobradaModal` que ya existe necesita un
> `comprobante`. Propongo: `Drawer` (primitiva de Fase 1) con un buscador sobre
> las 46 pendientes; al elegir una, se monta el modal existente **sin cambiar una
> línea de su lógica**. Cero lógica de negocio nueva.
> Si preferís riesgo cero en esta fase, la alternativa es navegar a Facturación
> filtrada por pendiente y listo. **Decidilo vos.**

### Resumen financiero — 3 métricas, no 4

| Métrica | Cálculo | Hoy |
|---|---|---|
| Facturado | `Σ netoARS()` de facturas no anuladas del período | $2.192.052.199 |
| Cobrado | `Σ netoARS()` de `estado = 'cobrada'` · sublínea con el % | $1.933.293.377 · 80% |
| Facturado en USD | `Σ monto_usd` donde `monto_usd` no es nulo | U$S 866.992 |

**Cuestionando la duplicación que pediste que cuestione:** "Pendiente" ya aparece
en *Para revisar* con cantidad Y monto. Repetirlo como cuarta métrica es el mismo
número dos veces en la misma pantalla. **Lo saco.** Y "% Cobranza" no merece card
propia: es una sublínea de Cobrado.

Las tres cifras van envueltas en `<Money>`, igual que los montos de *Para
revisar*, actividad y facturas recientes.

### Actividad reciente

| | |
|---|---|
| Fuente A | `comprobantes.created_at` — 263 de 263 lo tienen |
| Fuente B | `recibos.created_at` + `nro_fact` — presente |
| Cálculo | Se mezclan ambas listas, se ordena por `created_at` desc, se toman 6 |
| Tiempo | `created_at` tiene hora real (8 horas distintas, 15–19 h). Bajo 24 h → "hace N h"; ayer → "ayer"; antes → "18 ago" |
| Permisos | Cualquier usuario aprobado. **No se usa `audit_log`**: es admin-only por RLS y mezclaría dos modelos de permiso en una lista |
| Click | La factura → Facturación; el recibo → Recibos |

Ejemplos reales de hoy: `FC-A-4258` creada hace 4 h, `Recibo 19294` registrado
hace 4 h ($54.994.500, FINANZAS Y GESTIÓN).

### Últimas facturas

| | |
|---|---|
| Filtro | `tipo LIKE 'FACT%'`, orden por `numero` desc, 6 filas |
| Columnas | comprobante · cliente · fecha · importe · `StatusBadge` |
| Fuera | Neto, IVA, TC, unidad, recibo, concepto — eso vive en Facturación |
| Click | Fila → Facturación · "Ver todas" → Facturación |

### Filtros

| Control | Fuente | Nota |
|---|---|---|
| Mes | Derivado de las fechas presentes | Default: mes en curso |
| Unidad | `PERSONAS` de `utils.ts` | 9 unidades con actividad en 2026 |
| Año | Derivado de los datos | **Se oculta si hay un solo año.** Hoy sólo 2026 → no aparece |

Etiquetado como **Unidad**, nunca "Persona". La columna de base no se toca.
Van arriba a la derecha, alineados con el saludo: presentes pero secundarios.

---

## 4. Qué sale del Home

| Elemento actual | Destino |
|---|---|
| Hero "Facturación y cobranza" + subtítulo "Vista consolidada…" | **Se elimina** |
| Cifra gigante de $2.192.052.199 con barra de progreso | **Se elimina** (el dato queda como métrica compacta) |
| Badges "235 facturas / 80% cobradas" del hero | **Se elimina** (el 80% pasa a sublínea de Cobrado) |
| Panel lateral "FILTROS" (un cuarto de pantalla) | **Se elimina** → toolbar compacta |
| KPI "IVA estimado" | → Reportes |
| KPI "Ticket promedio" | → Reportes |
| KPI "Mejor mes" | → Reportes |
| KPI "Facturado neto" (duplicado del hero) | **Se elimina** por duplicación |
| Gráfico de barras "Facturación neta mensual" | → Reportes |
| Gráfico de línea "Acumulado neto anual" | → Reportes |
| Donut "Estado de cobro" | → Reportes |
| Donut "Por tipo de factura" | → Reportes |
| Panel "Top clientes" con barras | → Reportes |
| Panel "Unidades de negocio" con barras | → Reportes |
| Panel "Lectura rápida" (4 señales) | **Se elimina** — es prosa generada, no acción |
| Panel "Consultoría · facturas cobradas" + tabla de 15 | → Reportes |
| Bloque de quincenas de Consultoría | → Reportes |
| Panel "Facturado por punto de venta" | → Reportes |

**Cero gráficos en el Home**, como pediste. No encontré ninguno que habilite una
decisión operativa que la lista de *Para revisar* no comunique mejor.

## 5. Qué se conserva

- `netoARS()` / `brutoARS()` de `lib/fiscal.ts` — la corrección fiscal de Fase 0
- `db.getDashboardStats()` — misma query, sin cambios
- Filtros de mes y unidad, con años dinámicos
- El acceso rápido a comprobantes recientes
- `StatusBadge`, `Money`, `puedeHacer()`, `navigate()` de las Fases 0 y 1

## 6. Qué se mueve conceptualmente a Reportes (Fase 6)

Evolución mensual · acumulado anual · composición por tipo · top clientes ·
unidades de negocio · punto de venta · IVA estimado · ticket promedio · mejor
mes · quincenas de Consultoría · el panel completo de Consultoría.

**No se copia nada ahora.** Sólo se deja de renderizar en el Home. Los helpers de
cálculo se conservan porque `Informe.tsx` los necesita.

## 7. Performance

El Home actual carga los 263 comprobantes y calcula 4 charts de Chart.js, 3
agrupaciones, quincenas y rankings. El nuevo usa la misma query pero **no importa
Chart.js** y calcula ~8 agregados simples. Menos JS y menos trabajo en el render.

## 8. Componentes nuevos

```
src/screens/Inicio.tsx          reemplaza el rol de Dashboard.tsx
src/components/home/
  Saludo.tsx
  HomeFilters.tsx
  AttentionList.tsx  +  AttentionItem.tsx
  QuickActions.tsx
  FinancialSummary.tsx
  RecentActivity.tsx
  RecentInvoices.tsx
src/lib/home.ts                 cálculo de los items de atención — puro y testeable
```

`Dashboard.tsx` no se borra en esta fase: `screens.tsx` deja de apuntarlo y queda
disponible para que la Fase 6 recicle sus cálculos en Reportes.

---

## Decisiones que necesito de vos

1. **Mergear la Fase 1 a `main`** — bloqueante para crear la branch como pediste.
2. **Umbral de antigüedad**: ¿30 días está bien para "Pendientes hace más de…"?
3. **"Recibos sin importe"**: ¿lo incluyo como item de revisión o lo dejo afuera?
4. **Registrar cobro**: ¿drawer con selector de factura reusando el modal actual, o navegación simple a Facturación filtrada?
