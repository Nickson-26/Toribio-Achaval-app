-- ============================================================
-- SISTEMA DE USUARIOS — Ejecutar en Supabase SQL Editor
-- ============================================================

-- Tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS usuarios (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email     TEXT NOT NULL,
  nombre    TEXT NOT NULL,
  role      TEXT NOT NULL DEFAULT 'viewer'
            CHECK (role IN ('admin','editor','viewer')),
  aprobado  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Política: cada usuario puede ver su propio perfil
CREATE POLICY "usuarios_self_read" ON usuarios
  FOR SELECT USING (auth.uid() = id);

-- Política: admins pueden ver todos
CREATE POLICY "usuarios_admin_read" ON usuarios
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'admin')
  );

-- Política: admins pueden actualizar cualquier usuario
CREATE POLICY "usuarios_admin_update" ON usuarios
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'admin')
  );

-- Política: admins pueden eliminar usuarios
CREATE POLICY "usuarios_admin_delete" ON usuarios
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'admin')
  );

-- Política: cualquier usuario autenticado puede insertar su propio perfil al registrarse
CREATE POLICY "usuarios_self_insert" ON usuarios
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- DESPUES DE EJECUTAR ESTO:
-- 1. Ir a Authentication → Users → Add user
-- 2. Crear tu usuario admin con email y contraseña
-- 3. Copiar el UUID del usuario creado
-- 4. Ejecutar el INSERT de abajo reemplazando el UUID y datos
-- ============================================================

-- REEMPLAZAR 'TU-UUID-AQUI', 'tu@email.com' y 'Tu Nombre'
-- INSERT INTO usuarios (id, email, nombre, role, aprobado)
-- VALUES ('TU-UUID-AQUI', 'tu@email.com', 'Tu Nombre', 'admin', true);
