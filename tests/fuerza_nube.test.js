const test = require('node:test');
const assert = require('node:assert');
const Nube = require('../fuerza/nube.js');

const normEj = e => ({ nombre: e.nombre, grupo: e.grupo || 'Otro', equipo: e.equipo || '', series: e.series || 3, reps: String(e.reps || '8-10'), rpe: e.rpe || '', descanso: e.descanso || null, alternativas: e.alternativas || [], alias: e.alias || [], opcional: !!e.opcional, notas: e.notas || '' });
const rutinas = () => [
  { id: 'lun', dia: 1, nombre: 'PUSH', ejercicios: [
    normEj({ nombre: 'Press banca en Smith', grupo: 'Pecho', series: 4, reps: '5-7', rpe: '≤ 8.5', descanso: 180, alternativas: ['Press banca con barra'], alias: ['Press banca con barra Smith'] }),
    normEj({ nombre: 'Pec deck', grupo: 'Pecho', series: 3, reps: '12-15', rpe: '9', descanso: 75 })
  ] },
  { id: 'mie', dia: 3, nombre: 'PIERNA + ABDOMEN', ejercicios: [
    normEj({ nombre: 'Sentadilla en Smith', grupo: 'Cuádriceps', series: 4, reps: '6-8' }),
    normEj({ nombre: 'Crunch en polea', grupo: 'Abdomen', series: 3, reps: '12-15' })
  ] }
];

test('parsea un bloque fuerza y descarta respuestas de la app', () => {
  const p = Nube.parsearPropuesta('Hola\n```fuerza\n{"motivo":"Más volumen","cambios":[{"accion":"modificar","dia":"lunes","ejercicio":"Pec deck","series":4}]}\n```');
  assert.equal(p.motivo, 'Más volumen');
  assert.equal(p.cambios.length, 1);
  assert.equal(Nube.parsearPropuesta(Nube.MARCA + '\n```fuerza\n{"cambios":[{"accion":"quitar"}]}\n```'), null);
  assert.equal(Nube.parsearPropuesta('Sin bloque, solo un comentario.'), null);
  assert.equal(Nube.parsearPropuesta('```json\n{"otra":1}\n```'), null);
  assert.ok(Nube.parsearPropuesta('```json\n{"cambios":[{"accion":"quitar","dia":1,"ejercicio":"Pec deck"}]}\n```'));
});

test('modifica series, descanso en m:ss y RPE sin tocar el original', () => {
  const R = rutinas();
  const r = Nube.aplicarCambios(R, [{ accion: 'modificar', dia: 'Lunes', ejercicio: 'press banca en smith', series: 5, descanso: '2:30', rpe: '8' }], normEj);
  assert.deepEqual(r.errores, []);
  const e = r.rutinas[0].ejercicios[0];
  assert.equal(e.series, 5); assert.equal(e.descanso, 150); assert.equal(e.rpe, '8');
  assert.equal(R[0].ejercicios[0].series, 4, 'no muta la entrada');
});

test('sustituye conservando parámetros y deja el anterior de alternativa', () => {
  const r = Nube.aplicarCambios(rutinas(), [{ accion: 'sustituir', dia: 'push', ejercicio: 'Pec deck', nuevo: { nombre: 'Aperturas en polea', equipo: 'Polea' } }], normEj);
  const e = r.rutinas[0].ejercicios[1];
  assert.equal(e.nombre, 'Aperturas en polea');
  assert.equal(e.series, 3); assert.equal(e.reps, '12-15'); assert.equal(e.grupo, 'Pecho');
  assert.deepEqual(e.alternativas, ['Pec deck']);
});

test('añade, mueve y quita; encuentra por alias y por número de día', () => {
  const r = Nube.aplicarCambios(rutinas(), [
    { accion: 'añadir', dia: 3, posicion: 1, nuevo: { nombre: 'Hip thrust', grupo: 'Isquios / glúteo', series: 3, reps: '8-10' } },
    { accion: 'mover', dia: 'miércoles', ejercicio: 'Crunch en polea', posicion: 1 },
    { accion: 'quitar', dia: 'lunes', ejercicio: 'Press banca con barra Smith' }
  ], normEj);
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.rutinas[1].ejercicios.map(e => e.nombre), ['Crunch en polea', 'Hip thrust', 'Sentadilla en Smith']);
  assert.deepEqual(r.rutinas[0].ejercicios.map(e => e.nombre), ['Pec deck']);
});

test('rechaza cambios inválidos y sigue con los demás', () => {
  const r = Nube.aplicarCambios(rutinas(), [
    { accion: 'modificar', dia: 'domingo', ejercicio: 'Pec deck', series: 4 },
    { accion: 'modificar', dia: 'lunes', ejercicio: 'Remo', series: 4 },
    { accion: 'modificar', dia: 'lunes', ejercicio: 'Pec deck', series: 40 },
    { accion: 'añadir', dia: 'lunes', nuevo: { nombre: 'Pec deck' } },
    { accion: 'volar', dia: 'lunes' },
    { accion: 'modificar', dia: 'lunes', ejercicio: 'Pec deck', reps: '10-12' }
  ], normEj);
  assert.equal(r.hechos.length, 1);
  assert.equal(r.errores.length, 5);
  assert.equal(r.rutinas[0].ejercicios[1].reps, '10-12');
});

test('describir da una línea legible', () => {
  assert.equal(Nube.describir({ accion: 'modificar', dia: 'lunes', ejercicio: 'Pec deck', series: 4, reps: '10-12', descanso: 90 }), 'lunes: Pec deck → 4 × 10-12 · descanso 1:30');
  assert.match(Nube.describir({ accion: 'quitar', dia: 3, ejercicio: 'Crunch en polea' }), /^Miércoles: quita Crunch en polea$/);
});

test('base64 UTF-8 ida y vuelta con tildes y emojis', () => {
  const s = 'Jalón al pecho · 💪 · ñandú';
  assert.equal(Nube.base64Utf8(Nube.utf8Base64(s)), s);
});
