# Schema de Supabase — TA App

Cómo levantar la base desde cero y cómo se relacionan los scripts SQL del repo.

---

## Estado del versionado

No hay Supabase CLI ni tabla de migraciones. Los `.sql` de la raíz son scripts
sueltos de aplicación manual, ordenados solamente por fecha de archivo. Varios
se contradicen entre sí y algunos nunca se aplicaron.

Esta carpeta es el primer paso para revertir eso. **Toda modificación de schema
de acá en adelante va en `supabase/migrations/` con fecha en el nombre, y se
commitea junto con el código que la necesita.**

---

## Levantar un entorno nuevo

Ejecutar en el SQL Editor de Supabase, en este orden:

| # | Archivo | Qué hace |
|---|---|---|
| 1 | `../supabase_schema.sql` | Tablas base: `comprobantes`, `recibos` + índices |
| 2 | `../supabase_auth.sql` | Tabla `usuarios` |
| 3 | `../supabase_enterprise.sql` | RLS por rol, `get_user_role()`, `audit_log`, triggers |
| 4 | `../supabase_punto_venta.sql` | `comprobantes.punto_venta` |
| 5 | `../supabase_pdf_multirecibo.sql` | `pdf_url`, bucket `comprobantes-pdfs`, políticas de Storage |
| 6 | `../supabase_reservas_email.sql` | `reservas.email_message_id` |
| 7 | `../supabase_reservas_proa.sql` | `reservas.proa_codigo` |
| 8 | `../supabase_fix_proa_constraint.sql` | Reemplaza el índice parcial por UNIQUE completo |
| 9 | **`migrations/2026-08-20_reconciliacion.sql`** | **Payment tracking, `retenciones`, CHECK de 6 estados, `factura_asociada_id`** |

### Salvedades conocidas de los pasos 1-8

Son scripts viejos, no idempotentes entre sí. Al correrlos en secuencia:

- **`supabase_enterprise.sql` puede fallar** en los índices `idx_audit_*` si ya
  existen (los crea sin `IF NOT EXISTS`) y en las políticas de Storage
  (`CREATE POLICY` no admite `IF NOT EXISTS`). Si falla ahí, comentar ese bloque
  y seguir.
- **`supabase_schema.sql` incluye datos semilla desactualizados.** El comprobante
  `NC-A-425` del seed tiene montos que violan `chk_montos_coherentes`; en
  producción el valor correcto es otro. Si el CHECK falla, corregir el seed o
  saltear los INSERT.
- La tabla `reservas` **no la crea ningún script versionado**. Su DDL sólo existe
  dentro de `backup_schema.sql`. Para un entorno nuevo hay que extraerla de ahí.

Estas salvedades están abiertas a propósito: arreglarlas implica reescribir
scripts históricos, y eso es una tarea separada de la estabilización.

---

## Aplicar a producción (base ya existente)

Sólo el paso 9:

```
migrations/2026-08-20_reconciliacion.sql
```

Es idempotente y aditivo — no borra tablas, columnas ni datos, y se puede correr
más de una vez. Está envuelto en `BEGIN/COMMIT`: si algo falla, no queda nada a
medias. Termina imprimiendo un `NOTICE` con el resultado de la verificación.

---

## Qué reconcilia el paso 9

Relevado contra la base real el 2026-08-20 (263 comprobantes, 200 recibos,
166 reservas, 4 usuarios, 885 filas de `audit_log`).

### Estaba en producción pero no en el repo
Se había aplicado a mano en el SQL Editor y el DDL se perdió.

- Tabla `retenciones` (existe, 0 filas)
- `comprobantes.pago_recibido`, `fecha_pago`, `medio_pago`, `importe_pagado`,
  `referencia_pago`, `observaciones_pago`
- CHECK de `comprobantes.estado` ampliado — confirmado porque hay 2 filas en
  `faltan_retenciones`, valor que la constraint original rechazaba

### Estaba en el repo pero no en producción
Peor caso: el código lo usa y falla.

- **`comprobantes.factura_asociada_id`** — `migration_nc_factura.sql` nunca se
  aplicó. `OtherPages.tsx:546` inserta esa columna al crear una Nota de Crédito.
  **Crear una NC falla hoy en producción.** El paso 9 lo corrige.
- `recibo_comprobantes.created_at`

### Sin divergencias
`recibos`, `reservas`, `usuarios`, `audit_log` y el resto de `comprobantes`
coinciden con lo que espera el código.

---

## Los 6 estados de `comprobantes.estado`

| Estado | Significado |
|---|---|
| `pendiente` | Emitida, sin cobrar |
| `cobrada` | Circuito cerrado, con recibo emitido |
| `anulada` | Anulada (soft delete) o cancelada por una NC |
| `emitida` | NC / ND recién emitidas |
| `faltan_retenciones` | El cliente pagó pero no mandó las retenciones, así que todavía no se puede emitir el recibo |
| `echeq_pendiente` | Cobrado con e-cheq de pago diferido, aún sin acreditar |

Los dos últimos son los que la constraint original bloqueaba.

---

## `recibo_comprobantes`

Se preserva íntegra. Soporta el vínculo **un recibo → N facturas** y hoy tiene
0 filas: el flujo existe en `db.createReciboConFacturas()` pero el camino
principal de cobro no la escribe.

**No revertir.** La UI completa de ese workflow es una etapa aparte; mientras
tanto la estructura queda intacta y compatible.

---

## Scripts DESTRUCTIVOS en la raíz

Estos borran datos y no tienen ninguna guarda. Están sueltos junto a las
migraciones estructurales, con nombres parecidos. **No ejecutar por accidente.**

| Archivo | Qué hace |
|---|---|
| `supabase_truncate_reservas.sql` | `TRUNCATE reservas RESTART IDENTITY` — sin transacción |
| `supabase_delete_totales.sql` | `DELETE` sin transacción |
| `supabase_fix_duplicados.sql` | Borra filas duplicadas |
| `supabase_pv0004_renumber.sql` | Renumera comprobantes. Único bien escrito: usa `BEGIN/COMMIT` con verificación previa |

---

## Backups

`backup_schema.sql` y `backup_data.sql` (2026-06-10) están en `.gitignore`.

`backup_schema.sql` se autodocumenta como el archivo de recuperación ante
desastre, pero **no sirve para eso**: restaurar desde ahí produce una base
materialmente distinta — sin RLS por rol, sin el trigger de auditoría, sin
`fk_recibo`, sin `chk_montos_coherentes`, y con `recibos.id` como `SERIAL` en
vez de `INTEGER` (lo que rompe la numeración manual de recibos al primer
insert). Para reconstruir, usar la tabla de orden de más arriba.
