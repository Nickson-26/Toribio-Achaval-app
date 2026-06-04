-- Crea el indice unico en proa_codigo necesario para el upsert del import.
-- Solo aplica a filas con proa_codigo no nulo (indice parcial).

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservas_proa_codigo
  ON public.reservas (proa_codigo)
  WHERE proa_codigo IS NOT NULL;
