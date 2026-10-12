# Fuerza

App web (PWA) para registrar el entrenamiento de fuerza desde el móvil. Funciona sin conexión y se instala en la pantalla de inicio.

## Pantallas

- **Hoy**: rutina del día según el día de la semana, racha semanal, series de la semana frente a las planificadas, RPE medio, avisos de semana de descarga y de "toca descarga" (RPE medio > 9.3 dos semanas seguidas), y recuperación por grupo muscular.
- **Entrenamiento**: dos vistas, *Enfoque* (una serie a la vez con botones grandes) y *Por ejercicio* (tabla con peso, reps y RPE). Muestra calentamiento, series de aproximación del primer ejercicio, la marca anterior, temporizador de descanso con aviso sonoro y vibración, avisos de techo de RPE y cambio de ejercicio por sus alternativas.
- **Resumen**: volumen, series, duración, RPE medio, récords, minutos de cardio y peso corporal.
- **Rutinas**: ver, editar, crear y empezar rutinas.
- **Progreso**: peso con tendencia y meta, fotos privadas con comparador antes/después y fuerza por ejercicio (1RM estimado, mejores marcas y series por grupo muscular).

## Programa

Las rutinas se definen en [`programa.js`](programa.js). Para cargar un programa nuevo, edítalo y **sube `version`**: la app reemplaza las rutinas y conserva el historial, el peso y las fotos.

## Datos

Todo se guarda en el propio dispositivo: `localStorage` para los registros e IndexedDB para las fotos. Internamente se usan kg, así que alternar kg/lb no mezcla unidades. Desde Ajustes (toca tu inicial en *Hoy*) puedes exportar o importar una copia JSON.

## Probar en local

```sh
cd fuerza
python3 -m http.server 8000
# abre http://localhost:8000
```

Para usarla en el móvil hay que servirla por HTTPS (p. ej. GitHub Pages) y elegir "Añadir a pantalla de inicio".
