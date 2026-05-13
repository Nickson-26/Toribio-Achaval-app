-- ============================================================
-- Renumeración: facturas FC-A-4157 / 4158 / 4159 (PV 0002 histórico)
-- pasan a ser las 1, 2 y 3 del PV 0004.
--
-- IMPORTANTE: ejecutar DESPUÉS de supabase_punto_venta.sql.
-- Si esas facturas son de otro tipo (B/FCE/E), avisar antes.
-- ============================================================

BEGIN;

-- Asegurar que las 3 existen y son FACT A, sino abortar.
DO $$
DECLARE
  c INT;
BEGIN
  SELECT COUNT(*) INTO c
    FROM public.comprobantes
   WHERE id IN ('FC-A-4157', 'FC-A-4158', 'FC-A-4159')
     AND tipo = 'FACT A';
  IF c <> 3 THEN
    RAISE EXCEPTION 'No se encontraron las 3 facturas FACT A (4157/4158/4159). Encontradas: %', c;
  END IF;
END $$;

-- 1) Actualizar la columna en recibos.nro_fact ANTES de cambiar el id,
--    para evitar romper la trazabilidad. nro_fact es TEXT (no es FK física).
UPDATE public.recibos SET nro_fact = 'FC-A-0004-1' WHERE nro_fact = 'FC-A-4157';
UPDATE public.recibos SET nro_fact = 'FC-A-0004-2' WHERE nro_fact = 'FC-A-4158';
UPDATE public.recibos SET nro_fact = 'FC-A-0004-3' WHERE nro_fact = 'FC-A-4159';

-- 2) Renumerar las 3 facturas (id, numero, punto_venta)
UPDATE public.comprobantes
   SET id          = 'FC-A-0004-1',
       numero      = 1,
       punto_venta = '0004'
 WHERE id = 'FC-A-4157';

UPDATE public.comprobantes
   SET id          = 'FC-A-0004-2',
       numero      = 2,
       punto_venta = '0004'
 WHERE id = 'FC-A-4158';

UPDATE public.comprobantes
   SET id          = 'FC-A-0004-3',
       numero      = 3,
       punto_venta = '0004'
 WHERE id = 'FC-A-4159';

-- 3) Verificación
DO $$
DECLARE
  c INT;
BEGIN
  SELECT COUNT(*) INTO c
    FROM public.comprobantes
   WHERE id IN ('FC-A-0004-1', 'FC-A-0004-2', 'FC-A-0004-3')
     AND punto_venta = '0004';
  IF c <> 3 THEN
    RAISE EXCEPTION 'La renumeración no quedó correctamente. % filas con los nuevos IDs.', c;
  END IF;
  RAISE NOTICE 'Renumeración OK: 3 facturas movidas al PV 0004 con números 1, 2 y 3.';
END $$;

COMMIT;
