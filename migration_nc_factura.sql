-- Add factura_asociada_id to comprobantes
-- Run this in Supabase SQL Editor
ALTER TABLE comprobantes
  ADD COLUMN IF NOT EXISTS factura_asociada_id TEXT REFERENCES comprobantes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comp_factura_asociada ON comprobantes(factura_asociada_id);
