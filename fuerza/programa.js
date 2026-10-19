// Programa de entrenamiento que carga la app Fuerza.
//
// Para cargar un programa nuevo, edita este archivo y SUBE `version`: la app
// reemplazará sus rutinas guardadas por las de aquí. El historial, el peso y
// las fotos se conservan.
//
// Campos de cada ejercicio:
//   nombre        Nombre visible. Enlaza el historial ("Anterior", récords): mantenlo estable.
//   grupo         Grupo muscular para el volumen semanal y la recuperación.
//   equipo        Barra | Mancuernas | Polea | Máquina | Smith | Peso corporal ...
//   series, reps  Series y objetivo de repeticiones ("6-8", "10-12/pierna").
//   rpe           Objetivo o techo de RPE ("≤ 8.5", "8", "7-8"). Se avisa si se supera.
//   descanso      Segundos entre series.
//   alternativas  Sustituciones disponibles durante el entrenamiento.
//   opcional      true si no cuenta para el volumen planificado.
//   alias         (opcional) Otros nombres del ejercicio (para importar historial).
//   desde         (opcional) Fecha "AAAA-MM-DD" a partir de la que entra en la rutina.
//   notas         Indicaciones técnicas.
window.PROGRAMA_FUERZA = {
  version: 6,
  nombre: 'Programa de fuerza v6',
  objetivo: 'Recomposición en déficit',
  perfil: { nombre: 'Diego', diasSemana: 5 },
  inicio: '2026-10-12',
  fin: '2026-11-30',
  descargas: [], // sin semanas de descarga programadas
  // En semana de descarga: mismos ejercicios y mismo peso, mitad de series (redondeando hacia arriba) y RPE 6.
  descarga: {
    factorSeries: 0.5,
    rpe: '6',
    nota: 'Mismos ejercicios y el mismo peso de la semana pasada (no lo bajes). Mitad de series y RPE 6: te sobran ~4 repeticiones. Puedes acortar 30 s el descanso. Raqueta: 1 sesión, corta.',
    cardio: 'Cinta opcional, 20 min máximo.'
  },
  umbralDescarga: 9.3, // RPE medio semanal que, dos semanas seguidas, dispara una descarga
  extraDescansoRpe: { desde: 9, segundos: 30 }, // si una serie queda en RPE 9+, el siguiente descanso dura 30 s más
  progresion: { superior: 2.5, inferior: 5 }, // doble progresión: kg que se suben al completar el rango alto
  diasLibres: {
    6: { titulo: 'RAQUETA / SURF', nota: 'Raqueta: máximo 3 sesiones por semana y solo una larga (> 90 min).' },
    7: { titulo: 'DESCANSO TOTAL', nota: 'Hoy no se entrena. Recupera.' }
  },
  calentamiento: {
    general: '5 min general: bici, cinta suave o remo',
    movilidad: 'Band pull-apart ×20 · dislocaciones ×10 · extensión torácica ×10',
    aproximacion: 'Descansa 60–90 s entre aproximaciones.'
  },
  cardio: {
    texto: 'Cinta 12% · 3 mph · 20–30 min',
    nota: 'Siempre después de las pesas, sin sujetar el pasamanos, máximo 30 min.'
  },
  reglasDescanso: [
    'Cuenta el descanso con reloj, desde que sueltas la barra hasta la siguiente serie.',
    'No acortes el descanso en los ejercicios 1 y 2: pierdes repeticiones y el RPE se dispara.',
    'Si te falta tiempo, recorta series de accesorios, no descanso de básicos.'
  ],
  rutinas: [
    {
      id: 'lunes-push', duracion: '80–90 min', dia: 1, nombre: 'PUSH', enfoque: 'Pecho, hombro, tríceps',
      nota: 'Superserie posible: elevaciones laterales con extensión en polea.',
      ejercicios: [
        { nombre: 'Press banca en Smith', alias: ['Press banca con barra Smith', 'Press de banca en máquina Smith', 'Press banca en máquina Smith'], grupo: 'Pecho', equipo: 'Smith', series: 4, reps: '5-7', rpe: '≤ 8.5', descanso: 180, alternativas: ['Press banca con barra', 'Press banca con mancuernas', 'Press de pecho en máquina'], notas: 'Nunca al fallo en básicos.' },
        { nombre: 'Press militar con mancuernas sentado', alias: ['Press militar sentado con mancuernas'], grupo: 'Hombro', equipo: 'Mancuernas', series: 3, reps: '6-8', rpe: '≤ 8.5', descanso: 150, alternativas: ['Press militar sentado con barra', 'Press de hombro en máquina', 'Press militar en Smith sentado'] },
        { nombre: 'Press inclinado con mancuernas', grupo: 'Pecho', equipo: 'Mancuernas', series: 3, reps: '8-10', rpe: '8', descanso: 120, alternativas: ['Press inclinado con barra', 'Press inclinado en máquina'] },
        { nombre: 'Pec deck', alias: ['Peck deck', 'Contractor de pecho'], grupo: 'Pecho', equipo: 'Máquina', series: 3, reps: '12-15', rpe: '9', descanso: 75, alternativas: ['Cruce de poleas de abajo hacia arriba', 'Cruce de poleas a media altura'] },
        { nombre: 'Elevaciones laterales', grupo: 'Hombro', equipo: 'Mancuernas', series: 4, reps: '12-15', rpe: '9', descanso: 60, alternativas: ['Elevaciones laterales en polea', 'Elevaciones laterales en máquina'] },
        { nombre: 'Extensión de tríceps sobre la cabeza en polea', grupo: 'Tríceps', equipo: 'Polea', series: 3, reps: '10-12', rpe: '9', descanso: 75, alternativas: ['Press francés con barra Z', 'Extensión sobre la cabeza con mancuerna'], notas: 'Enfocado en la cabeza larga.' },
        { nombre: 'Extensión en polea con cuerda', alias: ['Extensión de tríceps en polea con cuerda'], grupo: 'Tríceps', equipo: 'Polea', series: 3, reps: '12-15', rpe: '9', descanso: 60, alternativas: ['Extensión en polea con barra recta', 'Extensión de tríceps en máquina'], notas: 'Si recortas, es de lo primero que se quita.' },
        { nombre: 'Face pull ligero', grupo: 'Deltoide posterior', equipo: 'Polea', series: 2, reps: '18-20', rpe: '6-7', descanso: 45, opcional: true, notas: 'Opcional del bloque de espalda alta.' }
      ]
    },
    {
      id: 'martes-pull', duracion: '60–70 min', dia: 2, nombre: 'PULL', enfoque: 'Espalda, bíceps, deltoide posterior',
      ejercicios: [
        { nombre: 'Remo Hammer', alias: ['Remo en máquina Hammer'], grupo: 'Espalda', equipo: 'Máquina', series: 4, reps: '6-8', rpe: '≤ 8.5', descanso: 180, alternativas: ['Remo Hammer en polea', 'Remo con barra inclinado', 'Remo con apoyo de pecho'] },
        { nombre: 'Jalón al pecho', alias: ['Dominadas', 'Dominadas (lastradas o asistidas)'], grupo: 'Espalda', equipo: 'Máquina de jalón', series: 4, reps: '6-8', rpe: '≤ 8.5', descanso: 150, alternativas: ['Dominadas'], notas: 'En la máquina de jalón al pecho: más peso es más difícil.' },
        { nombre: 'Jalón agarre neutro', grupo: 'Espalda', equipo: 'Polea', series: 3, reps: '10-12', rpe: '8', descanso: 120, alternativas: ['Remo sentado en polea'] },
        { nombre: 'Face pull', grupo: 'Deltoide posterior', equipo: 'Polea', series: 3, reps: '15-20', rpe: '8', descanso: 60, alternativas: ['Pájaros en polea', 'Rotación externa con banda'], notas: 'No son opcionales: compensan las sesiones de raqueta.' },
        { nombre: 'Bayesian curl', grupo: 'Bíceps', equipo: 'Polea', series: 3, reps: '10-12', rpe: '9', descanso: 75, alternativas: ['Curl en banco inclinado'], notas: 'Polea lo más baja, paso adelante, brazo detrás del torso, codo fijo, baja hasta estirar. Empieza ligero.' },
        { nombre: 'Curl martillo', grupo: 'Bíceps', equipo: 'Mancuernas', series: 2, reps: '12-15', rpe: '9', descanso: 60, alternativas: ['Curl con cuerda'] }
      ]
    },
    {
      id: 'miercoles-pierna', duracion: '75–85 min', dia: 3, nombre: 'PIERNA + ABDOMEN', alias: ['PIERNA + CORE'], enfoque: 'Cuádriceps, femoral, gemelo, abdomen',
      nota: 'Protege las 26 series. Si algún día no puedes, recorta de abajo hacia arriba (colgado, crunch, extensión), nunca los dos primeros.',
      movilidad: 'Gato-camello ×10 · 90/90 de cadera ×8/lado · tobillo en pared ×10/lado',
      cardioOmitirSiRpe: 8.5,
      cardioNota: 'Suave. Es lo primero que se recorta: omítela si la sentadilla Smith bajó de calidad o la pierna fue dura (RPE > 8.5).',
      ejercicios: [
        { nombre: 'Sentadilla en Smith', alias: ['Sentadilla en máquina Smith'], grupo: 'Cuádriceps', equipo: 'Smith', series: 4, reps: '6-8', rpe: '≤ 8.5', descanso: 180, alternativas: ['Hack squat', 'Pendulum squat'], notas: 'Pies un palmo por delante de la barra, torso vertical.' },
        { nombre: 'Prensa de piernas', grupo: 'Cuádriceps', equipo: 'Máquina', series: 4, reps: '10-12', rpe: '≤ 8.5', descanso: 150, alternativas: ['Prensa horizontal'] },
        { nombre: 'Curl femoral tumbado', grupo: 'Isquios / glúteo', equipo: 'Máquina', series: 4, reps: '10-12', rpe: '8', descanso: 90, alternativas: ['Curl femoral sentado', 'Curl nórdico'] },
        { nombre: 'Sentadilla búlgara con mancuernas', alias: ['Sentadilla búlgara'], grupo: 'Cuádriceps', equipo: 'Mancuernas', series: 3, reps: '10-12/pierna', rpe: '7-8', descanso: 120, alternativas: ['Zancada caminando', 'Step-up'], notas: 'El descanso empieza al terminar ambas piernas.' },
        { nombre: 'Extensión de cuádriceps', grupo: 'Cuádriceps', equipo: 'Máquina', series: 2, reps: '12-15', rpe: '9', descanso: 90, alternativas: ['Sissy squat'] },
        { nombre: 'Elevación de gemelo de pie', grupo: 'Gemelo', equipo: 'Máquina', series: 3, reps: '10-15', rpe: '8-9', descanso: 60, alternativas: ['Gemelo en prensa'] },
        { nombre: 'Crunch en polea', grupo: 'Abdomen', equipo: 'Polea', series: 3, reps: '12-15', rpe: '8', descanso: 60, alternativas: ['Crunch en máquina'], notas: 'Cadera fija, flexiona la columna, codos cerca de la cara.' },
        { nombre: 'Elevación de piernas colgado', grupo: 'Abdomen', equipo: 'Peso corporal', series: 3, reps: '10-15', rpe: '8', descanso: 60, alternativas: ['Reverse crunch'] }
      ]
    },
    {
      id: 'jueves-pecho-espalda', duracion: '70–80 min', dia: 4, nombre: 'PECHO Y ESPALDA', enfoque: 'Pecho, espalda',
      nota: 'Alterna por parejas (1-2, 3-4, 5-6): descansas un patrón mientras trabajas el otro, pero cuenta el descanso completo entre series del mismo ejercicio.',
      ejercicios: [
        { nombre: 'Press inclinado con barra', grupo: 'Pecho', equipo: 'Barra', series: 4, reps: '6-8', rpe: '≤ 8.5', descanso: 180, alternativas: ['Press inclinado con mancuernas'] },
        { nombre: 'Remo en T', alias: ['Remo en T o remo Hammer'], grupo: 'Espalda', equipo: 'Barra T', series: 4, reps: '8-10', rpe: '≤ 8.5', descanso: 150, alternativas: ['Remo Hammer', 'Remo con apoyo de pecho', 'Remo sentado en polea'], notas: 'Demanda lumbar: si molesta la espalda, cambia a Hammer o remo sentado en polea.' },
        { nombre: 'Press plano con mancuernas', grupo: 'Pecho', equipo: 'Mancuernas', series: 3, reps: '8-10', rpe: '8', descanso: 120, alternativas: ['Press de pecho en máquina', 'Fondos en paralelas'] },
        { nombre: 'Remo con mancuerna a una mano', grupo: 'Espalda', equipo: 'Mancuerna', series: 3, reps: '10-12', rpe: '8', descanso: 90, alternativas: ['Remo en polea unilateral'] },
        { nombre: 'Aperturas en polea', alias: ['Aperturas en polea o pec deck'], grupo: 'Pecho', equipo: 'Polea', series: 2, reps: '12-15', rpe: '9', descanso: 60, alternativas: ['Pec deck', 'Aperturas con mancuernas'] },
        { nombre: 'Pullover en polea alta', grupo: 'Espalda', equipo: 'Polea', series: 2, reps: '12-15', rpe: '8', descanso: 60, alternativas: ['Pullover con mancuerna'] }
      ]
    },
    {
      id: 'viernes-hombro-brazos', dia: 5, nombre: 'HOMBRO Y BRAZOS', enfoque: 'Hombro, tríceps, bíceps',
      nota: 'Registra siempre el viernes. Si se alarga más de 90 min, quita primero una serie de laterales.',
      ejercicios: [
        { nombre: 'Press militar con mancuernas sentado', grupo: 'Hombro', equipo: 'Mancuernas', series: 4, reps: '8-10', rpe: '≤ 8.5', descanso: 150, alternativas: ['Press Arnold', 'Press de hombro en máquina'] },
        { nombre: 'Elevaciones laterales en polea', alias: ['Elevaciones laterales'], grupo: 'Hombro', equipo: 'Polea', series: 4, reps: '12-15', rpe: '9', descanso: 60, alternativas: ['Elevaciones laterales', 'Elevaciones laterales en máquina'] },
        { nombre: 'Pájaros en polea', alias: ['Pájaros en polea a una mano', 'Pájaros en polea o reverse pec deck'], grupo: 'Deltoide posterior', equipo: 'Polea', series: 3, reps: '15-20', rpe: '8', descanso: 60, alternativas: ['Reverse pec deck', 'Face pull'] },
        { nombre: 'Fondos en paralelas', grupo: 'Tríceps', equipo: 'Peso corporal', series: 3, reps: '8-10', rpe: '8', descanso: 120, alternativas: ['Press cerrado', 'Fondos en máquina'] },
        { nombre: 'Extensión de tríceps sobre la cabeza en polea', grupo: 'Tríceps', equipo: 'Polea', series: 3, reps: '12-15', rpe: '9', descanso: 60, alternativas: ['Press francés con barra Z'] },
        { nombre: 'Bayesian curl', grupo: 'Bíceps', equipo: 'Polea', series: 3, reps: '10-12', rpe: '9', descanso: 75, alternativas: ['Curl en banco inclinado'], notas: 'Polea lo más baja, paso adelante, brazo detrás del torso, codo fijo, baja hasta estirar.' },
        { nombre: 'Curl concentrado', grupo: 'Bíceps', equipo: 'Mancuerna', series: 3, reps: '10-12', rpe: '9', descanso: 75, alternativas: ['Curl martillo'] }
      ]
    }
  ]
};
