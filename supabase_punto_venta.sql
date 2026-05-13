-- ============================================================
-- Migración: agregar columna punto_venta a comprobantes
-- (Facturas, NC, ND). Ejecutar en Supabase → SQL Editor → Run.
-- ============================================================

-- 1. Nueva columna con default '0002' para todos los nuevos comprobantes
ALTER TABLE public.comprobantes
  ADD COLUMN IF NOT EXISTS punto_venta TEXT;

-- 2. Backfill: todos los existentes (NULL) → '0002'
UPDATE public.comprobantes
   SET punto_venta = '0002'
 WHERE punto_venta IS NULL;

-- 3. Default + NOT NULL para garantizar consistencia hacia adelante
ALTER TABLE public.comprobantes
  ALTER COLUMN punto_venta SET DEFAULT '0002';

ALTER TABLE public.comprobantes
  ALTER COLUMN punto_venta SET NOT NULL;

-- 4. Validar que solo entran valores conocidos
ALTER TABLE public.comprobantes
  DROP CONSTRAINT IF EXISTS chk_punto_venta;
ALTER TABLE public.comprobantes
  ADD CONSTRAINT chk_punto_venta CHECK (punto_venta IN ('0002', '0004'));

-- 5. Índice para filtros rápidos
CREATE INDEX IF NOT EXISTS idx_comp_pv ON public.comprobantes(punto_venta);

COMMENT ON COLUMN public.comprobantes.punto_venta IS
  'Punto de venta AFIP del comprobante. Valores válidos: 0002 | 0004.';
