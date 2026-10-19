# Fuerza

App web (PWA) para registrar el entrenamiento de fuerza desde el móvil. Funciona sin conexión y se instala en la pantalla de inicio.

## Pantallas

- **Hoy**: rutina del día según el día de la semana, racha semanal, series de la semana frente a las planificadas, RPE medio, avisos de semana de descarga y de "toca descarga" (RPE medio > 9.3 dos semanas seguidas), y recuperación por grupo muscular.
- **Entrenamiento**: dos vistas, *Enfoque* (una serie a la vez con botones grandes) y *Por ejercicio* (tabla con peso, reps y RPE). Muestra calentamiento, series de aproximación del primer ejercicio, la marca anterior, temporizador de descanso con aviso sonoro y vibración, avisos de techo de RPE y cambio de ejercicio por sus alternativas.
- **Resumen**: volumen, series, duración, RPE medio, récords, minutos de cardio y peso corporal.
- **Rutinas**: ver, editar, crear y empezar rutinas.
- **Progreso**: peso con tendencia y meta, fotos privadas con comparador antes/después y fuerza por ejercicio (1RM estimado, mejores marcas y series por grupo muscular).

## Entrenador

[`coach.js`](coach.js) decide la carga, las repeticiones y el RPE de cada serie con las reglas del programa, sin conexión:

- **Doble progresión**: con el rango alto completo en todas las series, sin pasar el techo de RPE, sube la carga (+2.5 kg tren superior, +5 kg tren inferior) y vuelve al rango bajo. Si no, mantiene el peso y pide una repetición más por serie.
- **Demasiado duro**: si la última sesión pasó el techo de RPE, baja la carga.
- **Demasiado fácil**: si la última sesión quedó 1.5 puntos o más por debajo del objetivo, sube antes de tiempo.
- **Estancamiento**: dos sesiones sin llegar al rango bajo → −10 %.
- **En vivo**: si una serie sale un punto de RPE o más por encima del objetivo, baja las siguientes; si sobra mucho, las sube. Si cambias el peso de una serie a mano, esa serie se respeta.
- **Estado del día**: antes de empezar pregunta sueño, energía y dolor. En amarillo apunta medio punto de RPE por debajo; en rojo, además, −5 % de carga.
- Redondea a cargas reales: mancuernas de 2 en 2 y barra, máquina y polea de 2.5 en 2.5.
- Al terminar, propone la carga de la próxima sesión.

Pruebas: `node --test tests/fuerza_coach.test.js`.

## Medidas y análisis de fotos con IA

- **Medidas** (Progreso → Medidas): cintura, cuello, pecho, hombros, brazo, muslo y cadera, en cm o pulgadas. Con altura y sexo (Ajustes) estima el % de grasa con la fórmula de la Marina de EE. UU. y, con el último peso, la masa magra y la grasa en kilos, además de la relación cintura/altura.
- **Análisis de fotos** (Progreso → Fotos): [`cuerpo.js`](cuerpo.js) envía a Claude (`claude-opus-5-5`) la última foto de cada ángulo y la primera para comparar, junto con medidas, peso y programa, y recibe un análisis estructurado: contextura, rango de grasa estimado, puntos fuertes, zonas a mejorar con sugerencias, postura, cambios y recomendaciones.
  - Usa la clave de API de Anthropic del propio usuario (Ajustes → Análisis de fotos con IA). Se guarda solo en el teléfono y no entra en las copias.
  - Cada análisis cuesta unos céntimos en esa cuenta. Las fotos se envían a Anthropic solo al pulsar *Analizar*.
  - El SDK oficial va empaquetado en [`vendor/`](vendor/README.md) y solo se carga al analizar.

## Importar historial de StrengthLab

En Ajustes → *Importar* (o en Progreso → Fuerza, si aún no hay historial) elige el CSV exportado de StrengthLab (`progreso-strengthlab-*.csv`). [`importar.js`](importar.js):

- Usa el peso ya convertido a kg y corrige las series con la unidad mal marcada (por ejemplo "14 kg" en un ejercicio que siempre va en "14 lb").
- Traduce entrenamientos y ejercicios a los del programa por nombre, por `alias` (en `programa.js`) o, para la rutina, por día de la semana.
- Añade las sesiones sin borrar nada, y reimportar el mismo archivo no duplica.
- Si casi todo está en libras, cambia la app a lb. El entrenador entonces trabaja con saltos de libras: barra y Smith de 5 en 5, barra Z, poleas y máquinas de 2.5 en 2.5, y mancuernas de 2 en 2.

El historial nunca sale del teléfono: el CSV se lee en el navegador.

## Conexión con ChatGPT y Claude

Opcional. En Ajustes → *Conexión con ChatGPT y Claude*, con un repositorio **privado** de GitHub y un token de acceso fino, [`nube.js`](nube.js):

- Escribe un resumen en markdown (perfil, plan con la próxima sesión sugerida, tendencias, sesiones de las últimas semanas, peso, medidas y último análisis) en el cuerpo del issue *Fuerza · Entrenador IA*, y una copia completa sin fotos en `datos.json`.
- Lee los comentarios de ese issue: un bloque ```` ```fuerza ```` con `{ "motivo", "cambios": [...] }` aparece en *Hoy* como propuesta. Al aplicarla o descartarla, la app responde en el issue.
- Se sincroniza al terminar un entrenamiento, al guardar peso, medidas o rutinas y al abrir la app. Se niega a usar un repositorio público. El token no entra en las copias.

Guía para crear el GPT de ChatGPT: [`chatgpt/README.md`](../chatgpt/README.md).

## Programa

Las rutinas se definen en [`programa.js`](programa.js). Para cargar un programa nuevo, edítalo y **sube `version`**: la app reemplaza las rutinas y conserva el historial, el peso y las fotos.

## Datos

Todo se guarda en el propio dispositivo: `localStorage` para los registros e IndexedDB para las fotos. Internamente se usan kg, así que alternar kg/lb no mezcla unidades. Desde Ajustes (toca tu inicial en *Hoy*) puedes exportar o importar una copia JSON.

## Publicación

Cada push a `main` que toque `fuerza/` la publica en GitHub Pages con el workflow [`pages-fuerza.yml`](../.github/workflows/pages-fuerza.yml):

**https://lidiego364.github.io/Dashboard-de-salud/**

En el iPhone ábrela en Safari → Compartir → *Añadir a pantalla de inicio*. En Android, Chrome → menú → *Instalar app*. Las actualizaciones llegan solas: la app usa la versión guardada y descarga la nueva en segundo plano para la siguiente apertura.

Solo se publica esta carpeta. Tus registros nunca salen del teléfono.

## Probar en local

```sh
cd fuerza
python3 -m http.server 8000
# abre http://localhost:8000
```
