# Conectar la app Fuerza con ChatGPT (y Claude)

La app copia tus entrenamientos a un **repositorio privado tuyo de GitHub**. ChatGPT lee ese resumen y, cuando le dices que sí, deja propuestas de cambios al plan. Las propuestas te aparecen en la app y solo se aplican si tocas **Aplicar**.

```
App Fuerza ──(resumen + copia)──▶ repo privado fuerza-datos ◀──(lee / propone)── tu GPT de ChatGPT
     ▲                                     │
     └───────── propuestas: Aplicar / Descartar ◀┘
```

- Se sube: plan, sesiones (pesos, reps, RPE), peso corporal, medidas y el texto del último análisis de fotos.
- **No se sube**: las fotos, tu clave de Anthropic ni el token de GitHub.
- Necesitas **ChatGPT Plus (o superior)** para crear un GPT propio con acciones.
- Usa la app desde **https://lidiego364.github.io/Dashboard-de-salud/**: la versión del enlace de claude.ai no puede conectarse a GitHub.

---

## 1. Crea el repositorio privado (1 minuto)

1. Entra en **https://github.com/new**.
2. Nombre: `fuerza-datos`.
3. Marca **Private**.
4. Marca **Add a README file**.
5. Pulsa **Create repository**.

## 2. Crea el token para la app

1. Entra en **https://github.com/settings/personal-access-tokens/new**.
2. Nombre: `Fuerza app`. Caducidad: la que quieras (por ejemplo, 1 año).
3. **Repository access** → **Only select repositories** → elige `fuerza-datos`.
4. **Permissions** → **Repository permissions**:
   - **Contents**: Read and write
   - **Issues**: Read and write
5. **Generate token** y copia el texto que empieza por `github_pat_…`. Solo se muestra una vez.

## 3. Conecta la app

1. Abre la app en **https://lidiego364.github.io/Dashboard-de-salud/**.
2. Toca tu inicial (arriba a la derecha) → baja hasta **CONEXIÓN CON CHATGPT Y CLAUDE**.
3. Repositorio: `lidiego364/fuerza-datos`. Token: pega el `github_pat_…`.
4. Toca **Sincronizar ahora**. Debe decir **✓ Sincronizado … · resumen en el issue #1**.

A partir de aquí la app se sincroniza sola al terminar un entrenamiento, al guardar peso o medidas, al editar rutinas y al abrirla.

> ¿Tus datos están en el enlace de claude.ai? Allí: Ajustes → **Exportar**. En el enlace de GitHub Pages: Ajustes → **Importar** ese archivo. Después sincroniza.

## 4. Crea el token para ChatGPT

Repite el paso 2 con nombre `Fuerza ChatGPT` y **solo Issues: Read and write** (no hace falta Contents). Así puedes revocar el acceso de ChatGPT sin desconectar la app.

## 5. Crea tu GPT

1. En ChatGPT: **Explorar GPTs** → **Crear** → pestaña **Configurar**.
2. **Nombre**: `Entrenador Fuerza`.
3. **Instrucciones**: pega todo el contenido de [`instrucciones.md`](instrucciones.md).
4. Abajo, **Acciones** → **Crear nueva acción**:
   - **Autenticación** → **Clave de API** → tipo **Bearer** → pega el token del paso 4.
   - **Esquema**: pega todo el contenido de [`openapi.json`](openapi.json).
   - Si tu repositorio no se llama `lidiego364/fuerza-datos` o la app dice un número de issue distinto de `#1`, cámbialo en las rutas del esquema.
5. **Guardar** → compartir con **Solo yo**.

## 6. Úsalo

Pregúntale cosas como:

- "¿Cómo voy esta semana?"
- "¿Estoy progresando en press banca?"
- "Tengo la espalda cargada, ¿qué cambio el jueves?"
- "Súbeme el volumen de hombro sin pasar de 25 series el viernes."

La primera vez ChatGPT te pedirá permiso para llamar a `api.github.com`: acepta. Cuando proponga cambios y le digas que sí, abre la app: verás la tarjeta **Cambios propuestos por tu entrenador IA** con **Aplicar** y **Descartar**. La app responde en el issue para que ChatGPT sepa qué hiciste.

## Claude

Dile a Claude en el chat "lee mi repo fuerza-datos": puede leer el mismo resumen y proponer cambios con el mismo formato.

## Seguridad

- Revoca un token cuando quieras en **https://github.com/settings/personal-access-tokens**. Si revocas el de la app, la app deja de sincronizar (tus datos siguen en el teléfono).
- La app se niega a sincronizar con un repositorio público.
- **Restaurar de GitHub** (en Ajustes) reemplaza los datos del teléfono por la copia de `datos.json`: úsalo para pasar tus datos a otro teléfono.
- Si se publica una versión nueva del programa (cuando Claude cambia `programa.js`), las rutinas del teléfono se reemplazan por las del programa. Pide a Claude que incluya los cambios que aplicaste desde ChatGPT.
