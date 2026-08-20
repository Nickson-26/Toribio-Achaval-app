-- ============================================================================
-- RECONCILIACIÓN DE SCHEMA — 2026-08-20
-- ============================================================================
--
-- Propósito
-- ---------
-- Poner en el repositorio los cambios de schema que se habían aplicado a mano
-- en el SQL Editor de Supabase y nunca quedaron versionados, más los que
-- estaban versionados pero nunca se aplicaron.
--
-- Este archivo es IDEMPOTENTE y ADITIVO:
--   · No borra tablas, columnas ni datos.
--   · Se puede correr N veces sin efecto adicional.
--   · Se puede correr sobre producción o sobre un entorno vacío.
--
-- Estado verificado de producción al 2026-08-20 (263 comprobantes, 200 recibos,
-- 166 reservas, 4 usuarios, 885 filas de audit_log):
--
--   YA APLICADO A MANO, faltaba en el repo:
--     · tabla `retenciones`
--     · comprobantes.pago_recibido / fecha_pago / medio_pago /
--       importe_pagado / referencia_pago / observaciones_pago
--     · CHECK de comprobantes.estado ampliado (hay 2 filas en
--       'faltan_retenciones', así que la constraint vieja ya no rige)
--
--   VERSIONADO PERO NUNCA APLICADO  ← esto rompe la app hoy:
--     · comprobantes.factura_asociada_id (migration_nc_factura.sql)
--       OtherPages.tsx:546 lo inserta al crear una Nota de Crédito, y como la
--       columna no existe, CREAR UNA NC FALLA EN PRODUCCIÓN.
--     · recibo_comprobantes.created_at
--
-- Orden de ejecución: ver supabase/README.md
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. comprobantes — columnas de seguimiento de pago
--    Permiten distinguir "el cliente pagó" de "está cerrado el circuito".
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE comprobantes ADD COLUMN IF NOT EXISTS pago_recibido      BOOLEAN DEFAULT FALSE;
ALTER TABLE comprobantes ADD COLUMN IF NOT EXISTS fecha_pago         DATE;
ALTER TABLE comprobantes ADD COLUMN IF NOT EXISTS medio_pago         TEXT;
ALTER TABLE comprobantes ADD COLUMN IF NOT EXISTS importe_pagado     NUMERIC(18,2);
ALTER TABLE comprobantes ADD COLUMN IF NOT EXISTS referencia_pago    TEXT;
ALTER TABLE comprobantes ADD COLUMN IF NOT EXISTS observaciones_pago TEXT;

COMMENT ON COLUMN comprobantes.pago_recibido IS
  'El cliente pagó. Independiente de `estado`: puede haber pago sin recibo emitido (faltan retenciones).';
COMMENT ON COLUMN comprobantes.referencia_pago IS
  'Uso actual: en estado echeq_pendiente guarda la fecha de acreditación (YYYY-MM-DD).';
COMMENT ON COLUMN comprobantes.observaciones_pago IS
  'Uso actual: en estado echeq_pendiente guarda el número de e-cheq.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. comprobantes — factura_asociada_id
--    NUNCA SE APLICÓ. Sin esto, crear una Nota de Crédito falla con
--    "Could not find the 'factura_asociada_id' column in the schema cache".
--    Reemplaza a migration_nc_factura.sql (que queda como histórico).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE comprobantes
  ADD COLUMN IF NOT EXISTS factura_asociada_id TEXT REFERENCES comprobantes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comp_factura_asociada ON comprobantes(factura_asociada_id);

COMMENT ON COLUMN comprobantes.factura_asociada_id IS
  'Para Notas de Crédito: la factura que esta NC cancela. Al crear la NC la factura pasa a anulada.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. comprobantes.estado — CHECK ampliado a los 6 estados del código
--
--    El original (supabase_schema.sql) sólo permitía 4 y bloqueaba el flujo de
--    retenciones y e-cheq. Se reemplaza de forma segura: si alguna fila tuviera
--    un estado fuera de la lista, el ALTER falla y el BEGIN/COMMIT revierte
--    todo. Verificado contra producción: sólo hay valores de esta lista.
--
--      pendiente           emitida y sin cobrar
--      cobrada             circuito cerrado, con recibo
--      anulada             anulada (soft delete) o cancelada por una NC
--      emitida             NC / ND recién emitidas
--      faltan_retenciones  el cliente pagó pero no mandó las retenciones,
--                          así que todavía no se puede emitir el recibo
--      echeq_pendiente     cobrado con e-cheq de pago diferido, aún sin acreditar
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  invalidas INT;
BEGIN
  SELECT count(*) INTO invalidas
  FROM comprobantes
  WHERE estado NOT IN ('pendiente','cobrada','anulada','emitida','faltan_retenciones','echeq_pendiente');

  IF invalidas > 0 THEN
    RAISE EXCEPTION 'Hay % comprobantes con un estado fuera de la lista permitida. Revisar antes de aplicar la constraint.', invalidas;
  END IF;

  ALTER TABLE comprobantes DROP CONSTRAINT IF EXISTS comprobantes_estado_check;

  ALTER TABLE comprobantes ADD CONSTRAINT comprobantes_estado_check
    CHECK (estado IN ('pendiente','cobrada','anulada','emitida','faltan_retenciones','echeq_pendiente'));

  RAISE NOTICE 'comprobantes_estado_check actualizada a 6 estados.';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Tabla `retenciones`
--    Una fila por (comprobante, tipo de retención).
--    El UNIQUE es OBLIGATORIO: db.upsertRetenciones() usa
--    onConflict: 'comprobante_id,tipo'. Sin él, el upsert falla con 42P10.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS retenciones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comprobante_id  TEXT NOT NULL REFERENCES comprobantes(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL,
  aplica          BOOLEAN NOT NULL DEFAULT FALSE,
  recibida        BOOLEAN NOT NULL DEFAULT FALSE,
  importe         NUMERIC(18,2),
  documento_ref   TEXT,
  fecha_recepcion DATE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retenciones_tipo_check'
  ) THEN
    ALTER TABLE retenciones ADD CONSTRAINT retenciones_tipo_check
      CHECK (tipo IN ('ganancias','iva','iibb','suss'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retenciones_comprobante_tipo_key'
  ) THEN
    ALTER TABLE retenciones ADD CONSTRAINT retenciones_comprobante_tipo_key
      UNIQUE (comprobante_id, tipo);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ret_comprobante ON retenciones(comprobante_id);
CREATE INDEX IF NOT EXISTS idx_ret_pendientes  ON retenciones(comprobante_id)
  WHERE aplica = TRUE AND recibida = FALSE;

ALTER TABLE retenciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retenciones_read"  ON retenciones;
DROP POLICY IF EXISTS "retenciones_write" ON retenciones;

-- Lectura: cualquier usuario aprobado.
CREATE POLICY "retenciones_read" ON retenciones
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.aprobado = TRUE));

-- Escritura: admin y editor. Coherente con comprobantes.editor_insert/update.
CREATE POLICY "retenciones_write" ON retenciones
  FOR ALL TO authenticated
  USING      (public.get_user_role(auth.uid()) IN ('admin','editor'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','editor'));

COMMENT ON TABLE retenciones IS
  'Retenciones impositivas por comprobante. Un comprobante con retenciones que aplican y no fueron recibidas queda en estado faltan_retenciones.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. recibo_comprobantes — created_at faltante
--    La tabla existe (0 filas). Se preserva íntegra: soporta el vínculo
--    un recibo → N facturas. NO se revierte.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE recibo_comprobantes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

COMMIT;

-- ============================================================================
-- VERIFICACIÓN — no modifica nada, sólo informa
-- ============================================================================
DO $$
DECLARE
  faltan TEXT := '';
  c TEXT;
BEGIN
  FOREACH c IN ARRAY ARRAY['pago_recibido','fecha_pago','medio_pago','importe_pagado',
                           'referencia_pago','observaciones_pago','factura_asociada_id'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='comprobantes' AND column_name=c) THEN
      faltan := faltan || ' comprobantes.' || c;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='retenciones') THEN
    faltan := faltan || ' tabla:retenciones';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='retenciones_comprobante_tipo_key') THEN
    faltan := faltan || ' constraint:retenciones_comprobante_tipo_key';
  END IF;

  IF faltan = '' THEN
    RAISE NOTICE '=== RECONCILIACION OK — el schema coincide con lo que espera el codigo ===';
  ELSE
    RAISE WARNING '=== FALTAN: % ===', faltan;
  END IF;
END $$;
