-- ============================================================
-- Migración: PDF en comprobantes + Storage bucket
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Agregar columna pdf_url a comprobantes
--    Guarda el PATH dentro del bucket (ej: "FC-A-4090.pdf")
ALTER TABLE comprobantes
  ADD COLUMN IF NOT EXISTS pdf_url TEXT;

COMMENT ON COLUMN comprobantes.pdf_url IS
  'Path en Supabase Storage bucket comprobantes-pdfs. Ej: FC-A-4090.pdf';


-- ============================================================
-- 2. Crear bucket de Storage para PDFs
--    (también podés hacerlo desde Dashboard → Storage → New bucket)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comprobantes-pdfs',
  'comprobantes-pdfs',
  false,                          -- privado: URLs firmadas para acceder
  10485760,                       -- 10 MB máximo por archivo
  ARRAY['application/pdf']        -- solo PDFs
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 3. RLS Policies para el bucket comprobantes-pdfs
-- ============================================================

-- Usuarios autenticados pueden subir PDFs
CREATE POLICY "Authenticated can upload comprobante PDFs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'comprobantes-pdfs');

-- Usuarios autenticados pueden ver/leer PDFs
CREATE POLICY "Authenticated can view comprobante PDFs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'comprobantes-pdfs');

-- Usuarios autenticados pueden reemplazar PDFs existentes
CREATE POLICY "Authenticated can update comprobante PDFs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'comprobantes-pdfs');


-- ============================================================
-- NOTA: La tabla recibo_comprobantes ya debe existir.
-- Si no existe aún, crearla con:
-- ============================================================
/*
CREATE TABLE IF NOT EXISTS recibo_comprobantes (
  id             SERIAL PRIMARY KEY,
  recibo_id      INTEGER NOT NULL REFERENCES recibos(id) ON DELETE CASCADE,
  comprobante_id TEXT    NOT NULL REFERENCES comprobantes(id),
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recibo_id, comprobante_id)
);

CREATE INDEX IF NOT EXISTS idx_rc_recibo_id      ON recibo_comprobantes(recibo_id);
CREATE INDEX IF NOT EXISTS idx_rc_comprobante_id ON recibo_comprobantes(comprobante_id);

-- RLS
ALTER TABLE recibo_comprobantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access on recibo_comprobantes"
  ON recibo_comprobantes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
*/
