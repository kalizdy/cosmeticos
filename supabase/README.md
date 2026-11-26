# Supabase · BIM Cosmetics

La app ya está conectada por REST a:

- URL: `https://depkvzlbomyzaopjiulk.supabase.co/rest/v1/`
- Tabla: `bim_cloud`
- Fila única: `main`
- Clave publishable: `sb_publishable_...` (pública; los permisos se controlan con RLS)

## Paso obligatorio (una vez)

La clave publishable **no puede crear tablas por seguridad**. Entra al panel de Supabase:

1. Abre el SQL Editor: https://supabase.com/dashboard/project/depkvzlbomyzaopjiulk/sql/new
2. Pega y ejecuta el contenido de `supabase/schema.sql`.
3. Vuelve a la app y pulsa el botón de nube ☁ del encabezado. También puedes pulsar el icono ⚙ para abrir directamente el SQL Editor.

Si la tabla no existe, el botón muestra ⚙ y el título «Falta la tabla bim_cloud».

## Cómo funciona

- El catálogo, movimientos, bitácora y contactos se guardan primero en `localStorage` (offline-first).
- Cada cambio dispara un guardado en Supabase con `POST /rest/v1/bim_cloud?on_conflict=id`.
- Al abrir la app se lee la fila `main`; si el snapshot remoto es más nuevo, se importa; si el local es más nuevo, se sube.
- El botón ☁ fuerza una sincronización manual (subir/bajar según `savedAt`).
- La tabla usa RLS con acceso para `anon` a la fila `main`. Para un proyecto real conviene autenticación y políticas por usuario.
