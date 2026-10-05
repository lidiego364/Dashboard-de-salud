# Diego OS · web

La app del diseño "Diego OS" (Hoy · Universidad · Salud · Finanzas · Trabajo · Personal),
hecha con Next.js 16 y Supabase. Vive en `web/` junto al dashboard de Streamlit, que sigue
funcionando igual.

## Estado por fases

| Fase | Qué | Estado |
|---|---|---|
| 1 | Diseño completo, login, tareas/objetivos/recordatorios guardados en Supabase | ✅ |
| 2 | Salud con datos reales de Garmin (`garmin_sync.py` → Supabase) | pendiente |
| 3 | Universidad: Canvas + subir syllabus/screenshot (Claude extrae deadlines) | pendiente |
| 4 | Finanzas: PocketSmith o CSV del banco | pendiente |
| 5 | Calendario de Google y notificaciones | pendiente |

Lo que aún no tiene fuente real se muestra con la etiqueta **“ejemplo · fase N”**.

## Versión de un solo archivo (`diego-os.html`)

`npm run standalone` genera en la raíz del repo **`diego-os.html`**: la app entera en un archivo, sin servidor,
sin Supabase y sin instalar nada. Ábrelo con doble clic en el navegador.

- Los datos se guardan **en ese navegador** (localStorage). Otro navegador u otro
  dispositivo empieza vacío.
- Usa los botones de la cabecera para **descargar un respaldo** (.json) y para
  **importarlo** en otro navegador. Si borras los datos del navegador, se pierde lo que
  no hayas respaldado.
- Para regenerarlo después de cambiar el código: `cd web && npm run standalone`.
- **Datos de Garmin:** si existe `web/standalone/garmin-snapshot.json`, se incrustan en
  el HTML y la pestaña Salud muestra tus datos reales (peso, tendencia, pasos, sueño,
  FC en reposo, Body Battery, entrenamientos). Ese JSON y el HTML generado están en
  `.gitignore`: **nunca se suben al repo** porque son datos de salud personales.
  El formato está en `lib/health.ts` (`GarminSnapshot`).

## Probar en local

```bash
cd web
npm install
npm run dev          # http://localhost:3000
```

Sin variables de entorno corre en **modo demo**: sin login y guardando todo en el
navegador (localStorage), con las tareas del prototipo precargadas.

## Poner en marcha con Supabase (una sola vez)

1. Crea un proyecto en [supabase.com](https://supabase.com) (plan gratis).
2. **SQL Editor** → pega el contenido de
   [`supabase/migrations/20261005000000_fase1_tareas.sql`](../supabase/migrations/20261005000000_fase1_tareas.sql) → **Run**.
3. **Authentication → Users → Add user → Create new user**: tu correo + contraseña,
   marcando *Auto Confirm User*.
4. **Authentication → Sign In / Providers**: desactiva **Allow new users to sign up**
   para que nadie más pueda crear cuenta.
5. **Project Settings → API Keys**: copia la *Project URL* y la *Publishable key*.
6. En local: `cp .env.example .env.local` y pega ambos valores.

La primera vez que entres la cuenta estará vacía: el botón **Cargar ejemplo** mete las
tareas del prototipo para que tengas algo con qué jugar (bórralas cuando quieras).

## Publicar en Vercel

1. [vercel.com/new](https://vercel.com/new) → importa `lidiego364/Dashboard-de-salud`.
2. **Root Directory**: `web`.
3. **Environment Variables**: `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Deploy. En el iPhone: abre la URL en Safari → Compartir → **Agregar a inicio**.

## Cómo está armado

- `app/(app)/` — una página por pestaña; `app/login/` — inicio de sesión.
- `proxy.ts` — refresca la sesión de Supabase y manda a `/login` si no hay sesión.
- `components/DataProvider.tsx` — carga tareas, objetivos y recordatorios y aplica
  los cambios al instante (se revierten si Supabase falla).
- `lib/store.ts` — dos backends con la misma interfaz: Supabase o localStorage (demo).
- `lib/demo.ts` — datos estáticos del prototipo que se irán reemplazando por fase.
- `app/globals.css` — tokens y clases del design system del prototipo.
- Fechas siempre en la zona horaria de Miami (`lib/dates.ts`).
