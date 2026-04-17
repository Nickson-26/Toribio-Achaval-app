# Guía de Deploy — Toribio Achaval Facturación
## Supabase (base de datos) + Vercel (hosting) · Sin casi terminal

---

## RESUMEN DEL PLAN

```
Tu computadora
  └── código fuente (esta carpeta)
        ↓  subís a GitHub (gratis)
              ↓  Vercel lo detecta y publica online
                    ↓  la app conecta con Supabase (base de datos)
```

Tiempo estimado: 30–40 minutos la primera vez.

---

## PASO 1 · Crear cuenta en Supabase (base de datos gratuita)

1. Ir a **https://supabase.com** → click en **Start your project**
2. Registrarte con Google o email
3. Click en **New project**
4. Completar:
   - **Name:** `toribio-achaval`
   - **Database Password:** creá una contraseña segura y guardala
   - **Region:** South America (São Paulo)
5. Click **Create new project** → esperar ~2 minutos mientras se crea

---

## PASO 2 · Crear las tablas y cargar los datos

1. En tu proyecto de Supabase, ir al menú izquierdo → **SQL Editor**
2. Click en **New query**
3. Abrí el archivo `supabase_schema.sql` de esta carpeta con el Bloc de notas (Windows) o TextEdit (Mac)
4. Seleccioná TODO el contenido (Ctrl+A) y copialo
5. Pegalo en el SQL Editor de Supabase
6. Click en el botón verde **Run** (o Ctrl+Enter)
7. Deberías ver: `Success. No rows returned`

✅ La base de datos ya tiene todas las facturas y recibos del Excel cargados.

---

## PASO 3 · Obtener las claves de Supabase

1. En tu proyecto Supabase → menú izquierdo → **Settings** (ícono de engranaje)
2. Click en **API**
3. Anotar / copiar:
   - **Project URL** → algo como `https://abcdefgh.supabase.co`
   - **anon public** (en la sección "Project API keys")

Las vas a necesitar en el Paso 5.

---

## PASO 4 · Subir el código a GitHub

### 4a. Crear cuenta en GitHub (si no tenés)
Ir a **https://github.com** → Sign up (es gratis)

### 4b. Instalar Git (solo la primera vez)
- **Windows:** descargar de https://git-scm.com/download/win → instalar con todas las opciones por defecto
- **Mac:** abrir Terminal y escribir `git --version` → si no está instalado, Mac te ofrece instalarlo automáticamente

### 4c. Crear el repositorio en GitHub
1. En GitHub → click en el **+** arriba a la derecha → **New repository**
2. Name: `toribio-achaval-facturacion`
3. Dejarlo en **Private** (recomendado)
4. Click **Create repository**
5. GitHub te muestra instrucciones — copiar la URL del repo (algo como `https://github.com/tu-usuario/toribio-achaval-facturacion.git`)

### 4d. Subir el código
Abrí una terminal (Windows: buscar "cmd" o "PowerShell"; Mac: buscar "Terminal").
Navegá a la carpeta del proyecto:

```bash
# Windows — reemplazá con la ruta real
cd C:\Users\TuNombre\Downloads\ta-app

# Mac / Linux
cd ~/Downloads/ta-app
```

Luego ejecutar estos comandos uno por uno:

```bash
git init
git add .
git commit -m "primer deploy"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/toribio-achaval-facturacion.git
git push -u origin main
```

> Si Git te pide usuario y contraseña de GitHub, ingresalos.
> Si no acepta la contraseña, necesitás un "Personal Access Token":
> GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token → marcar "repo" → copiar el token y usarlo como contraseña.

✅ El código ya está en GitHub.

---

## PASO 5 · Deploy en Vercel (hosting gratuito)

1. Ir a **https://vercel.com** → **Sign up** → elegir **Continue with GitHub**
2. Autorizar Vercel a acceder a tu GitHub
3. Click en **Add New Project**
4. Buscar y seleccionar el repo `toribio-achaval-facturacion`
5. Click en **Import**
6. En la sección **Environment Variables** (variables de entorno), agregar:

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://tu-proyecto.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `tu-anon-key` |

   (Los valores los obtuviste en el Paso 3)

7. Click **Deploy**
8. Vercel construye la app (tarda ~2 minutos)
9. Al terminar, te da una URL como: `https://toribio-achaval-facturacion.vercel.app`

✅ ¡La app está online y conectada a la base de datos!

---

## PASO 6 · Configurar dominio (opcional)

Si querés una URL más prolija como `facturacion.toribio-achaval.com`:

1. En Vercel → tu proyecto → **Settings** → **Domains**
2. Agregar tu dominio
3. Vercel te indica qué registros DNS configurar en tu proveedor de dominio

---

## ACTUALIZAR LA APP en el futuro

Cada vez que quieras cambiar algo en el código:

```bash
cd ta-app
git add .
git commit -m "descripción del cambio"
git push
```

Vercel detecta el push automáticamente y redeploya en ~1 minuto.

---

## SOLUCIÓN DE PROBLEMAS COMUNES

### "Error: supabase not configured"
→ Verificar que las variables de entorno en Vercel estén bien escritas (sin espacios extra).

### "git push" pide contraseña y no acepta
→ Usar Personal Access Token como se describe en el Paso 4d.

### La app carga pero no muestra datos
→ Verificar en Supabase → Table Editor que las tablas `comprobantes` y `recibos` tienen datos.

### "Build failed" en Vercel
→ Ir a Vercel → tu proyecto → pestaña **Deployments** → click en el deploy fallido → ver los logs de error y compartirlos para ayuda.

---

## SEGURIDAD (recomendado antes de usar en producción)

Por defecto Supabase tiene las tablas abiertas (cualquiera con la anon key puede leer/escribir).
Para restringir el acceso solo a usuarios autenticados, ir a:

Supabase → Authentication → Policies

Y agregar políticas Row Level Security. Si necesitás configurar login con usuario/contraseña para la app, avisame y lo agrego.

---

## CONTACTO / PRÓXIMOS PASOS

Una vez deployada, posibles mejoras:
- Login con usuario y contraseña
- Generación de PDF de facturas
- Envío de facturas por email
- Múltiples usuarios con distintos roles
- Importación masiva desde Excel
