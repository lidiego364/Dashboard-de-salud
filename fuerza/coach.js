// Entrenador de Fuerza: decide carga, repeticiones y RPE de cada serie.
//
// Funciona sin conexión y solo con reglas del programa:
//   - Doble progresión: con el rango alto completo en todas las series (sin
//     pasar el techo de RPE) sube la carga y vuelve al rango bajo.
//   - Si la última sesión pasó del techo de RPE, baja la carga.
//   - Estancamiento (fallar el rango bajo dos sesiones seguidas): baja 10%.
//   - Si la última sesión fue demasiado fácil, sube antes de tiempo.
//   - Durante la sesión, ajusta las series restantes según el RPE real.
//   - El estado del día (sueño, energía, dolor) rebaja carga o RPE.
// Todos los pesos están en kg.
(function (root) {
  'use strict';

  const r5 = v => Math.round(v * 2) / 2;

  function rangoReps(reps) {
    const n = String(reps || '').match(/\d+/g);
    if (!n) return { low: 8, top: 8 };
    const low = +n[0], top = +(n[1] || n[0]);
    return { low: Math.min(low, top), top: Math.max(low, top) };
  }

  // "≤ 8.5" → 8–8.5 · "8" → 8 · "7-8" → 7–8 · "" → 7–8
  function rangoRpe(rpe) {
    const n = String(rpe || '').match(/\d+(?:[.,]\d+)?/g);
    if (!n) return { lo: 7, hi: 8, cap: null };
    const v = n.map(x => parseFloat(x.replace(',', '.')));
    if (/≤|<=|max/i.test(rpe)) return { lo: v[0] - 0.5, hi: v[0], cap: v[0] };
    const lo = Math.min(...v), hi = Math.max(...v);
    return { lo, hi, cap: hi };
  }

  // RPE objetivo de la serie i de n: sube del extremo bajo al alto a lo largo de las series.
  function objetivoRpe(rpe, i, n) {
    const { lo, hi } = rangoRpe(rpe);
    if (n <= 1) return r5((lo + hi) / 2);
    return r5(lo + (hi - lo) * (i / (n - 1)));
  }

  const sinTildes = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // Saltos de carga reales: mancuernas de 2 en 2 (de 1 en 1 por debajo de 10 kg);
  // barra, máquina y polea de 2.5 en 2.5 (de 1 en 1 por debajo de 20 kg).
  function pasoDe(kg, equipo) {
    if (/mancuerna/.test(sinTildes(equipo))) return kg >= 10 ? 2 : 1;
    return kg >= 20 ? 2.5 : 1;
  }
  function redondear(kg, equipo) {
    if (kg <= 0) return 0;
    const p = pasoDe(kg, equipo);
    return Math.round(Math.round(kg / p) * p * 100) / 100;
  }
  // Baja al menos un salto de carga respecto a kg.
  const bajarA = (objetivo, kg, eq) => Math.min(redondear(objetivo, eq), Math.max(0, kg - pasoDe(kg, eq)));

  const esInferior = g => /cuadri|isquio|glute|gemelo|pierna|femoral/.test(sinTildes(g));

  const media = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const fmtKg = kg => String(Math.round(kg * 10) / 10);
  const fmtRpe = v => String(Math.round(v * 10) / 10);
  const resumenSets = sets => fmtKg(Math.max(...sets.map(s => s.kg))) + ' kg × ' + sets.map(s => s.reps).join(', ');

  // Estado del día a partir del check-in: verde, amarillo o rojo.
  function estadoDia(c) {
    if (!c) return null;
    const p = { sueno: { poco: 2, justo: 1, bien: 0 }, energia: { baja: 2, normal: 0, alta: 0 }, dolor: { mucho: 2, algo: 1, nada: 0 } };
    const s = (p.sueno[c.sueno] || 0) + (p.energia[c.energia] || 0) + (p.dolor[c.dolor] || 0);
    return s >= 3 ? 'rojo' : s >= 1 ? 'amarillo' : 'verde';
  }

  // ej: { nombre, grupo, equipo, series, reps, rpe, kg }
  // hist: sesiones anteriores de ese ejercicio, en orden: [{ fecha, sets: [{ kg, reps, rpe }], descarga }]
  // opts: { estado: 'verde'|'amarillo'|'rojo', descarga: bool, inc: { superior, inferior } }
  function planEjercicio(ej, hist, opts) {
    opts = opts || {};
    const n = Math.max(1, ej.series | 0);
    const { low, top } = rangoReps(ej.reps);
    const rr = rangoRpe(opts.descarga ? '6' : ej.rpe);
    const inc = esInferior(ej.grupo) ? (opts.inc && opts.inc.inferior) || 5 : (opts.inc && opts.inc.superior) || 2.5;
    const eq = ej.equipo;
    const utiles = (hist || []).filter(h => h.sets && h.sets.length && !h.descarga);
    const last = utiles[utiles.length - 1], prev = utiles[utiles.length - 2];

    let kg, reps, tipo, titulo, motivo;
    if (opts.descarga) {
      const ref = (hist || []).filter(h => h.sets && h.sets.length).slice(-1)[0];
      kg = ref ? Math.max(...ref.sets.map(s => s.kg)) : ej.kg || 0;
      reps = Array(n).fill(low);
      tipo = 'descarga'; titulo = 'Descarga';
      motivo = 'Mismo peso, menos series y RPE 6: hoy se recupera, no se progresa.';
    } else if (!last) {
      kg = ej.kg || 0;
      reps = Array(n).fill(low);
      tipo = 'primera'; titulo = 'Primera vez';
      motivo = 'Elige un peso con el que hagas ' + low + ' reps a RPE ' + fmtRpe(rr.lo) + '. Con lo que registres, ajusto las próximas.';
    } else {
      const lastKg = Math.max(...last.sets.map(s => s.kg));
      const rpes = last.sets.map(s => s.rpe).filter(Boolean);
      const rpeLast = media(rpes);
      const completo = last.sets.length >= n;
      const alTope = completo && last.sets.every(s => s.reps >= top);
      const falla = s => s.sets.some(x => x.reps < low);
      const lastReps = last.sets.map(s => s.reps);
      const prevKg = prev ? Math.max(...prev.sets.map(s => s.kg)) : null;
      const sinPesoExtra = lastKg <= 0;

      if (prev && falla(last) && falla(prev) && prevKg != null && lastKg >= prevKg && (rpeLast == null || rpeLast >= rr.lo) && !sinPesoExtra) {
        kg = bajarA(lastKg * 0.9, lastKg, eq);
        reps = Array(n).fill(low);
        tipo = 'estancado'; titulo = 'Bajar 10%';
        motivo = 'Dos sesiones sin llegar a ' + low + ' reps. Según tu programa: baja 10% durante 2–3 semanas y vuelve a construir. Revisa también sueño, calorías y proteína.';
      } else if (rpeLast != null && rr.cap && rpeLast > rr.cap + 0.4 && !sinPesoExtra) {
        kg = bajarA(lastKg * 0.95, lastKg, eq);
        reps = Array(n).fill(low);
        tipo = 'bajar'; titulo = 'Bajar carga';
        motivo = 'La última vez fuiste a RPE ' + fmtRpe(rpeLast) + ' con techo ' + fmtRpe(rr.cap) + '. Baja un poco y mantén la técnica.';
      } else if (alTope && (rpeLast == null || !rr.cap || rpeLast <= rr.cap + 0.01)) {
        kg = sinPesoExtra ? 0 : Math.max(redondear(lastKg + inc, eq), lastKg + pasoDe(lastKg, eq));
        reps = Array(n).fill(sinPesoExtra ? top : low);
        tipo = 'subir'; titulo = sinPesoExtra ? 'Añade lastre o dificultad' : 'Subir ' + fmtKg(kg - lastKg) + ' kg';
        motivo = sinPesoExtra
          ? 'Llegaste a ' + top + ' reps en todas las series: añade lastre o hazlo más difícil.'
          : 'Llegaste a ' + top + ' reps en todas las series' + (rpeLast != null ? ' a RPE ' + fmtRpe(rpeLast) : '') + '. Doble progresión: +' + fmtKg(kg - lastKg) + ' kg y vuelve a ' + low + ' reps.';
      } else if (rpeLast != null && rpeLast <= rr.lo - 1.5 && !falla(last) && !sinPesoExtra) {
        kg = Math.max(redondear(lastKg + inc, eq), lastKg + pasoDe(lastKg, eq));
        reps = Array(n).fill(low);
        tipo = 'facil'; titulo = 'Subir ' + fmtKg(kg - lastKg) + ' kg';
        motivo = 'La última vez te quedó fácil (RPE ' + fmtRpe(rpeLast) + ' con objetivo ' + fmtRpe(rr.lo) + '). Sube ya, sin esperar al rango alto.';
      } else if (falla(last)) {
        kg = lastKg;
        reps = Array(n).fill(low);
        tipo = 'repetir'; titulo = 'Repetir peso';
        motivo = 'No llegaste a ' + low + ' reps en todas las series. Repite ' + fmtKg(lastKg) + ' kg y busca ' + low + ' en todas.';
      } else {
        kg = lastKg;
        reps = Array.from({ length: n }, (_, i) => Math.min(top, (lastReps[i] != null ? lastReps[i] : lastReps[lastReps.length - 1]) + 1));
        tipo = 'mantener'; titulo = 'Mantener y sumar reps';
        motivo = 'Mantén ' + fmtKg(lastKg) + ' kg y suma 1 rep por serie hasta llegar a ' + top + ' en todas.';
      }
      motivo += ' Última vez: ' + resumenSets(last.sets) + (rpeLast != null ? ' @ RPE ' + fmtRpe(rpeLast) : '') + '.';
    }

    let rpeAjuste = 0;
    if (opts.estado === 'rojo') {
      if (kg > 0 && tipo !== 'primera') kg = bajarA(kg * 0.95, kg, eq);
      rpeAjuste = -0.5;
      motivo += ' Hoy llegas cansado: −5% de carga y RPE medio punto más bajo.';
    } else if (opts.estado === 'amarillo') {
      rpeAjuste = -0.5;
      motivo += ' Hoy no estás al 100%: misma carga, pero apunta medio punto de RPE por debajo.';
    }

    const sets = Array.from({ length: n }, (_, i) => ({
      kg, reps: reps[i], rpe: Math.max(5, (opts.descarga ? 6 : objetivoRpe(ej.rpe, i, n)) + rpeAjuste)
    }));
    return { sets, tipo, titulo, motivo, low, top, cap: rr.cap };
  }

  // Ajuste en vivo tras completar una serie. Devuelve los kg a sumar a las series que quedan.
  function ajusteSerie(hecho, objetivo, low, equipo) {
    if (!hecho || hecho.rpe == null || !objetivo || objetivo.rpe == null || !(hecho.kg > 0)) return null;
    const d = hecho.rpe - objetivo.rpe, paso = pasoDe(hecho.kg, equipo);
    if (d >= 1 || hecho.reps < low) {
      const delta = -Math.min(hecho.kg, paso * (d >= 2 ? 2 : 1));
      return { delta, txt: 'Serie a RPE ' + fmtRpe(hecho.rpe) + (hecho.reps < low ? ' y por debajo de ' + low + ' reps' : '') + ' (objetivo ' + fmtRpe(objetivo.rpe) + '): bajo a ' + fmtKg(hecho.kg + delta) + ' kg.' };
    }
    if (d <= -1.5 && hecho.reps >= objetivo.reps) {
      return { delta: paso, txt: 'Te sobró: RPE ' + fmtRpe(hecho.rpe) + ' con objetivo ' + fmtRpe(objetivo.rpe) + '. Subo a ' + fmtKg(hecho.kg + paso) + ' kg.' };
    }
    return null;
  }

  const Coach = { rangoReps, rangoRpe, objetivoRpe, redondear, estadoDia, planEjercicio, ajusteSerie, esInferior };
  if (typeof module !== 'undefined' && module.exports) module.exports = Coach;
  else root.Coach = Coach;
})(typeof window !== 'undefined' ? window : globalThis);
