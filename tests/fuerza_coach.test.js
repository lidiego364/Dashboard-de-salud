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

// ---------- Libras ----------
const LB = 2.2046;
const enLb = kg => Math.round(kg * LB * 2) / 2;
const sesLb = (lb, reps, rpe) => ses(lb / LB, reps, rpe);

test('libras: barra de 5 en 5, polea de 2.5 en 2.5, mancuernas de 2 en 2', () => {
  const o = { unidad: 'lb' };
  assert.equal(enLb(Coach.planEjercicio({ ...banca, equipo: 'Barra' }, [sesLb(110, [7, 7, 7, 7], 8)], o).sets[0].kg), 115);
  const cruce = { nombre: 'Cruce', grupo: 'Pecho', equipo: 'Polea', series: 3, reps: '12-15', rpe: '9' };
  assert.equal(enLb(Coach.planEjercicio(cruce, [sesLb(112.5, [15, 15, 15], 9)], o).sets[0].kg), 117.5);
  const mil = { nombre: 'Militar', grupo: 'Hombro', equipo: 'Mancuernas', series: 4, reps: '8-10', rpe: '≤ 8.5' };
  assert.equal(enLb(Coach.planEjercicio(mil, [sesLb(42, [10, 10, 10, 10], 8)], o).sets[0].kg), 44);
  const smith = { nombre: 'Smith', grupo: 'Cuádriceps', equipo: 'Smith', series: 4, reps: '6-8', rpe: '≤ 8.5' };
  assert.equal(enLb(Coach.planEjercicio(smith, [sesLb(100, [8, 8, 8, 8], 8)], o).sets[0].kg), 110);
});

test('libras: respeta la escala que ya usas y el texto sale en lb', () => {
  const p = Coach.planEjercicio({ nombre: 'Militar barra', grupo: 'Hombro', equipo: 'Barra · respaldo', series: 3, reps: '6-8', rpe: '≤ 8.5' }, [sesLb(42.5, [8, 8, 8], 8)], { unidad: 'lb' });
  assert.equal(enLb(p.sets[0].kg), 47.5);
  assert.match(p.titulo, /5 lb/);
  const m = Coach.planEjercicio({ ...banca, equipo: 'Barra' }, [sesLb(110, [6, 6, 5, 5], 8)], { unidad: 'lb' });
  assert.equal(enLb(m.sets[0].kg), 110);
  assert.match(m.motivo, /110 lb/);
});

// ---------- Importador de StrengthLab ----------
const Importar = require('../fuerza/importar.js');
const programa = { rutinas: [
  { id: 'lunes', dia: 1, nombre: 'PUSH', ejercicios: [{ nombre: 'Press banca con barra', grupo: 'Pecho' }, { nombre: 'Elevaciones laterales', grupo: 'Hombro' }] },
  { id: 'viernes', dia: 5, nombre: 'HOMBRO Y BRAZOS', alias: ['BRAZOS'], ejercicios: [{ nombre: 'Elevaciones laterales en polea', grupo: 'Hombro', alias: ['Elevaciones laterales'] }, { nombre: 'Curl martillo', grupo: 'Bíceps' }] }
] };
const CAB = 'fecha,entrenamiento,ejercicio,serie,peso_registrado,unidad,peso_kg,repeticiones,rpe,tipo_serie,lado,peso_asistencia,peso_adicional,serie_completada_en,duracion_entrenamiento_min,volumen_entrenamiento_kg,sesion_id,ejercicio_id,serie_id';
const fila = (f, ent, ej, n, peso, u, reps, rpe, sid) => [f, ent, ej, n, peso, u, u === 'lb' ? peso / LB : peso, reps, rpe, 'working', '', '', '', '', 60, 0, sid, 'e', 's' + n].join(',');
const csv = [CAB,
  fila('2026-10-05', 'PUSH', 'Press banca con barra', 1, 110, 'lb', 8, 8, 'a'),
  fila('2026-10-05', 'PUSH', 'Elevaciones laterales', 1, 11, 'lb', 12, 9, 'a'),
  fila('2026-10-09', 'BRAZOS', 'Elevaciones laterales', 1, 11, 'lb', 12, 8.5, 'b'),
  fila('2026-10-09', 'BRAZOS', 'Curl martillo', 1, 14, 'kg', 10, 9, 'b'),
  fila('2026-10-09', 'BRAZOS', 'Curl martillo', 2, 14, 'lb', 10, 9, 'b'),
  fila('2026-10-09', 'BRAZOS', 'Curl martillo', 3, 14, 'lb', 10, 9, 'b'),
  fila('2026-10-09', 'BRAZOS', 'Curl martillo', 4, 15, 'lb', 9, 9.5, 'b')
].join('\r\n');

test('importador: detecta el CSV, traduce nombres y corrige unidades mal marcadas', () => {
  const filas = Importar.parseCSV('﻿' + csv);
  assert.ok(Importar.esStrengthLab(filas));
  const r = Importar.convertir(filas, programa);
  assert.equal(r.sesiones.length, 2);
  assert.equal(r.series, 7);
  assert.equal(r.unidadDominante, 'lb');
  assert.deepEqual(r.sinMapear, []);
  const [lun, vie] = r.sesiones;
  assert.equal(lun.rutinaId, 'lunes');
  assert.deepEqual(lun.ejercicios.map(e => e.nombre), ['Press banca con barra', 'Elevaciones laterales']);
  assert.equal(vie.rutinaId, 'viernes');
  assert.equal(vie.ejercicios[0].nombre, 'Elevaciones laterales en polea');
  const curl = vie.ejercicios[1].sets.map(s => enLb(s.kg));
  assert.deepEqual(curl, [14, 14, 14, 15]);
  assert.equal(r.correcciones.length, 1);
  assert.ok(lun.origen.startsWith('strengthlab:'));
});

test('importador: un CSV cualquiera no se toma por StrengthLab', () => {
  assert.equal(Importar.esStrengthLab(Importar.parseCSV('a,b\n1,2')), false);
});

test('escala de pesos según el equipo, en libras', () => {
  const barra = Coach.escala('Barra', 'lb'), manc = Coach.escala('Mancuernas', 'lb'), polea = Coach.escala('Polea', 'lb');
  assert.equal(barra.inicio, 45);
  assert.ok(barra.valores.includes(110) && barra.valores.includes(42.5) && barra.valores.includes(405));
  assert.ok(manc.valores.includes(11) && manc.valores.includes(12) && manc.valores.includes(42) && manc.valores.includes(88));
  assert.ok(manc.valores[manc.valores.length - 1] < barra.valores[barra.valores.length - 1]);
  assert.ok(polea.valores.includes(112.5) && polea.valores.includes(127.5));
  assert.equal(enLb(Coach.paso(11 / LB, 'Mancuernas', 'lb')), 1);
  assert.equal(enLb(Coach.paso(42 / LB, 'Mancuernas', 'lb')), 2);
});

// ---------- Medidas ----------
const Cuerpo = require('../fuerza/cuerpo.js');

test('grasa por cinta métrica (Marina EE. UU.)', () => {
  assert.equal(Cuerpo.grasaNavy({ sexo: 'h', altura: 178, cintura: 90, cuello: 40 }), 18.7);
  const m = Cuerpo.grasaNavy({ sexo: 'm', altura: 165, cintura: 72, cuello: 32, cadera: 98 });
  assert.ok(m > 20 && m < 35);
  assert.equal(Cuerpo.grasaNavy({ sexo: null, altura: 178, cintura: 90, cuello: 40 }), null);
  assert.equal(Cuerpo.grasaNavy({ sexo: 'h', altura: 178, cintura: 38, cuello: 40 }), null);
  assert.equal(Cuerpo.grasaNavy({ sexo: 'm', altura: 165, cintura: 72, cuello: 32 }), null);
});
