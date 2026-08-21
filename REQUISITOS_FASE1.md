# Requisitos vinculantes para la Fase 1

Decisiones de producto tomadas durante la Fase 0. **No son sugerencias**: el
design system y el AppShell deben cumplirlas.

---

## 1. Estados: valores internos vs. texto visible

Los enums de la base **no se tocan**. La capa visual traduce.

| Valor en DB | Texto para el usuario |
|---|---|
| `pendiente` | Pendiente |
| `faltan_retenciones` | Faltan retenciones |
| `cobrada` | Cobrada |
| `anulada` | Anulada |
| `emitida` | Emitida |
| `echeq_pendiente` | E-cheq pendiente |

**Prohibido mostrar snake_case en la UI.** Hoy `faltan_retenciones` y
`echeq_pendiente` se renderizan crudos en los badges — eso se corrige en Fase 1.

Nunca cambiar el valor guardado por una cuestión de presentación.

## 2. `StatusBadge` — componente centralizado

Un único componente para todos los estados, en toda la app.

- texto humano, nunca snake_case
- `font-weight` 550–600
- tamaño chico/medio, padding compacto
- `border-radius` tipo pill
- alto contraste
- colores semánticos suaves
- funciona en Light / Dark / Alto contraste

## 3. Pendiente ≠ Faltan retenciones

El punto más importante de la traducción visual. **No deben parecer el mismo
problema.**

| Estado | Qué significa realmente | Tratamiento |
|---|---|---|
| **Pendiente** | El cliente **no pagó**. Hay dinero por entrar. | Amber / warning |
| **Faltan retenciones** | El cliente **ya pagó**. El dinero entró. Falta la información de retenciones para poder emitir el recibo. **No es deuda.** | Informativo / azul, o un warning diferenciado. **No como error crítico.** |
| **Cobrada** | Circuito completo, recibo emitido. | Verde / success |

Texto sugerido para el estado intermedio: *"Pago recibido · falta completar
retenciones"*.

## 4. Alcance de retenciones — deliberadamente chico

**No** es un módulo documental. Fuera de alcance: subida de certificados, PDFs,
archivos, workflow documental, módulo aparte, dashboard dedicado, tracking
complejo.

La tabla `retenciones` se mantiene porque ya existe y el código la usa. Su única
razón de ser es distinguir *"el cliente no pagó"* de *"pagó pero el circuito
administrativo no está cerrado"*.

Flujo completo:

```
Pendiente
   ↓ cliente paga
   ├─ ¿faltan retenciones? SÍ → Faltan retenciones
   │                             ↓ llegan las retenciones
   │                          Emitir recibo → Cobrada
   └─ NO → Emitir recibo → Cobrada
```

## 5. Gateo de acciones por rol

**Verificado en Fase 0: la seguridad server-side es correcta.** Probado con un
usuario `viewer` real contra producción — escribió **0 filas** en todas las
tablas. Ver §7.

Por eso no se rediseñó la UI en Fase 0. Pero en Fase 1 es obligatorio:

- un `viewer` **no debe ver** CTAs que terminarán en error
- botones y acciones gateados por rol, derivados de `RUTAS`/permisos
- hoy hay 12 acciones visibles para `viewer` que RLS rechaza con errores crudos
  de Postgres (`new row violates row-level security policy`)

## 6. Cobertura de `useHideNumbers` — estado actual medido

| Archivo | Usa el hook | Puntos con `num-hidden` |
|---|---|---|
| `Dashboard.tsx` | Sí | 20 |
| `Reservas.tsx` | Sí | 16 |
| `shell/TopNav.tsx` | Sí (el toggle) | — |
| **`Facturas.tsx`** | **No** | **0** |
| **`OtherPages.tsx`** (Recibos, Clientes, NC, ND) | **No** | **0** |
| **`Informe.tsx`** (PDF CFO) | **No** | **0** |
| **`ComprobanteForms.tsx`** (5 modales) | **No** | **0** |

Además:

- el componente `<Num>` de `HideNumbers.tsx` **no se usa en ningún lado** — todos
  aplican `className={hidden ? 'num-hidden' : ''}` a mano
- el estado **no persiste**: `useState` sin `localStorage`, se pierde al recargar
- los **tooltips y ejes de Chart.js se escapan del blur** porque se dibujan en
  canvas, donde el `filter: blur()` de CSS no aplica
- las **exportaciones CSV y XLS ignoran** el estado por completo
- el **PDF CFO sale con todas las cifras en claro** aunque el modo esté activo

**No es un problema de autorización ni una fuga server-side.** Es una función de
privacidad de pantalla (demos, compartir pantalla, trabajar en un espacio
abierto). Los datos siempre viajan al cliente; el blur es cosmético.

### Requisito de Fase 1

Cobertura coherente en: Home, Facturas, Recibos, Clientes, NC, ND, Informe y
toda superficie financiera. Persistir la preferencia. Resolver los canvas de
Chart.js (formatear los ticks y tooltips, no confiar en CSS).

**Decisión pendiente y explícita para exportaciones:** ¿un CSV/XLS/PDF generado
con el modo activo debe salir con las cifras ocultas, salir completo, o
bloquearse? No asumir. Mi recomendación: **exportar completo pero advertir**, ya
que exportar datos ilegibles no le sirve a nadie y el modo es de privacidad
visual, no de autorización.

## 7. Verificación de seguridad de Fase 0 (para no repetirla)

Probado contra producción con un usuario `viewer` temporal, creado y eliminado
en el mismo procedimiento.

| Operación como `viewer` aprobado | Resultado |
|---|---|
| `SELECT` en comprobantes / recibos / reservas / retenciones | Permitido |
| `INSERT` en comprobantes | `42501` bloqueado |
| `UPDATE` / `DELETE` en comprobantes | 0 filas afectadas |
| `INSERT` / `UPDATE` en recibos | bloqueado / 0 filas |
| `INSERT` en retenciones | `42501` bloqueado |
| `INSERT` / `UPDATE` en reservas | bloqueado / 0 filas |
| `UPDATE usuarios` sobre sí mismo a `role='admin'` | 0 filas — **escalada cerrada** |
| **Total de filas escritas** | **0** |

Con la cuenta **sin aprobar** (`aprobado=false`): 0 filas de comprobantes,
recibos, reservas y retenciones. Sólo ve su propia fila de `usuarios`.

> **Trampa metodológica a recordar:** con `Prefer: return=minimal`, PostgREST
> devuelve `HTTP 204` tanto si modificó filas como si modificó cero. Un `UPDATE`
> bloqueado por RLS parece exitoso. Para medir de verdad hay que usar
> `Prefer: return=representation` y contar las filas devueltas.
