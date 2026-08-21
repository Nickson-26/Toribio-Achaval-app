# PREFLIGHT — `migrations/2026-08-20_reconciliacion.sql`

Leer antes de ejecutar en producción. **Yo no la ejecuté.**

---

## 1. Qué crea o modifica

### Tabla nueva

| Tabla | Detalle |
|---|---|
| `retenciones` | 9 columnas. PK `id` uuid, FK `comprobante_id → comprobantes(id) ON DELETE CASCADE`. Ya existe en producción (0 filas) — el `CREATE TABLE IF NOT EXISTS` no hará nada. |

### Columnas nuevas en `comprobantes`

| Columna | Tipo | ¿Ya existe en producción? |
|---|---|---|
| `pago_recibido` | `BOOLEAN DEFAULT FALSE` | Sí |
| `fecha_pago` | `DATE` | Sí |
| `medio_pago` | `TEXT` | Sí |
| `importe_pagado` | `NUMERIC(18,2)` | Sí |
| `referencia_pago` | `TEXT` | Sí |
| `observaciones_pago` | `TEXT` | Sí |
| **`factura_asociada_id`** | `TEXT REFERENCES comprobantes(id) ON DELETE SET NULL` | **NO — esto es lo único que realmente se crea** |

### Columna nueva en `recibo_comprobantes`

| Columna | Tipo | ¿Ya existe? |
|---|---|---|
| `created_at` | `TIMESTAMPTZ DEFAULT now()` | No |

### Constraints

| Nombre | Acción |
|---|---|
| `comprobantes_estado_check` | Se reemplaza por la versión de 6 estados (agrega `faltan_retenciones` y `echeq_pendiente`) |
| `retenciones_tipo_check` | Se crea si no existe: `tipo IN ('ganancias','iva','iibb','suss')` |
| `retenciones_comprobante_tipo_key` | Se crea si no existe: `UNIQUE (comprobante_id, tipo)` |

### Índices

`idx_comp_factura_asociada`, `idx_ret_comprobante`, `idx_ret_pendientes` — los tres con `IF NOT EXISTS`.

### RLS

Habilita RLS en `retenciones` y crea dos políticas: lectura para usuarios aprobados, escritura para admin y editor. Usa `DROP POLICY IF EXISTS` antes de cada `CREATE`, así que es re-ejecutable.

**No toca la RLS de ninguna otra tabla.**

---

## 2. Qué parte corrige `factura_asociada_id`

Esta, en el paso 2 del script:

```sql
ALTER TABLE comprobantes
  ADD COLUMN IF NOT EXISTS factura_asociada_id TEXT REFERENCES comprobantes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comp_factura_asociada ON comprobantes(factura_asociada_id);
```

Es el contenido de `migration_nc_factura.sql`, que estaba versionado desde el 26/06 y **nunca se aplicó**.

**Por qué importa:** `src/screens/OtherPages.tsx:546` incluye esa columna en el `INSERT` al crear una Nota de Crédito. PostgREST valida el payload contra su cache de schema antes de llegar a Postgres, así que rechaza el insert entero. **Crear una NC falla hoy en producción.**

Es la única operación de la migración que cambia algo funcional. Todo lo demás ya está aplicado y sólo queda registrado en el repo.

---

## 3. Por qué cada operación es idempotente

| Operación | Mecanismo |
|---|---|
| 8 × `ADD COLUMN` | `IF NOT EXISTS` |
| `CREATE TABLE retenciones` | `IF NOT EXISTS` |
| 3 × `CREATE INDEX` | `IF NOT EXISTS` |
| `retenciones_tipo_check` | Bloque `DO $$` que consulta `pg_constraint` antes de crear |
| `retenciones_comprobante_tipo_key` | Ídem |
| `comprobantes_estado_check` | `DROP CONSTRAINT IF EXISTS` y después `ADD` — patrón "reemplazar", correcto al re-ejecutar |
| 2 × `CREATE POLICY` | Precedidas por `DROP POLICY IF EXISTS` |
| 5 × `COMMENT ON` | Idempotentes por naturaleza |

Correrla dos veces seguidas deja exactamente el mismo estado.

---

## 4. Confirmación: no hay operaciones destructivas

Verificado sobre el archivo:

| Patrón buscado | Ocurrencias |
|---|---|
| `DELETE FROM` | **0** |
| `TRUNCATE` | **0** |
| `DROP TABLE` | **0** |
| `DROP COLUMN` | **0** |
| `UPDATE` | **0** |
| `ALTER COLUMN` / `TYPE` | **0** |

> La palabra `DELETE` aparece 3 veces en el archivo, ninguna como sentencia:
> dos son cláusulas de foreign key (`ON DELETE SET NULL` en la línea 62,
> `ON DELETE CASCADE` en la 113) y una es un comentario en la línea 79.

Los únicos `DROP` son:
- `DROP CONSTRAINT IF EXISTS comprobantes_estado_check` — quita una regla de validación para reemplazarla por una **más permisiva** (4 → 6 valores). No toca datos.
- `DROP POLICY IF EXISTS` × 2 — sobre políticas de `retenciones`, tabla con 0 filas, y se recrean inmediatamente.

**Ninguna fila se modifica ni se borra.** La migración sólo agrega estructura.

### Dos resguardos adicionales

1. **Todo está dentro de `BEGIN … COMMIT`.** Si cualquier paso falla, no queda nada aplicado a medias.
2. **Antes de reemplazar el CHECK de estado**, el script cuenta las filas con un estado fuera de la lista permitida y **aborta con `RAISE EXCEPTION`** si encuentra alguna. Verificado contra producción: los 263 comprobantes usan sólo los 6 valores esperados (`pendiente` 46, `cobrada` 187, `anulada` 21, `emitida` 7, `faltan_retenciones` 2, `echeq_pendiente` 0), así que no debería dispararse.

---

## 5. Checks inmediatamente después de ejecutar

### 5.1 La propia migración informa

Al terminar imprime:

```
NOTICE:  comprobantes_estado_check actualizada a 6 estados.
NOTICE:  === RECONCILIACION OK — el schema coincide con lo que espera el codigo ===
```

Si sale `WARNING: === FALTAN: ... ===`, algo no se aplicó. Pasame la salida.

### 5.2 Verificar la columna que faltaba

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'comprobantes'
  AND column_name IN ('factura_asociada_id','pago_recibido','fecha_pago',
                      'medio_pago','importe_pagado','referencia_pago','observaciones_pago');
-- Esperado: 7 filas
```

### 5.3 Verificar el CHECK de estado

```sql
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'comprobantes_estado_check';
-- Esperado: CHECK ((estado = ANY (ARRAY['pendiente','cobrada','anulada',
--                    'emitida','faltan_retenciones','echeq_pendiente'])))
```

### 5.4 Verificar `retenciones` y su UNIQUE

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'retenciones'::regclass;
-- Esperado: PK, FK a comprobantes, retenciones_tipo_check,
--           retenciones_comprobante_tipo_key (UNIQUE)
```

El `UNIQUE (comprobante_id, tipo)` **no es opcional**: `db.upsertRetenciones()` usa `onConflict: 'comprobante_id,tipo'`. Sin él, guardar retenciones falla con `42P10`.

### 5.5 Confirmar que no se perdió nada

```sql
SELECT
  (SELECT count(*) FROM comprobantes)        AS comprobantes,   -- esperado 263
  (SELECT count(*) FROM recibos)             AS recibos,        -- esperado 200
  (SELECT count(*) FROM reservas)            AS reservas,       -- esperado 166
  (SELECT count(*) FROM usuarios)            AS usuarios,       -- esperado 4
  (SELECT count(*) FROM recibo_comprobantes) AS recibo_comp,    -- esperado 0
  (SELECT count(*) FROM retenciones)         AS retenciones;    -- esperado 0
```

### 5.6 Refrescar el cache de PostgREST

Supabase suele hacerlo solo en segundos. Si el paso 6 sigue fallando con `PGRST204`, forzarlo:

```sql
NOTIFY pgrst, 'reload schema';
```

---

## 6. Cómo verificar que Crear NC deja de dar `PGRST204`

### Antes de la migración — así se comporta hoy

Este fue el diagnóstico. Usa un `id` que **ya existe**, así el insert no puede prosperar en ningún caso y no escribe nada:

```sql
-- A) Con la columna -> falla porque la columna no existe
INSERT INTO comprobantes (id, tipo, fecha, cliente, persona, estado, factura_asociada_id)
VALUES ('FC-A-4198','NC A','2026-08-20','TEST','CONSULTORIA','emitida','FC-A-1');
-- ERROR: column "factura_asociada_id" of relation "comprobantes" does not exist

-- B) Sin la columna -> falla por PK duplicada (control: el resto del payload es válido)
INSERT INTO comprobantes (id, tipo, fecha, cliente, persona, estado)
VALUES ('FC-A-4198','NC A','2026-08-20','TEST','CONSULTORIA','emitida');
-- ERROR: duplicate key value violates unique constraint "comprobantes_pkey"
```

Vía la API, A devolvía `PGRST204` y B devolvía `23505`.

### Después de la migración

**Check de schema (no escribe nada):**

```sql
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name='comprobantes' AND column_name='factura_asociada_id'
) AS columna_existe;   -- esperado: true
```

**Repetir el test A.** Ahora debe fallar por **PK duplicada** (`23505`), no por columna inexistente. Ese cambio de error es la confirmación: significa que la columna ya se acepta y lo único que frena es el `id` repetido que pusimos a propósito.

**Prueba end-to-end en la app** (esta sí crea un comprobante real):

1. Facturación → Notas de Crédito → **+ Nueva NC**
2. Tipo `NC A`, elegir una factura en "Factura a anular", cargar un neto, guardar
3. Esperado: toast `✓ NC-A-nnn creada — anula FC-…`
4. Verificar:

```sql
SELECT id, tipo, neto_ars, iva, monto_ars, factura_asociada_id
FROM comprobantes WHERE tipo LIKE 'NC%' ORDER BY created_at DESC LIMIT 1;
-- factura_asociada_id debe tener el id de la factura elegida
-- y esa factura debe haber quedado en estado 'anulada'
```

5. **Probar también `NC B`** para validar el fix fiscal de este cierre: el formulario debe mostrar un único campo **"Total ARS"** en lugar de Neto + IVA calculados, y guardar con `iva = NULL`.

Si la NC de prueba no se quiere conservar, borrarla con `DELETE FROM comprobantes WHERE id = 'NC-A-nnn'` y devolver la factura a su estado anterior.

---

## Resumen

| | |
|---|---|
| Operaciones destructivas | **Ninguna** |
| Filas modificadas | **Ninguna** |
| Estructura agregada | 1 tabla (ya existía), 8 columnas (7 ya existían), 3 constraints, 3 índices, 2 políticas |
| Cambio funcional real | **1**: `factura_asociada_id`, que desbloquea la creación de Notas de Crédito |
| Reversible | Sí, envuelta en `BEGIN/COMMIT` |
| Re-ejecutable | Sí, idempotente |
