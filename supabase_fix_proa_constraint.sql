-- Primero borrar el indice parcial si existe
DROP INDEX IF EXISTS idx_reservas_proa_codigo;

-- Crear un UNIQUE CONSTRAINT (no solo indice) — requerido por Supabase para upsert.
-- PostgreSQL permite multiples NULLs en una columna UNIQUE, asi que los registros
-- sin proa_codigo siguen funcionando.
ALTER TABLE public.reservas
  DROP CONSTRAINT IF EXISTS reservas_proa_codigo_unique;

ALTER TABLE public.reservas
  ADD CONSTRAINT reservas_proa_codigo_unique UNIQUE (proa_codigo);
