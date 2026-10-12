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
//   notas         Indicaciones técnicas.
window.PROGRAMA_FUERZA = {
  version: 1,
  nombre: 'Programa de fuerza v5',
  objetivo: 'Preservar masa magra en déficit',
  perfil: { nombre: 'Diego', diasSemana: 5 },
  inicio: '2026-09-30',
  fin: '2026-11-30',
  descargas: [['2026-10-12', '2026-10-18'], ['2026-11-16', '2026-11-22']],
  umbralDescarga: 9.3, // RPE medio semanal que, dos semanas seguidas, dispara una descarga
  diasLibres: {
    6: { titulo: 'RAQUETA / SURF', nota: 'Raqueta: máximo 3 sesiones por semana y solo una larga (> 90 min).' },
    7: { titulo: 'DESCANSO TOTAL', nota: 'Hoy no se entrena. Recupera.' }
  },
  calentamiento: {
    general: '5 min general: bici, cinta suave o remo',
    movilidad: 'Band pull-apart ×20 · dislocaciones ×10 · extensión torácica ×10'
  },
  cardio: {
    texto: 'Cinta 12% · 3 mph · 20–30 min',
    nota: 'Siempre después de las pesas, sin sujetar el pasamanos, máximo 30 min.'
  },
  rutinas: [
    {
      id: 'lunes-push', dia: 1, nombre: 'PUSH', enfoque: 'Pecho, hombro, tríceps',
      ejercicios: [
        { nombre: 'Press banca con barra', grupo: 'Pecho', equipo: 'Barra', series: 4, reps: '5-7', rpe: '≤ 8.5', descanso: 180, alternativas: ['Press banca con mancuernas', 'Press de pecho en máquina'], notas: 'Nunca al fallo en básicos.' },
        { nombre: 'Press militar sentado con barra', grupo: 'Hombro', equipo: 'Barra · respaldo', series: 3, reps: '6-8', rpe: '≤ 8.5', descanso: 150, alternativas: ['Press de hombro en máquina', 'Press militar en Smith sentado'] },
        { nombre: 'Press inclinado con mancuernas', grupo: 'Pecho', equipo: 'Mancuernas', series: 3, reps: '8-10', rpe: '8', descanso: 120 },
        { nombre: 'Cruce de poleas de abajo hacia arriba', grupo: 'Pecho', equipo: 'Polea', series: 3, reps: '12-15', rpe: '9', descanso: 75 },
        { nombre: 'Elevaciones laterales', grupo: 'Hombro', equipo: 'Mancuernas', series: 4, reps: '12-15', rpe: '9', descanso: 60 },
        { nombre: 'Press francés con barra Z', grupo: 'Tríceps', equipo: 'Barra Z', series: 3, reps: '10-12', rpe: '9', descanso: 75, alternativas: ['Extensión sobre la cabeza con mancuerna'], notas: 'Enfocado en la cabeza larga.' },
        { nombre: 'Extensión en polea con cuerda', grupo: 'Tríceps', equipo: 'Polea', series: 3, reps: '12-15', rpe: '9', descanso: 60 },
        { nombre: 'Face pull ligero', grupo: 'Deltoide posterior', equipo: 'Polea', series: 2, reps: '18-20', descanso: 60, opcional: true, notas: 'Opcional: solo si sigues el bloque de especialización.' }
      ]
    },
    {
      id: 'martes-pull', dia: 2, nombre: 'PULL', enfoque: 'Espalda, bíceps, deltoide posterior',
      ejercicios: [
        { nombre: 'Remo con barra inclinado', grupo: 'Espalda', equipo: 'Barra', series: 4, reps: '6-8', rpe: '≤ 8.5', descanso: 180, alternativas: ['Remo con apoyo de pecho', 'Remo Hammer'], notas: 'Demanda lumbar: si molesta la espalda, cambia a remo con apoyo de pecho o Hammer.' },
        { nombre: 'Dominadas', grupo: 'Espalda', equipo: 'Lastradas o asistidas', series: 4, reps: '6-8', rpe: '≤ 8.5', descanso: 150, notas: 'Anota el lastre en el peso (0 = solo peso corporal).' },
        { nombre: 'Jalón agarre neutro', grupo: 'Espalda', equipo: 'Polea', series: 3, reps: '10-12', rpe: '8', descanso: 120 },
        { nombre: 'Face pull', grupo: 'Deltoide posterior', equipo: 'Polea', series: 3, reps: '15-20', rpe: '8', descanso: 60, notas: 'No son opcionales: compensan las sesiones de raqueta.' },
        { nombre: 'Bayesian curl', grupo: 'Bíceps', equipo: 'Polea', series: 3, reps: '10-12', rpe: '9', descanso: 75, notas: 'Polea lo más baja, paso adelante, brazo detrás del torso, codo fijo, baja hasta estirar. Empieza ligero.' },
        { nombre: 'Curl martillo', grupo: 'Bíceps', equipo: 'Mancuernas', series: 2, reps: '12-15', rpe: '9', descanso: 60 }
      ]
    },
    {
      id: 'miercoles-pierna', dia: 3, nombre: 'PIERNA + ABDOMEN', enfoque: 'Cuádriceps, femoral, gemelo, abdomen',
      movilidad: 'Gato-camello ×10 · 90/90 de cadera ×8/lado · tobillo en pared ×10/lado',
      cardioOmitirSiRpe: 8.5,
      cardioNota: 'Es lo primero que se recorta: omítela si la sentadilla Smith bajó de calidad o el RPE de la pierna pasó de 8.5. Si la haces, que sea suave.',
      ejercicios: [
        { nombre: 'Sentadilla en Smith', grupo: 'Cuádriceps', equipo: 'Smith', series: 4, reps: '6-8', rpe: '≤ 8.5', descanso: 180, alternativas: ['Hack squat', 'Prensa de piernas'], notas: 'Pies un palmo por delante de la barra, torso vertical. Si molesta la espalda: hack squat o prensa.' },
        { nombre: 'Prensa de piernas', grupo: 'Cuádriceps', equipo: 'Máquina', series: 4, reps: '10-12', rpe: '≤ 8.5', descanso: 150 },
        { nombre: 'Curl femoral tumbado', grupo: 'Isquios', equipo: 'Máquina', series: 4, reps: '10-12', rpe: '8', descanso: 90 },
        { nombre: 'Sentadilla búlgara con mancuernas', grupo: 'Cuádriceps', equipo: 'Mancuernas', series: 3, reps: '10-12/pierna', rpe: '7-8', descanso: 120 },
        { nombre: 'Extensión de cuádriceps', grupo: 'Cuádriceps', equipo: 'Máquina', series: 2, reps: '12-15', rpe: '9', descanso: 90 },
        { nombre: 'Elevación de gemelo de pie', grupo: 'Gemelo', equipo: 'Máquina', series: 3, reps: '10-15', rpe: '8-9', descanso: 60 },
        { nombre: 'Crunch en polea', grupo: 'Abdomen', equipo: 'Polea', series: 3, reps: '12-15', rpe: '8', descanso: 60, notas: 'Cadera fija, flexiona la columna, codos cerca de la cara.' },
        { nombre: 'Elevación de piernas colgado', grupo: 'Abdomen', equipo: 'Peso corporal', series: 3, reps: '10-15', rpe: '8', descanso: 60 }
      ]
    },
    {
      id: 'jueves-pecho-espalda', dia: 4, nombre: 'PECHO Y ESPALDA', enfoque: 'Pecho, espalda',
      nota: 'Alterna por parejas: 1-2, 3-4, 5-6.',
      ejercicios: [
        { nombre: 'Press inclinado con barra', grupo: 'Pecho', equipo: 'Barra', series: 4, reps: '6-8', rpe: '≤ 8.5', descanso: 180 },
        { nombre: 'Remo en T', grupo: 'Espalda', equipo: 'Barra T', series: 4, reps: '8-10', rpe: '≤ 8.5', descanso: 150, alternativas: ['Remo Hammer', 'Remo sentado en polea'], notas: 'Demanda lumbar: si molesta la espalda, cambia a Hammer o remo sentado en polea.' },
        { nombre: 'Press plano con mancuernas', grupo: 'Pecho', equipo: 'Mancuernas', series: 3, reps: '8-10', rpe: '8', descanso: 120 },
        { nombre: 'Remo con mancuerna a una mano', grupo: 'Espalda', equipo: 'Mancuerna', series: 3, reps: '10-12', rpe: '8', descanso: 90 },
        { nombre: 'Aperturas en polea', grupo: 'Pecho', equipo: 'Polea', series: 2, reps: '12-15', rpe: '9', descanso: 60, alternativas: ['Pec deck'] },
        { nombre: 'Pullover en polea alta', grupo: 'Espalda', equipo: 'Polea', series: 2, reps: '12-15', rpe: '8', descanso: 60 }
      ]
    },
    {
      id: 'viernes-hombro-brazos', dia: 5, nombre: 'HOMBRO Y BRAZOS', enfoque: 'Hombro, tríceps, bíceps',
      nota: 'Registra siempre la sesión del viernes.',
      ejercicios: [
        { nombre: 'Press militar con mancuernas sentado', grupo: 'Hombro', equipo: 'Mancuernas', series: 4, reps: '8-10', rpe: '≤ 8.5', descanso: 150 },
        { nombre: 'Elevaciones laterales en polea', grupo: 'Hombro', equipo: 'Polea', series: 4, reps: '12-15', rpe: '9', descanso: 60 },
        { nombre: 'Pájaros en polea', grupo: 'Deltoide posterior', equipo: 'Polea', series: 3, reps: '15-20', rpe: '8', descanso: 60, alternativas: ['Reverse pec deck'] },
        { nombre: 'Fondos en paralelas', grupo: 'Tríceps', equipo: 'Peso corporal', series: 3, reps: '8-10', rpe: '8', descanso: 120 },
        { nombre: 'Extensión de tríceps sobre la cabeza en polea', grupo: 'Tríceps', equipo: 'Polea', series: 3, reps: '12-15', rpe: '9', descanso: 60 },
        { nombre: 'Bayesian curl', grupo: 'Bíceps', equipo: 'Polea', series: 3, reps: '10-12', rpe: '9', descanso: 75, notas: 'Polea lo más baja, paso adelante, brazo detrás del torso, codo fijo, baja hasta estirar.' },
        { nombre: 'Curl concentrado', grupo: 'Bíceps', equipo: 'Mancuerna', series: 3, reps: '10-12', rpe: '9', descanso: 75 }
      ]
    }
  ]
};
