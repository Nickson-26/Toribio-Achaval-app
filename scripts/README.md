# Import automático de reservas desde mails

Pipeline para procesar mails con asunto "Nueva Reserva" enviados por
`info@toribioachaval.com` y cargarlos a la tabla `reservas` en Supabase.

## Componentes

- `parse-reserva-email.mjs` — parser puro. Recibe `{messageId, subject, snippet, dateIso}` y devuelve un payload listo para insertar (o `skip_reason`).
- `import-reservas.mjs` — toma un array JSON de mails desde STDIN, parsea y postea al endpoint `/api/reservas/import` uno por uno. Idempotente (el endpoint dedupea por `email_message_id`).

## Setup en Supabase

1. Ejecutar la migración `supabase_reservas_email.sql` en el SQL Editor.
   Agrega la columna `email_message_id` y el unique index parcial.

## Setup en Vercel

Agregar dos env vars (Settings → Environment Variables):

| Var | Valor |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` (secret) |
| `RESERVAS_IMPORT_SECRET` | Cualquier string aleatorio largo. Sugerencia: `openssl rand -hex 32` |

Aplicar a `Production` y redeploy.

## Backfill manual

Para cargar mails históricos:

```bash
# 1. Exportar los mails desde Gmail a JSON (formato esperado: [{messageId, subject, snippet, dateIso}, ...])
# 2. Correr en dry-run para ver qué se cargaría:
DRY_RUN=1 node scripts/import-reservas.mjs < emails.json

# 3. Si está OK, correr de verdad:
IMPORT_URL=https://ta-app-toribio-achaval.vercel.app/api/reservas/import \
IMPORT_SECRET=<el-secret> \
node scripts/import-reservas.mjs < emails.json
```

## Run automático (Cowork scheduled task)

El scheduled task corre periódicamente, busca mails nuevos en Gmail con
`subject:"Nueva Reserva" newer_than:2d -label:procesado-reservas`, los procesa
y los postea al endpoint. Ver el prompt completo en `SCHEDULED_TASK.md`.

## Mails "Indirectas"

Los mails con asunto `Nueva Reserva Indirecta` no traen código de unidad.
El parser usa el mapeo `INDIRECTA_BROKER_TO_UNIDAD` en
`parse-reserva-email.mjs`. Si el broker no está mapeado, la reserva se
**skipea** con razón `indirecta_sin_mapping_para_broker:<nombre>` y queda
para review manual.

Para agregar un broker, editar `INDIRECTA_BROKER_TO_UNIDAD` y commitear.
