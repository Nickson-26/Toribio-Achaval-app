-- ============================================================
-- TORIBIO ACHAVAL — Correcciones Enterprise
-- Ejecutar en Supabase SQL Editor en orden
-- ============================================================

-- ── 1. HABILITAR RLS EN TODAS LAS TABLAS ─────────────────────
ALTER TABLE public.comprobantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recibos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas     ENABLE ROW LEVEL SECURITY;

-- Revocar acceso anónimo
REVOKE ALL ON public.comprobantes FROM anon;
REVOKE ALL ON public.recibos      FROM anon;
REVOKE ALL ON public.reservas     FROM anon;

-- ── 2. POLÍTICAS RLS — USUARIOS ──────────────────────────────
DROP POLICY IF EXISTS "usuarios_self_read"   ON usuarios;
DROP POLICY IF EXISTS "usuarios_admin_read"  ON usuarios;
DROP POLICY IF EXISTS "usuarios_admin_update" ON usuarios;
DROP POLICY IF EXISTS "usuarios_admin_delete" ON usuarios;
DROP POLICY IF EXISTS "usuarios_self_insert" ON usuarios;

-- Función helper para obtener rol (evita recursión en políticas)
CREATE OR REPLACE FUNCTION public.get_user_role(uid UUID)
RETURNS TEXT AS $$
  SELECT role FROM public.usuarios WHERE id = uid LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Cada usuario ve su propio perfil
CREATE POLICY "self_read" ON usuarios
  FOR SELECT USING (auth.uid() = id);

-- Admins ven todos
CREATE POLICY "admin_read" ON usuarios
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'admin');

-- Admins modifican todos (excepto a sí mismos para evitar lock-out)
CREATE POLICY "admin_update" ON usuarios
  FOR UPDATE USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "admin_delete" ON usuarios
  FOR DELETE USING (
    public.get_user_role(auth.uid()) = 'admin'
    AND id != auth.uid()  -- No puede eliminarse a sí mismo
  );

-- Insert solo del propio perfil (registro)
CREATE POLICY "self_insert" ON usuarios
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ── 3. POLÍTICAS RLS — COMPROBANTES ──────────────────────────
DROP POLICY IF EXISTS "auth_read"     ON comprobantes;
DROP POLICY IF EXISTS "editor_write"  ON comprobantes;

-- Cualquier autenticado y aprobado puede leer
CREATE POLICY "authenticated_read" ON comprobantes
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND aprobado = true)
  );

-- Solo editors/admins pueden escribir
CREATE POLICY "editor_insert" ON comprobantes
  FOR INSERT TO authenticated WITH CHECK (
    public.get_user_role(auth.uid()) IN ('admin','editor')
  );

CREATE POLICY "editor_update" ON comprobantes
  FOR UPDATE TO authenticated USING (
    public.get_user_role(auth.uid()) IN ('admin','editor')
  );

-- Solo admins pueden eliminar/anular
CREATE POLICY "admin_delete" ON comprobantes
  FOR DELETE TO authenticated USING (
    public.get_user_role(auth.uid()) = 'admin'
  );

-- ── 4. POLÍTICAS RLS — RECIBOS ───────────────────────────────
CREATE POLICY "authenticated_read" ON recibos
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND aprobado = true)
  );

CREATE POLICY "editor_write" ON recibos
  FOR ALL TO authenticated USING (
    public.get_user_role(auth.uid()) IN ('admin','editor')
  );

-- ── 5. POLÍTICAS RLS — RESERVAS ──────────────────────────────
CREATE POLICY "authenticated_read" ON reservas
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND aprobado = true)
  );

CREATE POLICY "editor_write" ON reservas
  FOR ALL TO authenticated USING (
    public.get_user_role(auth.uid()) IN ('admin','editor')
  );

-- ── 6. INTEGRIDAD REFERENCIAL ─────────────────────────────────
-- FK entre comprobantes y recibos
ALTER TABLE comprobantes
  DROP CONSTRAINT IF EXISTS fk_recibo;
ALTER TABLE comprobantes
  ADD CONSTRAINT fk_recibo
  FOREIGN KEY (recibo_id) REFERENCES recibos(id) ON DELETE SET NULL DEFERRABLE;

-- Constraint: neto + iva = monto (solo cuando todos están presentes)
ALTER TABLE comprobantes
  DROP CONSTRAINT IF EXISTS chk_montos_coherentes;
ALTER TABLE comprobantes ADD CONSTRAINT chk_montos_coherentes CHECK (
  (neto_ars IS NULL OR iva IS NULL OR monto_ars IS NULL)
  OR ABS(neto_ars + iva - monto_ars) < 1
);

-- ── 7. ÍNDICES ADICIONALES ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_comp_numero     ON comprobantes(numero DESC);
CREATE INDEX IF NOT EXISTS idx_comp_tipo_num   ON comprobantes(tipo, numero DESC);
CREATE INDEX IF NOT EXISTS idx_comp_cliente_up ON comprobantes(UPPER(cliente));
CREATE INDEX IF NOT EXISTS idx_reservas_broker ON reservas(broker);
CREATE INDEX IF NOT EXISTS idx_reservas_op     ON reservas(operacion);
CREATE INDEX IF NOT EXISTS idx_usuarios_email  ON usuarios(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_usuarios_aprobado ON usuarios(aprobado) WHERE aprobado = false;

-- ── 8. TABLA DE AUDIT LOG ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tabla        TEXT NOT NULL,
  registro_id  TEXT NOT NULL,
  accion       TEXT NOT NULL CHECK (accion IN ('INSERT','UPDATE','DELETE')),
  usuario_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_email TEXT,
  datos_antes  JSONB,
  datos_despues JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_tabla    ON audit_log(tabla, created_at DESC);
CREATE INDEX idx_audit_usuario  ON audit_log(usuario_id, created_at DESC);
CREATE INDEX idx_audit_registro ON audit_log(registro_id);

-- Solo admins pueden leer el audit log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only" ON audit_log
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'admin');

-- Trigger de auditoría para comprobantes
CREATE OR REPLACE FUNCTION public.audit_comprobantes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_log (tabla, registro_id, accion, usuario_id, usuario_email, datos_antes, datos_despues)
  VALUES (
    'comprobantes',
    COALESCE(NEW.id::TEXT, OLD.id::TEXT),
    TG_OP,
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN row_to_json(OLD)::JSONB ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW)::JSONB ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_audit_comprobantes ON comprobantes;
CREATE TRIGGER trg_audit_comprobantes
  AFTER INSERT OR UPDATE OR DELETE ON comprobantes
  FOR EACH ROW EXECUTE FUNCTION public.audit_comprobantes();

-- ── 9. TRIGGER DE USUARIO CORREGIDO ──────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.usuarios (id, email, nombre, role, aprobado)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
      'viewer',
      false
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();

-- ── 10. CONSTRAINT EMAIL DOMINIO ─────────────────────────────
ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS chk_email_dominio;
ALTER TABLE usuarios
  ADD CONSTRAINT chk_email_dominio
  CHECK (email LIKE '%@toribioachaval.com');
