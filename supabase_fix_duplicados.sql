-- ============================================================
-- LIMPIEZA DE DUPLICADOS - RESERVAS PROA
-- Ejecutar en Supabase -> SQL Editor -> Run
--
-- El problema: importaciones multiples insertaron el mismo
-- registro varias veces (registros sin proa_codigo unico).
--
-- Este script:
-- 1. Muestra cuantos duplicados hay (solo lectura, seguro)
-- 2. Elimina los duplicados, conservando el registro mas reciente
-- ============================================================

-- PASO 1: Ver cuantos duplicados hay por direccion
-- (ejecutar primero para verificar antes de borrar)
SELECT
  direccion,
  COUNT(*) as cantidad,
  MIN(id) as id_mas_viejo,
  MAX(id) as id_mas_nuevo
FROM reservas
WHERE proa_codigo IS NULL
GROUP BY direccion
HAVING COUNT(*) > 1
ORDER BY cantidad DESC;

-- ============================================================
-- PASO 2: Borrar duplicados (mantiene el registro con id mayor)
-- DESCOMENTA y ejecuta solo despues de verificar el PASO 1
-- ============================================================

/*
DELETE FROM reservas
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY COALESCE(proa_codigo, direccion)
             ORDER BY id DESC
           ) AS rn
    FROM reservas
  ) ranked
  WHERE rn > 1
);
*/

-- PASO 3 (opcional): asignar codigos sinteticos a los TRS sin numero
-- que quedaron sin proa_codigo, para que futuros imports hagan upsert
/*
UPDATE reservas
SET proa_codigo = SPLIT_PART(unidad, ' ', 1) || '|' || direccion
WHERE proa_codigo IS NULL
  AND unidad IS NOT NULL;
*/
