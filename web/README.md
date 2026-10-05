# Diego OS · web

La app del diseño "Diego OS" (Hoy · Universidad · Salud · Finanzas · Trabajo · Personal),
hecha con Next.js 16 y Supabase. Vive en `web/` junto al dashboard de Streamlit, que sigue
funcionando igual.

## Estado por fases

| Fase | Qué | Estado |
|---|---|---|
| 1 | Diseño completo, login, tareas/objetivos/recordatorios guardados en Supabase | ✅ |
| 2 | Salud completa: Garmin en vivo, "Registrar peso" (escribe en Garmin), recuperación (HRV, estado de entrenamiento, sueño por fases), creatina y fotos de progreso | ✅ (página en claude.ai) |
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

## Página privada en claude.ai (se actualiza sola)

`npm run standalone` también genera `diego-os.page.html`, la versión para publicar como
página privada en claude.ai:

- **Garmin en vivo:** al abrirla, lee tus datos con tu propio conector "Garmin
  connection" (5 herramientas de solo lectura: resumen del día, pesajes, pasos/calorías,
  actividades y sueño). No guarda ninguna foto dentro del archivo.
- **Google Calendar en vivo:** lee tus eventos de los próximos 7 días con el conector
  "Google Calendar" (solo `list_events`, lectura). Aparecen en "Esta semana", en la tarjeta
  "Hoy en tu calendario" y en el resumen de arriba; cada evento abre en Google Calendar.
  Lee 3 semanas y manda a **Deadlines FIU** (y a "Próximas entregas" en Universidad) los
  eventos que son entregas o exámenes: los que no se repiten y traen el curso de Canvas
  entre corchetes (`… [Database Applications]`) o una palabra como exam, quiz, project,
  assignment, lab o entrega. Las clases (eventos que se repiten) no entran.
- **Salud:** además de lo anterior, "Registrar peso" guarda el pesaje en Garmin
  (`add_weigh_in`, única escritura de la página, siempre tras confirmar), una fila de
  Recuperación (HRV de 14 noches vs. media de 7 días, estado de entrenamiento y carga,
  sueño por fases), creatina (un toque al día, racha) y fotos de progreso (se reducen a
  JPEG de hasta 1600 px y se guardan en la página).
- **Tareas sincronizadas:** tareas, objetivos y recordatorios viven en la base de datos de
  la página, así que se ven igual en el celular y en la compu.
- Si Garmin falla, la página explica cómo arreglarlo (reconectar, dar permiso…) y no
  muestra números de ejemplo como si fueran tuyos.
- La meta de peso está en `lib/health.ts` (`HEALTH_GOAL`) y se compara contra la
  tendencia de 7 días.

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
