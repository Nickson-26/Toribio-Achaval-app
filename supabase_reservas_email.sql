-- ============================================================
-- Migración: idempotencia para import automático de reservas
-- desde mails "Nueva Reserva".
--
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- ============================================================

-- Columna que guarda el ID del thread de Gmail que originó la reserva.
-- Permite no duplicar si el job vuelve a procesar el mismo mail.
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS email_message_id TEXT;

-- Unique index parcial: solo aplica a filas que vienen del importador.
-- Las reservas cargadas a mano (email_message_id NULL) no entran en la
-- restricción.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservas_email_msgid
  ON public.reservas (email_message_id)
  WHERE email_message_id IS NOT NULL;

-- Índice de búsqueda general (ya existía idx_reservas_broker / op)
CREATE INDEX IF NOT EXISTS idx_reservas_fecha
  ON public.reservas (fecha DESC);

COMMENT ON COLUMN public.reservas.email_message_id IS
  'Gmail thread ID del mail "Nueva Reserva" que originó esta fila. NULL = carga manual.';
