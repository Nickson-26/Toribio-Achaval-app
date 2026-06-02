-- ============================================================
-- Migración: columna proa_codigo para sync automático desde PROA
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- ============================================================

ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS proa_codigo TEXT;

-- Unique index parcial: solo aplica a filas que vienen de PROA
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservas_proa_codigo
  ON public.reservas (proa_codigo)
  WHERE proa_codigo IS NOT NULL;

COMMENT ON COLUMN public.reservas.proa_codigo IS
  'Código de propiedad en PROA (ej: TNP 67093). NULL = carga manual o por mail.';
