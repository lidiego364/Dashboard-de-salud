// Pruebas del entrenador de la app Fuerza: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const Coach = require('../fuerza/coach.js');

const banca = { nombre: 'Press banca con barra', grupo: 'Pecho', series: 4, reps: '5-7', rpe: '≤ 8.5' };
const sentadilla = { nombre: 'Sentadilla en Smith', grupo: 'Cuádriceps', series: 4, reps: '6-8', rpe: '≤ 8.5' };
const ses = (kg, reps, rpe, extra) => ({ fecha: '2026-10-01', sets: reps.map(r => ({ kg, reps: r, rpe })), ...extra });

test('rangos de reps y RPE', () => {
  assert.deepEqual(Coach.rangoReps('10-12/pierna'), { low: 10, top: 12 });
  assert.deepEqual(Coach.rangoRpe('≤ 8.5'), { lo: 8, hi: 8.5, cap: 8.5 });
  assert.deepEqual(Coach.rangoRpe('7-8'), { lo: 7, hi: 8, cap: 8 });
  assert.equal(Coach.objetivoRpe('≤ 8.5', 0, 4), 8);
  assert.equal(Coach.objetivoRpe('≤ 8.5', 3, 4), 8.5);
});

test('primera vez: usa el peso del programa y el rango bajo', () => {
  const p = Coach.planEjercicio({ ...banca, kg: 60 }, []);
  assert.equal(p.tipo, 'primera');
  assert.deepEqual(p.sets.map(s => [s.kg, s.reps]), [[60, 5], [60, 5], [60, 5], [60, 5]]);
});

test('doble progresión: rango alto completo → +2.5 kg arriba, +5 kg abajo', () => {
  const p = Coach.planEjercicio(banca, [ses(80, [7, 7, 7, 7], 8)]);
  assert.equal(p.tipo, 'subir');
  assert.equal(p.sets[0].kg, 82.5);
  assert.equal(p.sets[0].reps, 5);
  const q = Coach.planEjercicio(sentadilla, [ses(100, [8, 8, 8, 8], 8)]);
  assert.equal(q.sets[0].kg, 105);
});

test('rango alto pero por encima del techo de RPE: no sube', () => {
  const p = Coach.planEjercicio(banca, [ses(80, [7, 7, 7, 7], 9.5)]);
  assert.equal(p.tipo, 'bajar');
  assert.ok(p.sets[0].kg < 80);
});

test('mantener: suma una rep por serie sin pasar del tope', () => {
  const p = Coach.planEjercicio(banca, [ses(80, [6, 6, 5, 7], 8)]);
  assert.equal(p.tipo, 'mantener');
  assert.equal(p.sets[0].kg, 80);
  assert.deepEqual(p.sets.map(s => s.reps), [7, 7, 6, 7]);
});

test('estancamiento: dos sesiones fallando el rango bajo → −10%', () => {
  const p = Coach.planEjercicio(banca, [ses(80, [5, 4, 4, 4], 9), ses(80, [5, 5, 4, 4], 9)]);
  assert.equal(p.tipo, 'estancado');
  assert.equal(p.sets[0].kg, 72.5);
});

test('demasiado fácil: sube aunque no haya llegado al tope', () => {
  const p = Coach.planEjercicio(banca, [ses(80, [6, 6, 6, 6], 6)]);
  assert.equal(p.tipo, 'facil');
  assert.equal(p.sets[0].kg, 82.5);
});

test('ignora sesiones de descarga para decidir', () => {
  const p = Coach.planEjercicio(banca, [ses(80, [7, 7, 7, 7], 8), ses(80, [5, 5], 6, { descarga: true })]);
  assert.equal(p.tipo, 'subir');
});

test('estado del día: rojo baja 5% y medio punto de RPE', () => {
  assert.equal(Coach.estadoDia({ sueno: 'poco', energia: 'baja', dolor: 'nada' }), 'rojo');
  assert.equal(Coach.estadoDia({ sueno: 'justo', energia: 'normal', dolor: 'nada' }), 'amarillo');
  assert.equal(Coach.estadoDia({ sueno: 'bien', energia: 'alta', dolor: 'nada' }), 'verde');
  const p = Coach.planEjercicio(banca, [ses(80, [6, 6, 6, 6], 8)], { estado: 'rojo' });
  assert.equal(p.sets[0].kg, 75);
  assert.equal(p.sets[0].rpe, 7.5);
});

test('ajuste en vivo: baja si la serie fue más dura, sube si sobró', () => {
  assert.equal(Coach.ajusteSerie({ kg: 80, reps: 6, rpe: 9.5 }, { reps: 6, rpe: 8 }, 5).delta, -2.5);
  assert.equal(Coach.ajusteSerie({ kg: 80, reps: 5, rpe: 10 }, { reps: 6, rpe: 8 }, 5).delta, -5);
  assert.equal(Coach.ajusteSerie({ kg: 80, reps: 7, rpe: 6 }, { reps: 6, rpe: 8 }, 5).delta, 2.5);
  assert.equal(Coach.ajusteSerie({ kg: 80, reps: 6, rpe: 8.5 }, { reps: 6, rpe: 8 }, 5), null);
  assert.equal(Coach.ajusteSerie({ kg: 80, reps: 6 }, { reps: 6, rpe: 8 }, 5), null);
});

test('mancuernas: saltos de 2 kg y nunca baja de golpe', () => {
  const inc = { nombre: 'Press inclinado con mancuernas', grupo: 'Pecho', equipo: 'Mancuernas', series: 3, reps: '8-10', rpe: '8' };
  assert.equal(Coach.planEjercicio(inc, [ses(26, [10, 10, 9], 9.5)]).sets[0].kg, 24);
  assert.equal(Coach.planEjercicio(inc, [ses(22, [10, 10, 10], 8)]).sets[0].kg, 24);
  assert.equal(Coach.ajusteSerie({ kg: 24, reps: 8, rpe: 9.5 }, { reps: 8, rpe: 8 }, 8, 'Mancuernas').delta, -2);
});

test('sin lastre (peso corporal): no inventa kilos', () => {
  const dom = { nombre: 'Dominadas', grupo: 'Espalda', series: 4, reps: '6-8', rpe: '≤ 8.5' };
  const p = Coach.planEjercicio(dom, [ses(0, [8, 8, 8, 8], 8)]);
  assert.equal(p.sets[0].kg, 0);
  assert.match(p.titulo, /lastre/);
});
