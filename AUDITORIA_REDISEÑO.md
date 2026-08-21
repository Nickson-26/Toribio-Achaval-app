# TA APP — AUDITORÍA FASE 0
### Rediseño profundo de producto, UX y UI
**Fecha:** 20 de agosto de 2026 · **Branch:** `main` · **HEAD:** `d3f5827`
**Estado:** working tree con 6 archivos modificados sin commitear (+660 / −79)

---

> **Resumen en una línea:** la app tiene mucha más superficie funcional de la que el brief asume (3 módulos, no 2), el sistema de diseño es recuperable, y hay **4 bloqueantes que deben resolverse antes de tocar una línea de UI** — ninguno de ellos es visual.

---

# A. ARQUITECTURA ACTUAL

## A.1 Stack real (verificado, no asumido)

| Capa | Realidad |
|---|---|
| Framework | **Next.js 14.2.29, App Router** |
| Lenguaje | TypeScript 5, `strict: true`, **`allowJs: false`** |
| React | 18 |
| Datos | `@supabase/supabase-js` ^2.49 |
| Charts | `chart.js` ^4.4.2 (import dinámico) |
| Excel | `exceljs` ^4.4.0 (solo server-side, import PROA) |
| Iconos | **`lucide-react` ^0.475.0 — ya instalado, cero uso en `src/`** |
| Estilos | **1 solo archivo:** `src/app/globals.css` (1418 líneas). Sin CSS Modules, sin Tailwind, sin librería UI |
| Deploy | Vercel + `vercel.json` con 2 crons |

**Hallazgo:** `lucide-react` está en `package.json` y **no se importa en ningún archivo**. La iconografía actual son emojis (`👁`, `🌙`, `☀️`, `♿`, `🔑`, `☰`, `📊`, `🏠`, `📋`) y símbolos Unicode (`◈`, `↓`, `···`). El brief pide Lucide: **la dependencia ya está paga.**

## A.2 Routing: NO EXISTE

Esto es lo más importante de entender antes de planificar.

```
src/app/
├── layout.tsx          → AuthProvider + HideNumbersProvider
├── page.tsx            → ÚNICA ruta. 252 líneas. Es el router, el shell y el nav.
└── api/                → 8 route handlers (reservas, cron, extract-invoice)
```

`page.tsx` mantiene `useState<Page>` y `useState<Modulo>` y resuelve el componente con un `Record<Page, ComponentType>`. **No hay URLs, ni deep links, ni historial, ni back del navegador.**

**Consecuencia directa para el brief:** las funciones pedidas en §43 ("cada item de *Para revisar* debe abrir el listado filtrado"), §73 (búsqueda global) y §74 (command palette con "Ir a X") **requieren o bien migrar a App Router real, o bien un bus de navegación con estado compartido**. El brief (§93) pide no migrar routing en la primera fase — ver §H para la propuesta.

## A.3 Los 3 módulos (el brief documenta 2)

`page.tsx:133-148` renderiza un switcher de **tres** módulos:

| Módulo | Componente | Estado | En el brief |
|---|---|---|---|
| Facturación | `Dashboard` + 7 páginas | Producción | Sí |
| Reservas | `Reservas.tsx` | Producción | Sí (§22, "módulo crítico") |
| **Avisos de Ingreso** | `AvisoIngreso.jsx` | **Prototipo roto, visible a usuarios reales** | **No mencionado** |

## A.4 Inventario de archivos

```
src/
├── app/
│   ├── layout.tsx                    23    Providers
│   ├── page.tsx                     252    Shell + nav + router + theme + user menu
│   ├── globals.css                 1418    TODO el sistema visual
│   └── api/
│       ├── extract-invoice/         110    Claude API → JSON de factura
│       ├── reservas/import          161    JSON 1 reserva (HUÉRFANO, nadie lo llama)
│       ├── reservas/import-excel    160    Excel PROA → TRUNCA Y REINSERTA
│       ├── reservas/sync-gmail      130    Scraping de mails
│       ├── reservas/sync-proa       276    Scraping web autenticado de PROA
│       ├── reservas/export-sheets   487    Google Sheets (4 pestañas + formato)
│       ├── cron/reservas             49    Diario 13:00 UTC
│       └── cron/export-sheets        29    Lunes 12:00 UTC
├── components/
│   ├── AuthProvider.tsx              56    Sesión + isAdmin/isEditor
│   ├── HideNumbers.tsx               22    Privacidad de cifras (SIN persistencia)
│   ├── LoginPage.tsx                178    Login + signup + validación de dominio
│   ├── CambiarPassword.tsx           73    Cambio de contraseña
│   ├── ui.tsx                        72    Modal, FG, Badges, Toast, Spinner
│   ├── ComprobanteForms.tsx         835    5 modales — NÚCLEO FISCAL
│   └── aviso/                     15 arch  Wizard de 7 pasos (Tailwind sin Tailwind)
├── lib/
│   ├── supabase.ts                  305    Cliente + types + capa `db`
│   ├── auth.ts                       83    Auth helpers + roles
│   └── utils.ts                      88    Constantes + formatters + buildComprobanteId
├── pages/
│   ├── Dashboard.tsx                643    4 charts + KPIs + Consultoría + quincenas
│   ├── Facturas.tsx                 715    Tabla + filtros + export XLS + detalle
│   ├── OtherPages.tsx               769    Recibos + Clientes + NC + ND + Resumen
│   ├── Reservas.tsx                 612    Dashboard + listado + import/export
│   ├── Informe.tsx                  408    PDF CFO (window.print)
│   ├── Usuarios.tsx                 222    ABM usuarios + invitación
│   ├── NotasCredito.tsx             324    ⚠ CÓDIGO MUERTO (no importado)
│   ├── AvisoIngreso.jsx             ~200   Prototipo
│   ├── FacturasIngreso.jsx          374    ⚠ MUERTO
│   ├── ReservasIngreso.jsx          370    ⚠ MUERTO
│   └── {Recibos,Clientes,NotasDebito,Resumen}.tsx   1 línea c/u — re-exports NO usados
├── App.jsx                          ~60    ⚠ MUERTO — 8 de 13 imports no existen
└── scripts/parse-reserva-email.ts   123    Parser de mails
```

**Código muerto confirmado: ~1.400 líneas** (`NotasCredito.tsx` 324 + `FacturasIngreso` 374 + `ReservasIngreso` 370 + `App.jsx` 60 + `AppHeader`/`MainNav` + 4 re-exports + `Resumen` no ruteado 88).

Además hay un directorio en la raíz llamado literalmente **`{src`** (nombre corrupto, del 28 de abril).

## A.5 Sistema visual actual

- **Nav superior** (`topnav`), no sidebar. El brief pide sidebar → cambio estructural.
- **3 themes**: `dark` (default, `:root` sin atributo), `light` (`[data-theme="light"]`), `accessible` (`[data-theme="accessible"]`). Persistencia en `localStorage['ta-theme']`.
- **37 design tokens**. Nomenclatura semántica correcta (`--bg-{base,primary,secondary,tertiary,card,hover,elevated}`, `--text-{primary,secondary,tertiary}`, `--border{,-strong,-accent}`).
- **176 clases CSS**, agrupadas por familia con headers de sección.
- **385 bloques `style={{}}`** en 24 archivos.

---

# B. MAPA FUNCIONAL COMPLETO

Clasificación: 🟢 funcional · 🟡 parcial · 🔴 placeholder · ⚪ planificada · ⚫ muerta

## B.1 Autenticación y acceso

| Feature | Estado | Detalle |
|---|---|---|
| Login email + password | 🟢 | `LoginPage.tsx:18-62` |
| Validación dominio `@toribioachaval.com` | 🟡 | **Solo cliente** (`endsWith`), duplicada en 3 lugares, sin CHECK en DB |
| Signup con verificación de email | 🟢 | `LoginPage.tsx:65-94` |
| Gate por `aprobado` | 🟢 | `page.tsx:94-103` |
| Logout | 🟢 | |
| Cambio de contraseña | 🟡 | **Sin re-autenticación** — `current` declarado en `:7` y nunca renderizado |
| Recuperar contraseña | ⚪ | No existe `resetPasswordForEmail` en ningún lado |
| Roles admin/editor/viewer | 🟡 | Definidos y en RLS, pero **la UI casi no los usa** |

## B.2 Gestión de usuarios

| Feature | Estado | Detalle |
|---|---|---|
| Listar usuarios | 🟢 | Split pendientes / aprobados |
| Aprobar | 🟢 | Sin confirmación |
| Rechazar | 🟡 | **Es un DELETE físico**, no un flag |
| Cambiar rol / suspender | 🟢 | `EditUserModal` |
| Eliminar | 🟡 | Edge Function `swift-service` — **no está en el repo**, no auditable |
| Invitar usuario | 🔴 | **`signUp` desde el cliente puede secuestrar la sesión del admin** |
| Badge de pendientes en nav | 🟢 | `page.tsx:245-252` |
| Audit log | 🟡 | Trigger llena la tabla (377 filas) — **ningún componente la lee** |

## B.3 Facturación

| Feature | Estado | Detalle |
|---|---|---|
| Listado por tabs (A / B / FCE / E) | 🟢 | Con contadores |
| Búsqueda con debounce 300ms | 🟢 | |
| Filtros año / unidad / PV / moneda | 🟢 | 3 listas de años divergentes |
| **Filtro estado multi-select (chips)** | 🟡 | **Sin commitear.** Bug: deps de `useMemo` incompletas (`Facturas.tsx:417`) |
| Crear comprobante | 🟢 | Todos los tipos, cálculo automático |
| Editar | 🟡 | **El select de estado no incluye los 2 estados nuevos** → degrada al editar |
| Anular (soft delete) | 🟢 | `estado='anulada'` + `cliente='ANULADO'` |
| Eliminar (hard delete) | 🟢 | Sin gate de rol en UI |
| Marcar cobrada + crear recibo | 🟡 | **Regresión sin commitear** — traga error `23505` |
| **Faltan retenciones** | 🟡 | **Sin commitear + sin migración SQL** |
| **E-cheq pendiente** | 🟡 | Ídem. Setea `fecha_cobro` sin haber cobrado |
| **Gestionar retenciones** | 🟡 | Ídem. Puede degradar `cobrada` → `pendiente` |
| Tabla de retenciones en modal de cobro | 🔴 | **Se renderiza, se completa, y NO SE GUARDA** |
| Adjuntar / ver PDF (Storage) | 🟢 | URLs firmadas 1h. Sin desadjuntar, sin borrado en cascada |
| **Importar datos desde PDF con IA** | 🟢 | **Funcional.** Claude API, human-in-the-loop. Sin auth ni rate limit en la ruta |
| Export CSV | 🟢 | |
| Export XLS de pendientes | 🟢 | SpreadsheetML, 4 hojas |
| Detalle de factura | 🟢 | Modal read-only + acciones |

## B.4 Recibos

| Feature | Estado | Detalle |
|---|---|---|
| Listar + buscar | 🟢 | Solo search de texto, **sin filtros** de fecha/persona/moneda |
| Crear con multi-factura | 🟡 | **`recibo_comprobantes` existe pero tiene 0 filas en producción** |
| Editar | 🟡 | **No toca `recibo_comprobantes`** → desincroniza |
| Eliminar | 🔴 | **Deja comprobantes huérfanos en `cobrada`** apuntando a un recibo inexistente |
| CSV | 🟢 | |
| Campo `retencion` | ⚫ | Existe en DB con 116 filas históricas, **la UI siempre escribe `null`** |
| Multi-select de facturas | 🟡 | Solo ofrece `estado='pendiente'` → **no se pueden asociar `faltan_retenciones` ni `echeq_pendiente`** |

## B.5 Clientes

| Feature | Estado | Detalle |
|---|---|---|
| Listado agregado | 🟡 | **Derivado en memoria de `comprobantes`. No hay tabla `clientes`** (el brief lo anticipó bien, §65) |
| Métricas por cliente | 🔴 | **Suma NC y ND en positivo**, no excluye anuladas, ignora USD (usa `monto_ars` crudo) |
| Detalle / drill-down | ⚪ | No existe |

## B.6 Notas de Crédito / Débito

| Feature | Estado | Detalle |
|---|---|---|
| NC — listar / crear / editar / eliminar | 🟢 | En `OtherPages.tsx` (la versión viva) |
| NC — vincular y anular factura | 🟢 | Al eliminar restaura a `'emitida'`, **no al estado previo** |
| NC — cálculo fiscal | 🔴 | **Aplica IVA 21% a NC B y NC FCE también** |
| NC — numeración | 🔴 | **Ignora el punto de venta** → colisión entre PV. Dos semillas (401 vs 4001) |
| **ND — crear** | ⚪ | **No se puede crear una ND desde la app** |
| ND — editar | 🔴 | Stub: *"Edición disponible desde Supabase"* |
| ND — listar / eliminar | 🟢 | Delete sin chequeo de error |

## B.7 Reservas

| Feature | Estado | Detalle |
|---|---|---|
| Dashboard con período | 🟢 | semana/mes/trimestre/año/todo |
| 4 tabs (Dashboard/Empr./Resid./Comercial) | 🟢 | Residencial es **catch-all** |
| Filtros (año, mes, unidad, operación, estado) | 🟡 | Año hardcodeado `2026`, lista estática `[2026, 2025]` |
| Tabla 10 columnas | 🟢 | Sin paginación |
| Crear / editar reserva | 🟡 | **El modal no expone ningún campo PROA** |
| Eliminar | 🟢 | Sin chequeo de error |
| Import Excel PROA | 🔴 | **Endpoint público sin auth que hace `DELETE` de toda la tabla** |
| Export a Google Sheets | 🔴 | **POST sin auth** → fuga de toda la base |
| Sync PROA (scraping) | 🟡 | Parser posicional frágil |
| Sync Gmail | 🟡 | Lee `snippet` truncado → pierde campos del final |
| Crons | 🟢 | Diario + semanal |
| `precio_publicado` / `precio_reserva` | 🔴 | **Siempre formateados con `usd()`** sin mirar la moneda real |

## B.8 Reportes

| Feature | Estado | Detalle |
|---|---|---|
| Dashboard ejecutivo | 🟢 | 4 charts + KPIs + top clientes + unidades + PV |
| **Quincenas Consultoría** | 🟡 | **Sin commitear** |
| Informe PDF CFO | 🟡 | **`window.print()`**, no librería. Ver riesgos |
| Página `Resumen` | ⚫ | Existe, no está ruteada |

## B.9 Sistema

| Feature | Estado | Detalle |
|---|---|---|
| 3 themes | 🟡 | Light: 21/37 tokens sin redefinir. Accessible: reskin, no accesibilidad real |
| Ocultar cifras (👁) | 🟡 | **Solo cubre Dashboard y Reservas.** Facturas, Recibos, NC, ND, Clientes, Informe y todos los exports quedan expuestos |
| Toast | 🟢 | |
| Modal / FG | 🟢 | `ui.tsx` |
| Responsive | 🟡 | 8 breakpoints desordenados, 21 `!important`, bug real de cascada |
| Búsqueda global | ⚪ | No existe |
| Command palette | ⚪ | No existe |
| Notificaciones | ⚪ | No existe |

## B.10 Avisos de Ingreso

| Feature | Estado | Detalle |
|---|---|---|
| Wizard de 7 pasos | 🔴 | UX completa y bien hecha |
| Persistencia | 🔴 | **CERO llamadas a Supabase / fetch / API en los 18 archivos** |
| Número de aviso | 🔴 | **`Math.random()`** — `AI-2026-XXX-nnn` |
| Brokers | 🔴 | 20 nombres ficticios |
| Base PROA | 🔴 | 5 propiedades de demo en un objeto literal |
| Envío al director | 🔴 | Lo promete en pantalla, no existe |
| Estilos | 🔴 | **124 clases Tailwind únicas. Tailwind NO está instalado** |
| Badge | | Dice literalmente `PROTOTIPO` (`AppHeader.jsx:17`) — pero `AppHeader` está huérfano, **el usuario no lo ve** |

**Valor real a preservar:** las reglas de negocio codificadas ahí (splits de comisión por rol, excepciones de Dpto. de Búsqueda / Emprendimientos / Consultoría, taxonomía de canales pagos vs no pagos) **no están en ningún otro lado del código**.

---

# C. DATABASE TOUCHPOINTS

## C.1 Tablas

| Tabla | Filas (10/06/26) | Módulos que la usan |
|---|---|---|
| `comprobantes` | 131 | Facturas, NC, ND, Clientes, Dashboard, Informe, Resumen, Recibos |
| `recibos` | ~19.200 IDs | Recibos, Facturas (cobro) |
| `recibo_comprobantes` | **0** | Recibos (multi-factura) |
| `reservas` | 177 | Reservas + 5 API routes |
| `usuarios` | 4 (**todos admin**) | Auth, Usuarios |
| `audit_log` | 377 | **Nadie la lee** |
| **`retenciones`** | **⚠ NO EXISTE EN NINGÚN `.sql`** | ComprobanteForms, `db.getRetenciones/upsertRetenciones/recalcEstado` |

## C.2 Storage

Un bucket: **`comprobantes-pdfs`** (privado, 10 MB, solo `application/pdf`).
3 políticas: upload, view, update. **Sin DELETE** → los PDFs no se pueden borrar nunca. Path plano `{comprobante_id}.pdf`.

## C.3 Los 3 gaps de schema (BLOQUEANTES)

**1. Tabla `retenciones` — no existe en el repo.**
Búsqueda exhaustiva en los 17 `.sql` + todo el historial de git: **cero coincidencias**. `backup_data.sql` enumera las tablas de producción y `retenciones` no figura. El DDL se ejecutó a mano en el SQL Editor y se perdió.

**2. Las 6 columnas de payment tracking — no existen en el repo.**
`pago_recibido`, `fecha_pago`, `medio_pago`, `importe_pagado`, `referencia_pago`, `observaciones_pago`. La column list de los INSERT de `backup_data.sql` tiene 21 columnas y ninguna de estas. `grep -c pago_recibido backup_data.sql` = **0**.

**3. El CHECK constraint rechaza los 2 estados nuevos.**
```sql
-- supabase_schema.sql:23-24
estado TEXT NOT NULL DEFAULT 'pendiente'
       CHECK (estado IN ('pendiente','cobrada','anulada','emitida'))
```
El type TS declara 6 estados. `faltan_retenciones` y `echeq_pendiente` **violan la constraint versionada**.

> **Nota:** vos ya corriste un `ALTER TABLE` a mano en producción para esto. El problema no es producción — es que **el DDL no está en el repo**, así que ningún entorno nuevo (staging, preview, restore) puede levantar la app.

## C.4 RLS: cuatro generaciones contradictorias

| Gen | Archivo | Qué hace |
|---|---|---|
| 1 | `supabase_auth.sql` | Políticas con recursión infinita (`42P17`) |
| 2 | `supabase_trigger.sql` | **`DISABLE ROW LEVEL SECURITY`** + `GRANT INSERT TO anon` |
| 3 | `supabase_enterprise.sql` | El modelo correcto por rol: `editor_insert`, `editor_update`, `admin_delete` |
| 4 | `backup_schema.sql` | **`FOR ALL USING(true)`** en todas las tablas |

**Las políticas PERMISSIVE se combinan con OR.** Si Gen 3 y Gen 4 coexisten (tienen nombres distintos, no se pisan), la Gen 4 **anula por completo** el modelo de roles.

**No hay forma de saber desde el repo cuál está activa.** Y como los 4 usuarios de producción son `admin`, el bug estaría latente sin detectar.

Además: las 5 API routes de reservas usan `SUPABASE_SERVICE_ROLE_KEY` → **bypassean RLS por completo**.

## C.5 Riesgo de migraciones: ALTO (ya materializado)

No hay `supabase/migrations/`, ni CLI, ni tabla de versiones. Son 17 scripts sueltos en la raíz ordenados solo por `mtime`.

- `supabase_fix_proa_index.sql` y `supabase_fix_proa_constraint.sql` **se contradicen**.
- El restore documentado en `backup_schema.sql` **no corre**: falla en `idx_audit_*` (sin `IF NOT EXISTS`) y en las políticas de storage (`CREATE POLICY` no es idempotente).
- Restaurar desde `backup_schema.sql` produce una base **materialmente distinta**: sin RLS por rol, sin trigger de auditoría, sin FKs, sin CHECKs, y con `recibos.id` como `SERIAL` en vez de `INTEGER` → colisión de PK inmediata.
- `supabase_truncate_reservas.sql` es un `TRUNCATE` desnudo en la raíz del repo, sin transacción.

---

# D. CHECKLIST DE REGRESIÓN

Todo lo que sigue debe verificarse manualmente después de **cada** fase.

## D.1 Fórmulas fiscales — INTOCABLES

Estas líneas están **commiteadas y probadas en producción**. No se tocan sin tests.

```
ComprobanteForms.tsx:8        IVA_RATE = 0.21
ComprobanteForms.tsx:43       isB = tipo === 'FACT B'   ← ÚNICO discriminador
ComprobanteForms.tsx:46-54    ARS:  iva = round2(neto × 0.21) ; total = round2(neto + iva)
ComprobanteForms.tsx:56-64    USD:  iva = round4(neto × 0.21) ; total = round4(neto + iva)
ComprobanteForms.tsx:137-149  Persistencia + conversión USD→ARS por TC
ComprobanteForms.tsx:157      estado inicial: FACT* → 'pendiente' ; resto → 'emitida'
utils.ts:66-76                buildComprobanteId (PV 0002 histórico vs 0004)
ComprobanteForms.tsx:126-136  Numeración: max(numero) por (tipo, punto_venta) + 1
OtherPages.tsx:527            NC: iva = round2(n × 0.21) ; total = round2(n × 1.21)
Dashboard.tsx:50-64           toNeto / toBruto
```

⚠ **Nota:** la fórmula de facturas (`neto + round2(iva)`) y la de NC (`round2(neto × 1.21)`) **pueden diferir en 1 centavo**. Es así hoy. No lo "arregles" sin consultar con contaduría.

## D.2 Flujo de estados — 14 transiciones

| # | Transición | Disparador | Código |
|---|---|---|---|
| T1 | ∅ → `pendiente` | Guardar `FACT *` | `ComprobanteForms.tsx:157` |
| T2 | ∅ → `emitida` | Guardar NC/ND | `ComprobanteForms.tsx:157` |
| T3 | `pendiente` → `cobrada` | Marcar cobrada | `ComprobanteForms.tsx:495-502` |
| T4 | `pendiente` → `echeq_pendiente` | e-cheq + fecha acreditación | `ComprobanteForms.tsx:455-466` |
| T5 | `pendiente` → `faltan_retenciones` | checkbox "sin retenciones" | `ComprobanteForms.tsx:468-479` |
| T6 | `echeq_pendiente` → `cobrada` | Confirmar acreditación | `ComprobanteForms.tsx:663-669` |
| T7 | `faltan_retenciones` → `cobrada` | Cobrar de nuevo | `ComprobanteForms.tsx:495-502` |
| T8 | `cobrada` ⇄ `faltan_retenciones` | Modal Retenciones | `ComprobanteForms.tsx:741-758` |
| T9 | * → `anulada` | Anular (soft delete) | `supabase.ts:141-147` |
| T10 | * → `anulada` | Crear NC vinculada | `OtherPages.tsx:547` |
| T11 | `anulada` → `emitida` | Eliminar NC | `OtherPages.tsx:446` |
| T12 | * → * | Editar → select Estado | `ComprobanteForms.tsx:343-347` |
| T13 | `pendiente` → `cobrada` | Crear recibo | `supabase.ts:165-185`, `:222-236` |
| T14 | fila → ∅ | Eliminar definitivamente | `Facturas.tsx:394-402` |

## D.3 Checklist funcional

**Auth** — login OK · dominio inválido rechazado · signup + verificación · usuario no aprobado ve pantalla de espera · logout · cambio de contraseña · roles admin/editor/viewer resuelven bien

**Usuarios** — listar · aprobar · rechazar · cambiar rol · suspender · eliminar · invitar · badge de pendientes

**Themes** — los 3 modos · persistencia en localStorage · sin FOUC · legibilidad en los 3

**Privacidad** — 👁 oculta en Dashboard · en Reservas · toggle bidireccional

**Facturación** — tabs con contadores · búsqueda · los 5 filtros · crear A/B/FCE/E · **IVA correcto en cada tipo** · USD con TC · editar · anular · eliminar · cobrar · e-cheq · retenciones · adjuntar PDF · ver PDF · importar PDF con IA · CSV · XLS pendientes · numeración correlativa por PV

**Recibos** — listar · buscar · crear (1 factura) · crear (N facturas) · editar · eliminar · CSV · el estado de la factura cambia a `cobrada`

**Clientes** — listado agregado · búsqueda

**NC/ND** — crear NC · vincular a factura · la factura queda `anulada` · eliminar NC restaura · listar ND · filtro PV

**Reservas** — 4 tabs · contadores · período · filtros · tabla · crear · editar · eliminar · import Excel · export Sheets · los 2 crons

**Reportes** — 4 charts · KPIs · top clientes · unidades · PV · Consultoría · quincenas · **Informe PDF genera y se imprime**

---

# E. RIESGOS

## E.1 🔴 BLOQUEANTES — resolver antes de tocar UI

### R1 · Migración SQL de retenciones perdida
La tabla `retenciones`, las 6 columnas de payment tracking y el CHECK ampliado **no están en el repo**. La feature funciona en producción por un `ALTER TABLE` manual sin respaldo. Cualquier entorno nuevo revienta.
**Acción:** escribir y commitear `supabase_retenciones.sql` antes de nada.

### R2 · Working tree con 660 líneas sin commitear
6 archivos modificados que incluyen la feature de retenciones, e-cheq, multi-select y quincenas. Trabajar encima sin commitear = perder trazabilidad y no poder hacer rollback.
**Acción:** commitear a `main` (previa corrección de R3 y R4) antes de abrir la branch de rediseño.

### R3 · Regresión sin commitear: recibos cruzados
```js
// ComprobanteForms.tsx:489-491 y :658-660
if (reciboError && reciboError.code !== '23505') { throw ... }
// ← el 23505 (unique_violation) se traga y la ejecución CONTINÚA
```
Si dos usuarios cobran a la vez, la factura queda vinculada a **un recibo de otro cliente**, y el toast dice `✓ Recibo NNNN registrado`. La versión en `main` sí avisaba. **Es dinero mal atribuido.**

### R4 · Endpoints públicos destructivos
```
POST /api/reservas/import-excel   → sin auth + delete().neq('id',0) con service-role
POST /api/reservas/export-sheets  → sin auth, exporta toda la base a Drive
POST /api/extract-invoice         → sin auth, quema cuota de Anthropic
```
Cualquiera en internet que conozca la URL vacía la tabla `reservas`.

## E.2 🟠 ALTOS

| # | Riesgo | Evidencia |
|---|---|---|
| R5 | **Estado real de RLS desconocido.** 4 generaciones contradictorias; Gen 4 (`USING(true)`) anularía el modelo de roles | §C.4 |
| R6 | **Dashboard resta 21% a las FACT B**, que no llevan IVA → neto, IVA estimado, YoY, rankings y quincenas corruptos | `Dashboard.tsx:57` |
| R7 | **NC B y NC FCE reciben IVA 21%** en la página viva | `OtherPages.tsx:525-529` |
| R8 | **Numeración de NC ignora el punto de venta** → colisión de IDs entre PV 0002 y 0004 | `OtherPages.tsx:542-544` |
| R9 | **La tabla de retenciones del modal de cobro no persiste nada.** El texto promete que la factura quedará en `faltan_retenciones`; queda `cobrada` | `ComprobanteForms.tsx:582-623` vs `:448-510` |
| R10 | **Factura en USD sin TC se guarda con ARS en null**, sin validación ni warning en el alta | `ComprobanteForms.tsx:140-149` |
| R11 | **Editar degrada estados nuevos** — el select tiene 4 opciones, no 6 | `ComprobanteForms.tsx:345` |
| R12 | **`calcEstadoComprobante` puede degradar `cobrada` → `pendiente`** en facturas viejas sin `pago_recibido` | `supabase.ts:92` |
| R13 | **Borrar un recibo deja comprobantes huérfanos** en `cobrada` (no hay FK ni reversión) | `OtherPages.tsx:26-32` |
| R14 | **Invitar usuario puede secuestrar la sesión del admin** (`signUp` desde el cliente) | `Usuarios.tsx:166` |
| R15 | **RLS `self_insert` no valida `role`** → escalada a admin con la anon key | `supabase_enterprise.sql:49` |
| R16 | **Avisos de Ingreso es un prototipo visible en producción** que genera números de referencia con `Math.random()` y promete envíos que no ocurren | `AvisoIngreso.jsx:95` |
| R17 | **Tailwind usado en 13 archivos y no instalado** → 124 clases muertas, layouts rotos, footer tapa el último campo | §B.10 |

## E.3 🟡 MEDIOS

| # | Riesgo |
|---|---|
| R18 | **Light mode roto**: 21/37 tokens sin redefinir. `--success`, `--warn`, `--danger`, `--info`, `--accent-text` heredan valores de dark → todos fallan WCAG AA sobre blanco. `--text-tertiary` (el token más usado) da 2.85:1 |
| R19 | **Gradiente verde oscuro al 92% hardcodeado** en `.dash-hero-main` y `.dash-control-panel` → en light mode el hero del dashboard se pinta verde oscuro sobre UI clara |
| R20 | **Alto contraste es un reskin, no accesibilidad.** Cero `:focus-visible` en 1418 líneas. 5 reglas hacen `outline:none`; una (`:505`) sin reemplazo. `.nav-pill`, `.auth-logo` y `.auth-tab.active` quedan a **1.40:1** (blanco sobre amarillo) |
| R21 | **Inter y JetBrains Mono declaradas y nunca cargadas.** Sin `@font-face`, sin `next/font`. Los `font-weight: 750/760` son inertes |
| R22 | **Bug real de cascada responsive**: `.metrics-grid` se redefine 7 veces; a 700px gana el bloque de 1200px (3 columnas) sobre el de 768px (2 columnas) por orden de archivo |
| R23 | **`useHideNumbers` no cubre** Facturas, ComprobanteForms, Recibos, Clientes, NC, ND, Informe ni los exports. Los tooltips y ejes de Chart.js se escapan del blur (canvas) |
| R24 | **El PDF CFO no imprime fondos.** Falta `print-color-adjust: exact` → portada blanca sobre blanca, barras invisibles |
| R25 | **XSS almacenado en el PDF CFO**: `cliente` y `persona` interpolados crudos + `document.write` |
| R26 | **`win.onload` asignado después de `document.close()`** → el `print()` puede no dispararse nunca |
| R27 | **3 listas de años divergentes** hardcodeadas (`Dashboard` 2026/2025/2024, `Facturas` filtro 2026/2025/2024, `Facturas` export 2026/2025/2027) |
| R28 | **~1.400 líneas de código muerto**, incluida una versión completa de NotasCredito que diverge fiscalmente de la viva |
| R29 | **Inyección en filtros PostgREST**: `.or()` interpola input del usuario sin escapar |
| R30 | **Sin paginación en ningún listado.** `select('*')` completo; PostgREST trunca en 1000 filas → Clientes y Resumen truncan silenciosamente |
| R31 | **12 acciones destructivas sin gate de rol en la UI** → un `viewer` ve todos los botones y recibe errores crípticos de Postgres |

---

# F. PROPUESTA VISUAL

## F.1 Diagnóstico del sistema actual

**Veredicto: la base es recuperable. Reescribir sería destruir valor.**

Lo que ya está bien y hay que conservar:
1. La **arquitectura de theming es la correcta** — custom properties en `:root` + override por `[data-theme]`, sin duplicar reglas de componente. Es exactamente el patrón que usarías desde cero.
2. La **nomenclatura semántica es sólida** y escala a más themes.
3. La **adopción es genuina**: `--border` 105 usos, `--text-primary` 62, `--radius` 72. Los tokens están realmente cableados; el 80% de los componentes ya cambia de theme solos.
4. Solo 10 clases muertas sobre 176. El archivo no está podrido, está **incompleto**.

Lo que falta es **completitud, no diseño**: 21 tokens sin override, 3 fugas fuera del sistema (fuentes, Tailwind, gradiente hardcodeado), y una sección responsive desordenada.

## F.2 Los 3 frentes de trabajo del design system

**Frente A — cerrar la cobertura de tokens.** Redefinir en light y accessible los 21 tokens faltantes; subir `--text-tertiary` en light; añadir tokens que hoy son literales: `--focus-ring`, `--overlay-bg`, `--on-accent`, `--badge-{purple,teal,orange}`, `--hero-gradient`. Añadir tokens de **espaciado**, **tipografía** y **z-index** (hoy no existen). Esto solo elimina ~20 bugs de theme.

**Frente B — eliminar las 3 fugas.** Cargar Inter con `next/font`. Decidir el módulo `aviso` (convertir, no instalar Tailwind — chocaría con 176 clases semánticas). Reemplazar el gradiente verde por token.

**Frente C — foco y breakpoints.** `:focus-visible` global tokenizado, quitar el `outline:none` sin reemplazo, `prefers-reduced-motion`. Consolidar 8 breakpoints en 3-4, ordenados de mayor a menor → elimina los 21 `!important` y arregla el bug de `.metrics-grid`.

## F.3 Nuevo AppShell — de topnav a sidebar

**Hoy:** `page.tsx` es shell + nav + router + theme + user menu + module switcher en 252 líneas con 23 bloques de inline style y 3 accents de módulo hardcodeados (`#C8102E`, `#1a6bc8`, `#CC1C28`).

**Propuesta:**

```
┌─────────────┬──────────────────────────────────────────────┐
│  ▣ TA       │  ⌕ Buscar…              👁  ☾  [+ Nueva ▾] ⬤ │  Topbar (glass)
│  Toribio    ├──────────────────────────────────────────────┤
│  Achaval    │                                              │
│  Gestión    │   Buen día, Nicolás 👋                        │
│             │   Esto es lo que requiere tu atención hoy.   │
│  PRINCIPAL  │                                              │
│  ⌂ Inicio   │   ┌─ Para revisar ─────────────────────────┐ │
│  ▤ Facturas │   │ ⚠ 7 facturas pendientes    $18.450.000 →│ │
│  ▦ Recibos  │   │ ⏱ 2 esperando retenciones           →│ │
│  ⚇ Clientes │   │ ▤ 1 e-cheq acredita el 25/08        →│ │
│  ⌂ Reservas │   └────────────────────────────────────────┘ │
│             │                                              │
│  DOCUMENTOS │   ¿Qué querés hacer?                         │
│  ⊖ N. Créd. │   [+ Factura] [$ Cobrar] [▦ Recibo] [⌕ Cli.] │
│  ⊕ N. Déb.  │                                              │
│             │   Resumen · Actividad reciente · Facturas    │
│  ANÁLISIS   │                                              │
│  ◫ Reportes │                                              │
│             │                                              │
│  ADMIN      │                                              │
│  ⚙ Usuarios │                                              │
├─────────────┤                                              │
│ NS  Nicolás │                                              │
│     Admin   │                                              │
└─────────────┴──────────────────────────────────────────────┘
```

Decisiones concretas:

- **Sidebar clara y ligeramente flotante** en light (`rgba(255,255,255,.86)` + `blur(18px)`, radius 18-24px, margen de 8px). Nunca sidebar negra en light mode (§28 del brief).
- **El module switcher desaparece.** Reservas y Documentos pasan a ser secciones de la misma sidebar. Los 3 accents de módulo hardcodeados se convierten en tokens; Reservas conserva su azul (§67 del brief) vía `--module-accent`.
- **Iconos Lucide** — la dependencia ya está instalada. Eliminar `◈`, `☰`, `👁`, `🌙`, `☀️`, `♿`, `🔑`.
- **`navigationConfig` centralizado** con `{ id, label, icon, section, permission, badge }`. Hoy la nav está en `NAV_FACTURACION` + `COMPONENTS` + `TITLES` + el switcher + el dropdown mobile = **5 lugares que hay que mantener sincronizados**.
- **Topbar**: búsqueda (`⌘K`), privacidad de cifras, theme switcher, CTA principal, avatar. Las notificaciones **solo si tienen contenido real derivable** (§75 del brief) — hoy no lo tienen, así que no se agrega.
- **Densidad media.** Objetivo 1366px y 1440px.

## F.4 Cómo se traduce PymeCloud sin copiarlo

| Lo que tomo | Lo que cambio |
|---|---|
| Sidebar clara con secciones y contador inline | Secciones nombradas por dominio real (Principal / Documentos / Análisis / Admin), no genéricas |
| Cards con mucho aire y jerarquía tipográfica | Densidad media, no la densidad baja de PymeCloud — esto es una herramienta de oficina, no un dashboard de consumo |
| Home orientado a acción ("Esto es lo que está pasando") | **"Para revisar" primero**, métricas después. PymeCloud pone KPIs arriba; nosotros ponemos lo accionable |
| Glassmorphism moderado en sidebar/header/modales | Nunca `opacity` en containers con texto — solo transparencia en el `background` |
| Botón CTA azul redondeado | **Rojo `#C8102E` con moderación** — CTA principal, selección, acentos chicos. No pintar todo de rojo |
| Cards de reportes con icono + descripción | Mantengo pero conecto a los reportes reales que existen, no invento categorías |

**Lo que NO tomo:** el chrome de "PYME CLOUD / Plan Profesional" del selector de empresa (TA es mono-tenant), los iconos pastel en círculo de colores (demasiado consumer para uso interno), y la densidad baja.

---

# G. ARCHIVOS IMPACTADOS

## G.1 Fase 0.5 — pre-rediseño (correcciones bloqueantes)

| Archivo | Acción |
|---|---|
| `supabase_retenciones.sql` | **CREAR** — DDL faltante de R1 |
| `src/components/ComprobanteForms.tsx` | Fix R3 (recibos cruzados), R11 (select de estados) |
| `src/pages/Facturas.tsx` | Fix deps de `useMemo` (`:417`) |
| `src/app/api/reservas/import-excel/route.ts` | Auth + confirmación (R4) |
| `src/app/api/reservas/export-sheets/route.ts` | Auth en POST (R4) |
| `src/app/api/extract-invoice/route.ts` | Auth + límite de tamaño (R4) |

## G.2 Fase 1 — Foundation

| Archivo | Acción |
|---|---|
| `src/app/globals.css` | Refactor de tokens: cerrar light + accessible, añadir espaciado/tipografía/z-index/focus |
| `src/app/layout.tsx` | `next/font` (Inter) + script anti-FOUC de theme |
| `src/components/shell/AppShell.tsx` | **CREAR** |
| `src/components/shell/Sidebar.tsx` | **CREAR** |
| `src/components/shell/Topbar.tsx` | **CREAR** |
| `src/components/shell/UserMenu.tsx` | **CREAR** |
| `src/lib/navigation.ts` | **CREAR** — `navigationConfig` |
| `src/components/ui/*.tsx` | Expandir `ui.tsx` → Card, MetricCard, StatusBadge, DataTable, Drawer, ConfirmDialog, EmptyState, ErrorState, Skeleton, FilterPopover, SearchInput |
| `src/app/page.tsx` | Adelgazar de 252 líneas a un orquestador |
| `src/components/HideNumbers.tsx` | Persistir en localStorage |
| `src/lib/utils.ts` | Años dinámicos (elimina R27) |

## G.3 Fases 2-6

| Fase | Archivos |
|---|---|
| 2 · Home | `src/pages/Inicio.tsx` (**nuevo**, reemplaza el rol de Dashboard), `src/pages/Dashboard.tsx` → pasa a Reportes |
| 3 · Facturación | `Facturas.tsx`, `ComprobanteForms.tsx` |
| 4 · Recibos/Clientes/Docs | `OtherPages.tsx` → **partir en 5 archivos**; borrar `NotasCredito.tsx` muerto |
| 5 · Reservas | `Reservas.tsx` |
| 6 · Reportes/Admin | `Informe.tsx`, `Usuarios.tsx`, `LoginPage.tsx`, `CambiarPassword.tsx` |
| 7 · Productividad | `CommandPalette.tsx` (**nuevo**), `GlobalSearch.tsx` (**nuevo**) |

## G.4 A borrar (todo recuperable desde git)

```
src/App.jsx                        huérfano, 8 imports inexistentes
src/pages/NotasCredito.tsx         324 líneas muertas, diverge fiscalmente
src/pages/FacturasIngreso.jsx      374 líneas, inalcanzable, contradice el schema
src/pages/ReservasIngreso.jsx      370 líneas, inalcanzable
src/pages/{Recibos,Clientes,NotasDebito,Resumen}.tsx   re-exports no usados
src/components/aviso/AppHeader.jsx  solo lo usa App.jsx
src/components/aviso/MainNav.jsx    ídem
{src/                              directorio con nombre corrupto
```

**A preservar:** todo `src/components/aviso/Step*.jsx` + `constants.jsx` + `FormField.jsx`. Contienen reglas de negocio (splits de comisión) que no están en ningún otro lado.

---

# H. PLAN PROPUESTO

## H.0 Decisiones que necesito de vos antes de empezar

1. **Avisos de Ingreso** — ¿lo oculto del nav (3 líneas) hasta completarlo, o lo dejo visible? Hoy genera números de referencia falsos con `Math.random()` y promete envíos que no ocurren.
2. **Routing** — el brief pide deep links desde las alertas del Home y command palette, pero no migrar routing en fase 1. Propongo: **fase 1 con un bus de navegación tipado** (`navigate('facturas', { estado: ['pendiente'] })`) que después se mapea 1:1 a rutas reales sin reescribir consumidores. ¿Te sirve, o preferís migrar a App Router de una?
3. **Notas de Débito** — hoy no se pueden crear desde la app. ¿Entra en alcance completarlo, o se mantiene como está?
4. **R6/R7 (bugs fiscales)** — el Dashboard resta 21% a las FACT B y las NC B reciben IVA 21%. Son incorrectos, pero corregirlos **cambia números que ya se reportaron**. ¿Los corrijo, o los documento y los dejo para una decisión con contaduría?

## H.1 Secuencia

| Fase | Contenido | Entregable |
|---|---|---|
| **0.5** | Commitear working tree · `supabase_retenciones.sql` · fix R3, R4, R11 · borrar código muerto | `main` estable y versionada |
| **1** | Design tokens multi-theme · `next/font` · AppShell + Sidebar + Topbar · `navigationConfig` · librería de componentes · focus states | Preview con **toda la funcionalidad intacta** y shell nuevo |
| **2** | Dashboard → **Inicio**: saludo real, Para revisar, Acciones rápidas, Resumen, Actividad, Facturas recientes | Preview |
| **3** | Facturación + cobranzas: listado, tabs, buscador, FilterPopover con chips, DataTable, DetailDrawer, alta, edición, cobro, anulación | Preview + checklist D.3 completa |
| **4** | Recibos · Clientes · NC · ND. Partir `OtherPages.tsx` | Preview |
| **5** | Reservas con el design system, preservando tabs, categorías, azul y filtros | Preview |
| **6** | Reportes · PDF CFO (+ fix R24/R25) · Usuarios · Login · Perfil. Aplicar gates de rol reales | Preview |
| **7** | Búsqueda global · command palette `⌘K` · shortcuts | Preview → producción |

## H.2 Método de trabajo

- Branch **`redesign/homebanking-ui`**, nunca directo a `main`.
- Commits por unidad de sentido (`refactor: multi-theme design tokens`, `feat: app shell`, …), no un commit gigante.
- `npm run build` antes de cada push. **Preview deployment** en cada fase, nunca promoción automática a producción.
- La versión productiva actual sigue disponible hasta que apruebes.
- Checklist D.3 ejecutada al cierre de cada fase.

## H.3 Fuera de alcance de esta iteración (confirmado con el brief)

- UI completa de "un recibo → múltiples facturas" (§64 del brief)
- Importación PDF + IA como proyecto funcional (§72) — la existente se preserva tal cual
- "Mi actividad" / tareas personales (§21)
- Completar Avisos de Ingreso (requiere 3 tablas nuevas + integración PROA + notificaciones)
- Migración masiva de UI framework (§16)
- Nuevas migrations más allá de `supabase_retenciones.sql` (§90 — que es recuperar lo que ya existe en producción, no una migración nueva)

---

## STOP POINT

No modifiqué ningún archivo. No hice commits. No hice deploy.
Esperando tu aprobación y las 4 respuestas de **H.0** para arrancar la Fase 0.5.
