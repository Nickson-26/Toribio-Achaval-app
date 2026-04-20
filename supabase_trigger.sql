-- ============================================================
-- TRIGGER: Crea perfil automáticamente cuando se registra un usuario
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Función que se ejecuta al crear un nuevo auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.usuarios (id, email, nombre, role, aprobado)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    'viewer',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que llama a la función
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Asegurarse que RLS está desactivado
ALTER TABLE public.usuarios DISABLE ROW LEVEL SECURITY;

-- Dar permisos a service role y anon
GRANT ALL ON public.usuarios TO service_role;
GRANT ALL ON public.usuarios TO authenticated;
GRANT INSERT ON public.usuarios TO anon;
