# Setup: import automático de reservas

Pasos para activar el pipeline mail → reservas. Una sola vez.

## 1. Aplicar la migración SQL en Supabase

Supabase → SQL Editor → New query → pegar el contenido de
`supabase_reservas_email.sql` → Run.

Verificar que la columna se creó:
```sql
SELECT column_name FROM information_schema.columns
 WHERE table_name='reservas' AND column_name='email_message_id';
-- Debe devolver 1 fila.
```

## 2. Generar el shared secret

En cualquier terminal:
```bash
openssl rand -hex 32
```
Guardar el string. Va a vivir en Vercel y en el scheduled task.

## 3. Configurar Vercel

Project → Settings → Environment Variables → agregar:

| Variable | Valor | Environments |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` | Production |
| `RESERVAS_IMPORT_SECRET` | El string generado en el paso 2 | Production |

Después de agregar, **Redeploy** la última versión para que tome las vars.

## 4. Verificar el endpoint

```bash
# Health check
curl https://ta-app-toribio-achaval.vercel.app/api/reservas/import
# → {"ok":true,"endpoint":"reservas/import"}

# Auth check (sin secret debe ser 401)
curl -X POST https://ta-app-toribio-achaval.vercel.app/api/reservas/import
# → {"error":"unauthorized"}
```

## 5. Crear el scheduled task

Ver `scripts/SCHEDULED_TASK.md` — copiar el prompt y crear la tarea en
Cowork con frecuencia de 1 hora.

## 6. (Opcional) Backfill de mails históricos

Si querés cargar los últimos 30 días de mails que ya están en la inbox
desde antes:

1. Pedirle al asistente: *"Hacé un backfill de reservas de los últimos
   30 días en dry-run"* — vas a ver qué se cargaría.
2. Confirmá y pedile: *"Ahora corré el backfill de verdad"*.

## Mapeo de brokers para "Indirectas"

Los mails con asunto `Nueva Reserva Indirecta` no traen código. El parser
los skipea hasta que les definamos el broker. Cuando tengas la lista
broker → unidad, completar el objeto `INDIRECTA_BROKER_TO_UNIDAD` en
`scripts/parse-reserva-email.mjs` y commitear.
