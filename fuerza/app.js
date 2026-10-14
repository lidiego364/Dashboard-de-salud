'use strict';
(() => {
  // ---------- Constantes ----------
  const KEY = 'fuerza.v1';
  const LB = 2.2046;
  const PRG = window.PROGRAMA_FUERZA || {};
  const COLORS = ['#E6EBF5', '#7C93BA', '#5C86C9', '#9FB4D6', '#C5CCD8'];
  const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const DIA_NOMBRE = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const RECUP = [['Pecho', '#E6EBF5'], ['Espalda', '#9FB4D6'], ['Piernas', '#7C93BA'], ['Hombro', '#C5CCD8']];
  const GRUPOS = ['Pecho', 'Espalda', 'Hombro', 'Deltoide posterior', 'Cuádriceps', 'Isquios / glúteo', 'Gemelo', 'Bíceps', 'Tríceps', 'Abdomen', 'Otro'];
  const RPES = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];
  const ANGULOS = ['Frente', 'Lado', 'Espalda'];
  const DAY = 86400000;

  // ---------- Utilidades ----------
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = n => String(n).padStart(2, '0');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const epley = (kg, reps) => reps <= 1 ? kg : kg * (1 + reps / 30);
  const isoDia = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseDia = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const fechaCorta = d => { d = new Date(d); return d.getDate() + ' ' + MESES[d.getMonth()]; };
  const lunes = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; };
  const hoy0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const diaSemana = (d = new Date()) => (d.getDay() + 6) % 7 + 1;
  const mmss = s => Math.floor(s / 60) + ':' + pad(s % 60);
  const fmtDesc = s => s >= 120 ? (s / 60) + ' min' : s + ' s';
  const capRpe = s => { const m = String(s || '').match(/\d+(?:[.,]\d+)?/g); return m ? Math.max(...m.map(x => parseFloat(x.replace(',', '.')))) : null; };
  const fRpe = v => String(Math.round(v * 10) / 10);
  function hace(t) {
    const n = Math.round((hoy0() - new Date(new Date(t).setHours(0, 0, 0, 0))) / DAY);
    return n <= 0 ? 'hoy' : n === 1 ? 'ayer' : 'hace ' + n + ' días';
  }

  // ---------- Datos ----------
  function defaults() {
    return {
      version: 1, programaVersion: 0,
      ajustes: { nombre: '', unidad: 'kg', metaPeso: null, objetivoSemanal: 3, descanso: 90, onboarded: false },
      rutinas: [], sesiones: [], peso: [], activo: null
    };
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && d.version === 1) { const def = defaults(); return { ...def, ...d, ajustes: { ...def.ajustes, ...d.ajustes } }; }
    } catch (e) { /* datos corruptos o almacenamiento bloqueado */ }
    return defaults();
  }
  let D = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) { toast('No se pudo guardar en este dispositivo'); }
  }
  function normEj(e) {
    return {
      nombre: String(e.nombre || 'Ejercicio').trim(), grupo: e.grupo || 'Otro', equipo: e.equipo || '',
      series: Math.max(1, parseInt(e.series) || 3), reps: String(e.reps || '8-10'), rpe: e.rpe ? String(e.rpe) : '',
      kg: e.kg != null ? +e.kg : null, descanso: e.descanso ? +e.descanso : null, notas: e.notas || '',
      alternativas: Array.isArray(e.alternativas) ? e.alternativas.slice() : [], opcional: !!e.opcional, desde: e.desde || null,
      alias: Array.isArray(e.alias) ? e.alias.slice() : []
    };
  }
  function normRutina(r) {
    return {
      id: r.id || uid(), dia: r.dia ? +r.dia : null, nombre: String(r.nombre || 'RUTINA').toUpperCase(), enfoque: r.enfoque || '',
      nota: r.nota || '', duracion: r.duracion || '', movilidad: r.movilidad || '', cardioNota: r.cardioNota || '', cardioOmitirSiRpe: r.cardioOmitirSiRpe || null,
      ejercicios: (r.ejercicios || []).map(normEj)
    };
  }
  function aplicarPrograma() {
    if (!Array.isArray(PRG.rutinas)) return;
    const v = PRG.version || 1;
    if (v <= (D.programaVersion || 0)) return;
    D.rutinas = PRG.rutinas.map(normRutina);
    D.programaVersion = v;
    if (PRG.perfil) {
      if (!D.ajustes.nombre && PRG.perfil.nombre) D.ajustes.nombre = PRG.perfil.nombre;
      if (!D.ajustes.onboarded && PRG.perfil.diasSemana) D.ajustes.objetivoSemanal = PRG.perfil.diasSemana;
    }
    save();
  }
  aplicarPrograma();

  // ---------- Unidades ----------
  const U = () => D.ajustes.unidad;
  const fv = kg => U() === 'kg' ? Math.round(kg * 10) / 10 : Math.round(kg * LB * 2) / 2;
  const toKg = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : U() === 'kg' ? n : n / LB; };
  const fmt = n => Math.round(n).toLocaleString('es-ES');

  // ---------- Programa ----------
  function enDescarga(d = new Date()) { const f = isoDia(d); return (PRG.descargas || []).find(([a, b]) => f >= a && f <= b) || null; }
  function semanaPrograma() {
    if (!PRG.inicio || !PRG.fin) return null;
    const i = lunes(parseDia(PRG.inicio)), f = lunes(parseDia(PRG.fin)), h = lunes(new Date());
    const total = Math.round((f - i) / (7 * DAY)) + 1, n = Math.round((h - i) / (7 * DAY)) + 1;
    return n >= 1 && n <= total ? { n, total } : null;
  }
  const vigente = (e, f = new Date()) => !e.desde || isoDia(f) >= e.desde;
  const ejerciciosDe = (r, f = new Date()) => r.ejercicios.filter(e => vigente(e, f));
  function seriesPlan(e, f = new Date()) {
    if (!vigente(e, f)) return 0;
    const d = enDescarga(f) && PRG.descarga;
    return d ? Math.max(1, Math.ceil(e.series * (d.factorSeries || 0.5))) : e.series;
  }
  const esInferior = g => /cuadri|isquio|glute|gemelo|pierna|femoral/.test(norm(g));
  function fechaDia(r, mon = lunes(new Date())) { return r.dia ? new Date(mon.getTime() + (r.dia - 1) * DAY + 12 * 3600000) : new Date(); }
  const rutinasConDia = () => D.rutinas.filter(r => r.dia).sort((a, b) => a.dia - b.dia);
  function proximaRutina(d) {
    const R = rutinasConDia();
    return R.find(r => r.dia > d) || R[0] || null;
  }
  function rutinaHoy() {
    const R = D.rutinas;
    if (!R.length) return null;
    const conDia = rutinasConDia();
    if (conDia.length) {
      const d = diaSemana(), r = conDia.find(x => x.dia === d);
      if (r) {
        const hecha = sesionesDesde(hoy0()).some(s => s.rutinaId === r.id);
        return { r, n: conDia.indexOf(r) + 1, total: conDia.length, tipo: hecha ? 'hecha' : 'hoy', prox: proximaRutina(d) };
      }
      return { tipo: 'libre', d, prox: proximaRutina(d) };
    }
    const last = D.sesiones[D.sesiones.length - 1];
    const i = last ? R.findIndex(r => r.id === last.rutinaId) : -1, idx = (i + 1) % R.length;
    return { r: R[idx], n: idx + 1, total: R.length, tipo: 'hoy' };
  }

  // ---------- Estadísticas ----------
  function grupoRecup(g) {
    const s = norm(g);
    if (/pecho|pector/.test(s)) return 'Pecho';
    if (/espalda|dorsal|trapecio|lumbar/.test(s)) return 'Espalda';
    if (/pierna|cuadri|femoral|glute|gemelo|aductor|isquio/.test(s)) return 'Piernas';
    if (/hombro|deltoid/.test(s)) return 'Hombro';
    return null;
  }
  function sesionesDesde(t0, t1 = Infinity) { return D.sesiones.filter(s => { const t = new Date(s.fecha).getTime(); return t >= t0 && t < t1; }); }
  function racha() {
    const obj = Math.max(1, D.ajustes.objetivoSemanal | 0);
    let mon = lunes(new Date()).getTime(), n = 0;
    const cuenta = m => sesionesDesde(m, m + 7 * DAY).length;
    if (cuenta(mon) >= obj) n++;
    for (let i = 0; i < 520; i++) {
      mon -= 7 * DAY;
      if (cuenta(mon) >= obj || enDescarga(new Date(mon + 3 * DAY))) n++; else break;
    }
    return n;
  }
  function rpeMedio(sesiones) {
    let s = 0, n = 0;
    sesiones.forEach(x => x.ejercicios.forEach(e => e.sets.forEach(st => { if (st.rpe) { s += st.rpe; n++; } })));
    return n ? s / n : null;
  }
  function alertaDescarga() {
    const um = PRG.umbralDescarga || 9.3, mon = lunes(new Date()).getTime();
    const w1 = rpeMedio(sesionesDesde(mon - 7 * DAY, mon)), w2 = rpeMedio(sesionesDesde(mon - 14 * DAY, mon - 7 * DAY));
    return w1 != null && w2 != null && w1 > um && w2 > um ? { w1, w2, um } : null;
  }
  function volumenSemana() {
    const plan = new Map(), hecho = new Map(), mon = lunes(new Date()).getTime();
    D.rutinas.forEach(r => { const f = fechaDia(r, new Date(mon)); r.ejercicios.forEach(e => { const n = seriesPlan(e, f); if (!e.opcional && n) plan.set(e.grupo, (plan.get(e.grupo) || 0) + n); }); });
    sesionesDesde(mon, mon + 7 * DAY).forEach(s => s.ejercicios.forEach(e => hecho.set(e.grupo, (hecho.get(e.grupo) || 0) + e.sets.length)));
    const grupos = [...new Set([...plan.keys(), ...hecho.keys()])];
    const filas = grupos.map(g => ({ g, plan: plan.get(g) || 0, hecho: hecho.get(g) || 0 })).sort((a, b) => b.plan - a.plan || b.hecho - a.hecho);
    return { filas, plan: filas.reduce((s, f) => s + f.plan, 0), hecho: filas.reduce((s, f) => s + f.hecho, 0) };
  }
  // Nombre del ejercicio en el programa: unifica alias ("Dominadas" → "Jalón al pecho").
  function canon(nombre) {
    const k = norm(nombre);
    for (const r of D.rutinas) for (const e of r.ejercicios) if (norm(e.nombre) === k || (e.alias || []).some(x => norm(x) === k)) return e.nombre;
    return nombre;
  }
  function historialEj(nombre) {
    const k = norm(canon(nombre)), out = [];
    D.sesiones.forEach(s => s.ejercicios.forEach(e => { if (e.sets.length && norm(canon(e.nombre)) === k) out.push({ fecha: s.fecha, sets: e.sets, descarga: !!s.descarga }); }));
    return out;
  }
  function ultimo(nombre) { const h = historialEj(nombre); return h.length ? h[h.length - 1] : null; }
  const seriesRutina = (r, f = new Date()) => r.ejercicios.reduce((a, e) => a + (e.opcional ? 0 : seriesPlan(e, f)), 0);
  const seriesCompletas = r => r.ejercicios.reduce((a, e) => a + (e.opcional ? 0 : e.series), 0);
  function estMin(r, f = new Date()) { return Math.round(r.ejercicios.reduce((a, e) => a + (e.opcional ? 0 : seriesPlan(e, f) * (40 + (e.descanso || D.ajustes.descanso))), 0) / 60) + 5; }
  function enfoque(r) {
    if (r.enfoque) return r.enfoque;
    const g = [...new Set(r.ejercicios.map(e => e.grupo).filter(Boolean))].map(x => x.toLowerCase()).join(', ');
    return g.charAt(0).toUpperCase() + g.slice(1);
  }
  function ultimaVez(rid) {
    for (let i = D.sesiones.length - 1; i >= 0; i--) if (D.sesiones[i].rutinaId === rid) return hace(D.sesiones[i].fecha);
    return 'sin usar';
  }
  function nombresConocidos() {
    const set = new Map();
    D.rutinas.forEach(r => r.ejercicios.forEach(e => set.set(norm(e.nombre), e)));
    D.sesiones.forEach(s => s.ejercicios.forEach(e => { if (!set.has(norm(e.nombre))) set.set(norm(e.nombre), e); }));
    return [...set.values()];
  }

  // ---------- Entrenamiento activo ----------
  function prefill(sets, nombre, fallbackKg, fallbackReps) {
    const prev = ultimo(nombre);
    sets.forEach((s, j) => {
      if (s.done) return;
      const p = prev && prev.sets[j], base = p || (prev && prev.sets[prev.sets.length - 1]);
      s.pk = p ? p.kg : null; s.pr = p ? p.reps : null; s.prpe = p && p.rpe ? p.rpe : null;
      s.kg = base ? base.kg : fallbackKg; s.reps = base ? base.reps : fallbackReps;
    });
  }
  // Plan del entrenador (coach.js) para un ejercicio de la rutina.
  function planDe(e, n, estado, desc) {
    return Coach.planEjercicio({ nombre: e.nombre, grupo: e.grupo, equipo: e.equipo, series: n, reps: e.reps, rpe: e.rpe, kg: e.kg || 0 }, historialEj(e.nombre), { estado, descarga: desc, inc: PRG.progresion, unidad: U() });
  }
  function aplicarPlan(ej, plan) {
    ej.sets.forEach((x, j) => {
      const t = plan.sets[j] || plan.sets[plan.sets.length - 1];
      if (x.done || !t) return;
      x.kg = t.kg; x.reps = t.reps; x.trpe = t.rpe; x.treps = t.reps; x.manual = false;
    });
    ej.coach = { tipo: plan.tipo, titulo: plan.titulo, motivo: plan.motivo };
    ej.low = plan.low; ej.top = plan.top; ej.ajuste = '';
  }
  function crearActivo(r, estado) {
    const desc = !!(enDescarga() && PRG.descarga);
    return {
      rutinaId: r.id, nombre: r.nombre, nota: r.nota || '', movilidad: r.movilidad || '', cardioNota: r.cardioNota || '', cardioOmitirSiRpe: r.cardioOmitirSiRpe || null,
      inicio: Date.now(), fin: 0, exi: 0, view: 'focus', restEnd: 0, restTotal: 0, restExtra: 0, cardio: '', descarga: desc, estado: estado || null,
      ejercicios: ejerciciosDe(r).map((e, i) => {
        const n = seriesPlan(e), rpe = desc ? PRG.descarga.rpe : (e.rpe || '');
        const sets = Array.from({ length: n }, () => ({ kg: 0, reps: 0, rpe: null, done: false }));
        prefill(sets, e.nombre, e.kg || 0, parseInt(e.reps) || 8);
        const descanso = e.descanso || D.ajustes.descanso;
        const ej = {
          nombre: e.nombre, original: e.nombre, opciones: [e.nombre, ...(e.alternativas || [])], grupo: e.grupo, color: COLORS[i % COLORS.length],
          descanso, notas: e.notas || '', opcional: !!e.opcional, rpe, cap: capRpe(rpe), kgBase: e.kg || 0, repsBase: parseInt(e.reps) || 8, repsTxt: e.reps, rpeTxt: e.rpe || '', seriesFull: e.series, equipo: e.equipo || '',
          meta: [e.grupo, e.equipo].filter(Boolean).join(' · ') + ' · ' + n + '×' + e.reps + (rpe ? ' · RPE ' + rpe : '') + ' · ' + fmtDesc(descanso) + (e.opcional ? ' · opcional' : ''),
          sets
        };
        aplicarPlan(ej, planDe(e, n, estado, desc));
        return ej;
      })
    };
  }
  // Las series siguientes toman el peso de la que acabas de hacer (salvo las que cambiaste a mano).
  function arrastrar(ei, si) {
    const e = D.activo.ejercicios[ei], x = e.sets[si];
    e.sets.forEach((y, j) => { if (j > si && !y.done && !y.manual) y.kg = x.kg; });
  }
  // Ajuste en vivo de las series que quedan según el RPE de la que acaba de terminar.
  function ajustar(ei, si) {
    const e = D.activo.ejercicios[ei], x = e.sets[si];
    const aj = Coach.ajusteSerie({ kg: x.kg, reps: x.reps, rpe: x.rpe }, { rpe: x.trpe, reps: x.treps }, e.low || 0, e.equipo, U());
    if (!aj) return null;
    let n = 0;
    e.sets.forEach((y, j) => { if (j > si && !y.done && !y.manual) { y.kg = Math.max(0, y.kg + aj.delta); n++; } });
    e.ajuste = n ? aj.txt : '';
    return n ? aj : null;
  }
  // Plan de la próxima sesión, contando la de hoy.
  function proximaVez(a) {
    return a.ejercicios.map(e => {
      const hechas = e.sets.filter(x => x.done && x.reps > 0).map(x => ({ kg: x.kg, reps: x.reps, rpe: x.rpe }));
      if (!hechas.length) return null;
      const hist = historialEj(e.nombre).concat([{ sets: hechas, descarga: !!a.descarga }]);
      const p = Coach.planEjercicio({ nombre: e.nombre, grupo: e.grupo, equipo: e.equipo, series: e.seriesFull || e.sets.length, reps: e.repsTxt || e.top || 8, rpe: e.rpeTxt != null ? e.rpeTxt : e.rpe }, hist, { inc: PRG.progresion, unidad: U() });
      return { nombre: e.nombre, plan: p };
    }).filter(Boolean);
  }
  const restLeft = a => a && a.restEnd ? Math.max(0, Math.ceil((a.restEnd - Date.now()) / 1000)) : 0;
  function clockTxt(a) {
    const s = Math.max(0, Math.floor(((a.fin || Date.now()) - a.inicio) / 1000));
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
    return h ? h + ':' + pad(m) + ':' + pad(s % 60) : m + ':' + pad(s % 60);
  }
  function progreso(a) {
    let vol = 0, done = 0, total = 0;
    a.ejercicios.forEach(e => e.sets.forEach(x => { if (!e.opcional || x.done) total++; if (x.done) { done++; vol += x.kg * x.reps; } }));
    return { vol, done, total };
  }
  function iniciarDescanso(seg, rpe) {
    const a = D.activo, x = PRG.extraDescansoRpe, extra = x && rpe && rpe >= x.desde ? x.segundos : 0;
    a.restExtra = extra; a.restTotal = seg + extra; a.restEnd = Date.now() + (seg + extra) * 1000;
  }
  function vCoach(e) {
    if (!e.coach) return '';
    const u = U(), empezado = e.sets.some(x => x.done);
    const aj = e.ajuste ? `<div class="coach-a">${esc(e.ajuste)}</div>` : '';
    if (empezado) return aj ? `<div class="coach mt10">${aj}</div>` : '';
    const sets = e.sets, kg = sets[0].kg, reps = sets.map(x => x.reps), rpes = sets.map(x => x.trpe).filter(v => v != null);
    const repsTxt = reps.every(r => r === reps[0]) ? reps[0] + ' reps' : reps.join(', ') + ' reps';
    const rpeTxt = rpes.length ? 'RPE ' + (rpes[0] === rpes[rpes.length - 1] ? fRpe(rpes[0]) : fRpe(rpes[0]) + '→' + fRpe(rpes[rpes.length - 1])) : '';
    const kgTxt = kg > 0 ? fv(kg) + ' ' + u : e.coach.tipo === 'primera' ? 'elige peso' : 'peso corporal';
    return `<div class="coach t-${e.coach.tipo} mt10">
      <div class="between"><span class="cap">ENTRENADOR</span><span class="coach-t">${esc(e.coach.titulo)}</span></div>
      <div class="c coach-plan">${sets.length} × ${kgTxt} · ${repsTxt}${rpeTxt ? ' · ' + rpeTxt : ''}</div>
      <div class="coach-m">${esc(e.coach.motivo)}</div>${aj}</div>`;
  }
  function resumen(a) {
    const p = progreso(a), prs = [];
    let rs = 0, rn = 0, sobre = 0;
    a.ejercicios.forEach(e => {
      const ds = e.sets.filter(s => s.done && s.reps > 0);
      ds.forEach(s => { if (s.rpe) { rs += s.rpe; rn++; if (e.cap && s.rpe > e.cap) sobre++; } });
      const hist = historialEj(e.nombre);
      if (!ds.length || !hist.length) return;
      const hs = hist.flatMap(h => h.sets);
      const pBest = Math.max(...hs.map(s => s.kg)), pOrm = Math.max(...hs.map(s => epley(s.kg, s.reps)));
      const best = Math.max(...ds.map(s => s.kg)), orm = Math.max(...ds.map(s => epley(s.kg, s.reps)));
      if (best > 0 && best > pBest + 1e-6) prs.push({ nombre: e.nombre, tipo: 'Mejor peso', v: best, c: '#C5CCD8' });
      else if (orm > 0 && orm > pOrm + 1e-6) prs.push({ nombre: e.nombre, tipo: '1RM estimado', v: orm, c: '#5C86C9' });
    });
    return { ...p, prs, rpe: rn ? rs / rn : null, sobre };
  }
  function aproximacion(kg, equipo) {
    return [[.5, '5'], [.7, '3'], [.85, '1-2']].map(([p, r]) => fv(Coach.redondear(kg * p, equipo, U())) + '×' + r).join(' → ') + ' → ' + fv(kg) + ' ' + U();
  }
  function bloquePrevio(a) {
    const nada = a.ejercicios.every(e => e.sets.every(s => !s.done));
    let h = '';
    if (nada && PRG.calentamiento) {
      h += ui.calent
        ? `<div class="card info mt14"><button class="fold" data-act="calent"><span class="cap">CALENTAMIENTO · 8–10 MIN</span><span class="mu">Ocultar</span></button>
          <div class="info-l">${esc(PRG.calentamiento.general)}</div><div class="info-l">Movilidad: ${esc(a.movilidad || PRG.calentamiento.movilidad)}</div></div>`
        : `<div class="card info mt14"><button class="fold" data-act="calent"><span class="cap">CALENTAMIENTO · 8–10 MIN</span><span class="mu">Ver ›</span></button></div>`;
    }
    const e0 = a.ejercicios[0];
    if (a.exi === 0 && e0.sets.every(s => !s.done) && e0.sets[0].kg > 0) {
      h += `<div class="card info mt10"><div class="cap">APROXIMACIÓN · SOLO EN EL PRIMERO</div><div class="info-l c" style="font-size:20px;color:var(--tx)">${aproximacion(e0.sets[0].kg, e0.equipo)}</div>${PRG.calentamiento && PRG.calentamiento.aproximacion ? `<div class="info-l">${esc(PRG.calentamiento.aproximacion)}</div>` : ''}</div>`;
    }
    if (nada && a.descarga && PRG.descarga) h += `<div class="notes" style="color:var(--b1)">Descarga: mismo peso que la semana pasada, mitad de series y RPE ${esc(PRG.descarga.rpe)}.</div>`;
    if (nada && a.nota) h += `<div class="notes">${esc(a.nota)}</div>`;
    return h;
  }

  // ---------- Fotos (IndexedDB) ----------
  const FotoDB = {
    db: null,
    open() {
      if (this.db) return Promise.resolve(this.db);
      return new Promise((res, rej) => {
        const r = indexedDB.open('fuerza-fotos', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('fotos', { keyPath: 'id' });
        r.onsuccess = () => res(this.db = r.result);
        r.onerror = () => rej(r.error);
      });
    },
    async tx(mode, fn) {
      const db = await this.open();
      return new Promise((res, rej) => {
        const req = fn(db.transaction('fotos', mode).objectStore('fotos'));
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
    },
    all() { return this.tx('readonly', s => s.getAll()); },
    put(f) { return this.tx('readwrite', s => s.put(f)); },
    del(id) { return this.tx('readwrite', s => s.delete(id)); }
  };
  async function cargarFotos() {
    try {
      const all = await FotoDB.all();
      ui.fotos.forEach(f => URL.revokeObjectURL(f.url));
      ui.fotos = all.sort((a, b) => a.fecha.localeCompare(b.fecha)).map(f => ({ id: f.id, fecha: f.fecha, ang: f.ang, url: URL.createObjectURL(f.blob) }));
      if (ui.screen === 'progreso') render();
    } catch (e) { /* IndexedDB no disponible */ }
  }
  async function comprimir(file) {
    const src = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
      const k = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return await new Promise(res => c.toBlob(res, 'image/jpeg', 0.82));
    } finally { URL.revokeObjectURL(src); }
  }

  // ---------- Estado de interfaz ----------
  const ui = {
    screen: D.activo ? (D.activo.fin ? 'summary' : 'workout') : 'hoy',
    ptab: 'peso', ang: 0, cmp: 50, antes: {}, lift: null,
    edit: null, swap: null, checkin: null, picker: null, calent: false, ajustes: !D.ajustes.onboarded, bw: '', nuevoPeso: '', fotos: []
  };
  const scrollPos = {};
  let lastScreen = null, lastRest = restLeft(D.activo);

  // ---------- Iconos ----------
  const I = {
    hoy: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    rut: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h.01M3 12h.01M3 19h.01M8 5h13M8 12h13M8 19h13"/></svg>',
    bolt: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
    pro: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 14l4-4 4 3 5-6"/></svg>'
  };
  function anillo(v, color, size = 64) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" fill="none" stroke="#1E2738" stroke-width="6"/><circle cx="32" cy="32" r="27" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(clamp(v, 0, 100) / 100) * 170} 170" transform="rotate(-90 32 32)"/></svg>`;
  }
  const tamNombre = n => n.length > 16 ? 36 : n.length > 11 ? 42 : 52;

  function vistaPrevia(r) {
    const desc = !!(enDescarga() && PRG.descarga);
    const filas = ejerciciosDe(r).filter(e => !e.opcional).slice(0, 2).map(e => {
      const p = planDe(e, seriesPlan(e), null, desc), t = p.sets[0];
      if (!(t.kg > 0)) return '';
      return `<div class="between" style="gap:10px"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.nombre)}</span><b style="flex:none">${fv(t.kg)} ${U()} × ${t.reps}</b></div>`;
    }).filter(Boolean);
    return filas.length ? `<div class="preview mt12"><div class="cap" style="color:#fff;opacity:.75">TU ENTRENADOR PROPONE</div>${filas.join('')}</div>` : '';
  }

  // ---------- Pantalla: Hoy ----------
  function vHoy() {
    const now = new Date(), nombre = D.ajustes.nombre.trim();
    const mon = lunes(now).getTime(), hoyIdx = (now.getDay() + 6) % 7;
    const semana = sesionesDesde(mon, mon + 7 * DAY);
    const hechos = new Set(semana.map(s => (new Date(s.fecha).getDay() + 6) % 7));
    const week = DIAS.map((l, i) => `<div class="wd"><div class="wd-c${hechos.has(i) ? ' on' : ''}${i === hoyIdx ? ' today' : ''}">${hechos.has(i) ? '✓' : ''}</div><div class="wd-l">${l}</div></div>`).join('');
    const vol = volumenSemana(), rpeS = rpeMedio(semana);

    const ultimoGrupo = {};
    D.sesiones.forEach(s => s.ejercicios.forEach(e => { const g = grupoRecup(e.grupo); if (g) ultimoGrupo[g] = new Date(s.fecha).getTime(); }));
    const recov = RECUP.map(([g, c]) => {
      const t = ultimoGrupo[g], v = t ? clamp(Math.round((Date.now() - t) / 3600000 / 72 * 100), 0, 100) : 100;
      return `<div class="ring">${anillo(v, c)}<div class="ring-v c">${v}</div><div style="font-size:12px" class="mu">${g}</div></div>`;
    }).join('');

    let hero;
    const a = D.activo, wcap = 'class="cap" style="color:#fff;opacity:.85"';
    if (a) {
      const p = progreso(a), otroDia = new Date(a.inicio).setHours(0, 0, 0, 0) !== hoy0();
      hero = `<div ${wcap}>${otroDia ? 'SIN CERRAR · ' + DIA_NOMBRE[diaSemana(new Date(a.inicio))].toUpperCase() + ' ' + fechaCorta(a.inicio) : 'EN CURSO · <span data-clock>' + clockTxt(a) + '</span>'}</div>
        <div class="c" style="font-size:${tamNombre(a.nombre)}px;line-height:.95;margin-top:6px">${esc(a.nombre)}</div>
        <div style="font-size:14px;margin-top:6px;opacity:.9">${p.done} de ${p.total} series completadas${otroDia ? ' · ciérrala para registrarla' : ''}</div>
        <button class="btn btn-w btn-white mt16" data-act="resume">${otroDia ? 'Cerrar sesión pendiente' : 'Continuar entrenamiento'}</button>
        <button class="btn-link" style="color:rgba(255,255,255,.75);margin-top:6px" data-act="discard">Descartar</button>`;
    } else {
      const h = rutinaHoy();
      if (!h) {
        hero = `<div ${wcap}>SIN RUTINAS</div>
          <div class="c" style="font-size:44px;line-height:.95;margin-top:6px">EMPIEZA AQUÍ</div>
          <div style="font-size:14px;margin-top:6px;opacity:.9">Crea tu primera rutina para empezar a entrenar.</div>
          <button class="btn btn-w btn-white mt16" data-act="go" data-k="rutinas">Crear rutina</button>`;
      } else if (h.tipo === 'hoy') {
        const r = h.r;
        hero = `<div ${wcap}>HOY · DÍA ${h.n} DE ${h.total}${r.dia ? ' · ' + DIA_NOMBRE[r.dia].toUpperCase() : ''}</div>
          <div class="c" style="font-size:${tamNombre(r.nombre)}px;line-height:.95;margin-top:6px">${esc(r.nombre)}</div>
          <div style="font-size:14px;margin-top:6px;opacity:.9">${ejerciciosDe(r).filter(e => !e.opcional).length} ejercicios · ${seriesRutina(r)} series · ${enDescarga() && PRG.descarga ? '~' + estMin(r) + ' min · descarga' : r.duracion ? esc(r.duracion) : '~' + estMin(r) + ' min'}</div>
          <div style="font-size:13px;margin-top:2px;opacity:.75">${esc(enfoque(r))}${PRG.cardio ? ' · + cardio' : ''}</div>
          ${vistaPrevia(r)}
          <button class="btn btn-w btn-white mt16" data-act="start" data-id="${esc(r.id)}">Empezar entrenamiento</button>`;
      } else if (h.tipo === 'hecha') {
        hero = `<div ${wcap}>HOY · COMPLETADO ✓</div>
          <div class="c" style="font-size:${tamNombre(h.r.nombre)}px;line-height:.95;margin-top:6px">${esc(h.r.nombre)}</div>
          <div style="font-size:14px;margin-top:6px;opacity:.9">${h.prox ? 'Próxima: ' + DIA_NOMBRE[h.prox.dia] + ' · ' + esc(h.prox.nombre) : 'Buen trabajo.'}</div>
          <button class="btn btn-w btn-white mt16" data-act="go" data-k="progreso">Ver progreso</button>`;
      } else {
        const libre = (PRG.diasLibres || {})[h.d] || { titulo: 'DESCANSO', nota: '' };
        hero = `<div ${wcap}>HOY · ${DIA_NOMBRE[h.d].toUpperCase()}</div>
          <div class="c" style="font-size:${tamNombre(libre.titulo)}px;line-height:.95;margin-top:6px">${esc(libre.titulo)}</div>
          <div style="font-size:14px;margin-top:6px;opacity:.9">${esc(libre.nota)}</div>
          ${h.prox ? `<div style="font-size:13px;margin-top:8px;opacity:.75">Próxima: ${DIA_NOMBRE[h.prox.dia]} · ${esc(h.prox.nombre)}</div>` : ''}
          <button class="btn btn-w btn-ghost mt16" style="border-color:rgba(255,255,255,.5)" data-act="go" data-k="rutinas">Entrenar otra rutina</button>`;
      }
    }

    const desc = enDescarga(), alerta = !desc && alertaDescarga(), sem = semanaPrograma();
    let avisos = '';
    if (desc) avisos += `<div class="card mt14 aviso"><div class="cap" style="color:var(--b1)">SEMANA DE DESCARGA</div><div style="font-weight:700;margin-top:4px">${fechaCorta(parseDia(desc[0]))} – ${fechaCorta(parseDia(desc[1]))}</div>${PRG.descarga ? `<div class="mu" style="font-size:13px;margin-top:4px;line-height:1.4">${esc(PRG.descarga.nota)}</div>` : ''}</div>`;
    if (alerta) avisos += `<div class="card mt14 aviso warn"><div class="cap" style="color:var(--warn)">TOCA DESCARGA</div><div style="font-size:14px;margin-top:4px">RPE medio ${fRpe(alerta.w2)} y ${fRpe(alerta.w1)} las dos últimas semanas (umbral ${alerta.um}).</div></div>`;

    return `
      <div class="between">
        <div><div class="lbl">${DIA_NOMBRE[diaSemana(now)]} ${now.getDate()} ${MESES[now.getMonth()]}${sem ? ' · semana ' + sem.n + ' de ' + sem.total : ''}${navigator.onLine ? '' : ' · <span class="offline">sin conexión ●</span>'}</div>
        <div style="font-size:26px;font-weight:700;letter-spacing:-.5px">Hola${nombre ? ', ' + esc(nombre) : ''}</div></div>
        <button class="avatar" data-act="ajustes" aria-label="Ajustes">${esc((nombre[0] || '⚙').toUpperCase())}</button>
      </div>
      <div class="card" style="margin-top:20px">
        <div class="between" style="align-items:baseline"><div class="lbl">RACHA SEMANAL</div>
        <div><span class="c" style="font-size:34px;color:var(--si)">${racha()}</span><span class="mu" style="font-size:12px"> ${racha() === 1 ? 'semana' : 'semanas'}</span></div></div>
        <div class="week">${week}</div>
        ${vol.plan ? `<div class="between mt12" style="font-size:13px"><span class="mu">Series esta semana <b style="color:var(--tx)">${vol.hecho}</b> / ${vol.plan}</span><span class="mu">RPE medio <b style="color:${rpeS && rpeS > (PRG.umbralDescarga || 9.3) ? 'var(--warn)' : 'var(--tx)'}">${rpeS ? fRpe(rpeS) : '—'}</b></span></div>
        <div class="bar mt8"><div style="width:${clamp(vol.hecho / vol.plan * 100, 0, 100)}%"></div></div>` : ''}
      </div>
      ${avisos}
      <div class="hero mt14">${hero}</div>
      <div class="card mt14">
        <div class="lbl" style="margin-bottom:12px">RECUPERACIÓN</div>
        <div class="between">${recov}</div>
      </div>`;
  }

  // ---------- Pantalla: Entrenamiento ----------
  function vWorkout() {
    const a = D.activo, p = progreso(a), u = U();
    const pct = p.total ? p.done / p.total * 100 : 0;
    let body;
    if (a.view === 'ex') {
      const chips = a.ejercicios.map((e, i) => `<button class="chip${a.exi === i ? ' on' : ''}" data-act="chip" data-i="${i}">${e.sets.every(x => x.done) ? '✓ ' : (i + 1) + '. '}${esc(e.nombre)}</button>`).join('');
      const e = a.ejercicios[a.exi], ei = a.exi;
      const rows = e.sets.map((x, si) => `
        <div class="setgrid setrow${x.done ? ' done' : ''}">
          <span class="c mu" style="font-size:20px">${si + 1}</span>
          <span class="mu" style="font-size:12px;line-height:1.2">${x.pk != null ? fv(x.pk) + '×' + x.pr + (x.prpe ? '<br>@' + fRpe(x.prpe) : '') : '—'}</span>
          <button class="num pick" data-act="peso" data-ei="${ei}" data-si="${si}" aria-label="Peso serie ${si + 1}">${fv(x.kg)}</button>
          <input class="num" value="${x.reps}" inputmode="numeric" data-in="reps" data-ei="${ei}" data-si="${si}" aria-label="Reps serie ${si + 1}">
          <input class="num${x.rpe && e.cap && x.rpe > e.cap ? ' over' : ''}" value="${x.rpe ? fRpe(x.rpe) : ''}" placeholder="${x.trpe != null ? fRpe(x.trpe) : '–'}" inputmode="decimal" data-in="rpe" data-ei="${ei}" data-si="${si}" aria-label="RPE serie ${si + 1}">
          <button class="check${x.done ? ' on' : ''}" data-act="toggle" data-ei="${ei}" data-si="${si}" aria-label="Completar serie ${si + 1}">${x.done ? '✓' : ''}</button>
        </div>`).join('');
      const canRm = e.sets.length > 1 && !e.sets[e.sets.length - 1].done;
      body = `
        <div class="chips mt14">${chips}</div>
        ${bloquePrevio(a)}
        ${vCoach(e)}
        <div class="card mt14" style="padding:16px 12px 12px">
          <div class="ex-head" style="margin-bottom:10px"><div class="ex-tag" style="height:36px;background:${e.color}"></div>
          <div style="flex:1;min-width:0"><div class="ex-name">${esc(e.nombre)}</div><div class="mu" style="font-size:12px">${esc(e.meta)}</div>${e.nombre !== e.original ? `<div class="mu" style="font-size:12px">Sustituye a ${esc(e.original)}</div>` : ''}</div>
          ${e.opciones.length > 1 ? `<button class="btn-sm" data-act="swap" data-ei="${ei}">Cambiar</button>` : ''}</div>
          <div class="setgrid sethead"><span>#</span><span>ANTERIOR</span><span>${u.toUpperCase()}</span><span>REPS</span><span>RPE</span><span>✓</span></div>
          ${rows}
          <div class="row" style="gap:8px;margin-top:2px">
            <button class="btn-dash" data-act="addSet" data-ei="${ei}">+ Añadir serie</button>
            ${canRm ? `<button class="btn-dash" style="width:110px" data-act="rmSet" data-ei="${ei}">− Quitar</button>` : ''}
          </div>
        </div>
        ${e.notas ? `<div class="notes">${esc(e.notas)}</div>` : ''}`;
    } else {
      body = vFocus(a);
    }
    return `
      <div class="between">
        <button class="btn-link" data-act="exit">‹ Salir</button>
        <div style="text-align:center;min-width:0"><div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px">${esc(a.nombre)}</div>
        <div class="c" style="font-size:22px;color:var(--b1);line-height:1" data-clock>${clockTxt(a)}</div></div>
        <button class="btn-out" data-act="finish">Terminar</button>
      </div>
      <div class="seg mt14"><button class="${a.view === 'ex' ? 'on' : ''}" data-act="view" data-v="ex">Por ejercicio</button><button class="${a.view === 'focus' ? 'on' : ''}" data-act="view" data-v="focus">Enfoque</button></div>
      <div class="between" style="margin:16px 0 4px;font-size:13px;color:var(--mu)"><span data-prog-n>${p.done} de ${p.total} series</span><span data-prog-v>Vol. ${fmt(fv(p.vol))} ${u}</span></div>
      <div class="bar"><div style="width:${pct}%"></div></div>
      ${body}`;
  }
  function vFocus(a) {
    const ce = a.ejercicios[a.exi], u = U();
    let si = ce.sets.findIndex(x => !x.done);
    const allDone = si < 0;
    if (allDone) si = ce.sets.length - 1;
    const cs = ce.sets[si], rest = restLeft(a);
    const dots = ce.sets.map((x, i) => `<div style="background:${x.done ? ce.color : i === si ? '#8F9AAE' : '#1E2738'}"></div>`).join('');
    const last = a.exi === a.ejercicios.length - 1;
    const nextLabel = last ? 'Terminar entrenamiento' : 'Siguiente: ' + esc(a.ejercicios[a.exi + 1].nombre) + ' ›';
    let inner;
    if (rest > 0) {
      const dash = Math.min(1, rest / (a.restTotal || 1)) * 653;
      inner = `
        <div class="mt18" style="display:flex;flex-direction:column;align-items:center">
          <div style="position:relative;width:240px;height:240px">
            <svg width="240" height="240" viewBox="0 0 240 240"><circle cx="120" cy="120" r="104" fill="none" stroke="#1E2738" stroke-width="14"/><circle data-rest-ring cx="120" cy="120" r="104" fill="none" stroke="#9FB4D6" stroke-width="14" stroke-linecap="round" stroke-dasharray="${dash} 700" transform="rotate(-90 120 120)" style="transition:stroke-dasharray .5s linear"/></svg>
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><div class="cap" style="letter-spacing:2px">DESCANSO</div><div class="c" style="font-size:84px;line-height:1;color:var(--b1)" data-rest-txt>${mmss(rest)}</div></div>
          </div>
          <div class="mu" style="margin-top:12px;font-size:13px">${allDone ? 'Ejercicio completo' : 'Siguiente · Serie ' + (si + 1) + ' · ' + fv(cs.kg) + ' ' + u + ' × ' + cs.reps}</div>
          ${a.restExtra ? `<div style="margin-top:4px;font-size:13px;color:var(--warn)">+${a.restExtra} s por serie a RPE 9 o más</div>` : ''}
          ${a.descarga ? '<div class="mu" style="margin-top:4px;font-size:12px">Descarga: puedes acortar el descanso 30 s</div>' : a.exi < 2 && !allDone ? '<div class="mu" style="margin-top:4px;font-size:12px">Básico: no acortes este descanso</div>' : ''}
          <div class="row" style="gap:10px;width:100%;margin-top:14px">${a.descarga ? '<button class="btn btn-ghost" style="flex:1" data-act="restSub">−30 s</button>' : ''}<button class="btn btn-ghost" style="flex:1" data-act="restAdd">+15 s</button><button class="btn btn-b1" style="flex:2" data-act="restSkip">${a.descarga ? 'Saltar' : 'Saltar descanso'}</button></div>
        </div>`;
    } else if (allDone) {
      const vol = ce.sets.reduce((s, x) => s + x.kg * x.reps, 0);
      inner = `
        <div style="margin-top:28px;text-align:center"><div style="width:96px;height:96px;border-radius:50%;background:var(--ac);color:var(--app);display:grid;place-items:center;font:800 48px 'DM Sans';margin:0 auto">✓</div>
        <div class="c" style="font-size:36px;margin-top:12px">EJERCICIO COMPLETO</div>
        <div class="mu" style="font-size:14px;margin-top:4px">${ce.sets.length} series · ${fmt(fv(vol))} ${u} de volumen</div></div>
        <button class="btn btn-w btn-ac btn-big" style="margin-top:22px;font-size:18px" data-act="nextEx">${nextLabel}</button>`;
    } else {
      const chips = RPES.map(v => `<button class="rpe${cs.rpe === v ? ' on' : ''}${ce.cap && v > ce.cap ? ' over' : ''}${cs.trpe === v ? ' target' : ''}" data-act="rpe" data-v="${v}">${v}</button>`).join('');
      inner = `
        <div class="mt18" style="text-align:center"><div class="c" style="font-size:18px;letter-spacing:2px;color:${ce.color}">SERIE ${si + 1} DE ${ce.sets.length}</div>
        <div class="mu" style="font-size:13px;margin-top:2px">Anterior · ${cs.pk != null ? fv(cs.pk) + ' × ' + cs.pr + (cs.prpe ? ' @ RPE ' + fRpe(cs.prpe) : '') : '—'}</div></div>
        ${vCoach(ce)}
        <div class="grid2 mt14" style="gap:12px">
          <div class="pad"><div class="cap">${u.toUpperCase()}</div><button class="c pad-v pick" data-act="peso" data-ei="${a.exi}" data-si="${si}" aria-label="Elegir peso">${fv(cs.kg)}</button><div class="row" style="gap:8px;justify-content:center"><button class="step" data-act="kgM" aria-label="Menos peso">−</button><button class="step" data-act="kgP" aria-label="Más peso">+</button></div></div>
          <div class="pad"><div class="cap">REPS</div><div class="c pad-v">${cs.reps}</div><div class="row" style="gap:8px;justify-content:center"><button class="step" data-act="repM" aria-label="Menos reps">−</button><button class="step" data-act="repP" aria-label="Más reps">+</button></div></div>
        </div>
        <div class="between mt14"><div class="cap">RPE</div><div class="mu" style="font-size:12px">${cs.trpe != null ? 'Objetivo <b style="color:var(--tx)">' + fRpe(cs.trpe) + '</b>' + (ce.cap ? ' · techo ' + fRpe(ce.cap) : '') : ce.rpe ? 'Objetivo ' + esc(ce.rpe) : 'Opcional'}</div></div>
        <div class="rpes mt8">${chips}</div>
        <button class="btn btn-w btn-ac btn-big glow mt14" data-act="complete">Completar serie ✓</button>
        ${ce.notas ? `<div class="notes">${esc(ce.notas)}</div>` : ''}`;
    }
    return `
      ${bloquePrevio(a)}
      <div class="ex-head mt18"><div class="ex-tag" style="height:44px;background:${ce.color}"></div>
        <div style="flex:1;min-width:0"><div class="ex-name">${esc(ce.nombre)}</div><div class="mu" style="font-size:12px">${esc(ce.meta)}</div>${ce.nombre !== ce.original ? `<div class="mu" style="font-size:12px">Sustituye a ${esc(ce.original)}</div>` : ''}</div>
        <div style="text-align:right;flex:none"><div class="c mu" style="font-size:20px">${a.exi + 1}/${a.ejercicios.length}</div>
        ${ce.opciones.length > 1 ? `<button class="btn-link" style="padding:0;font-size:12px;display:block;margin-left:auto" data-act="swap" data-ei="${a.exi}">Cambiar</button>` : ''}
        ${last ? '' : '<button class="btn-link" style="padding:0;font-size:12px" data-act="nextEx">Saltar ›</button>'}</div></div>
      <div class="dots">${dots}</div>
      ${inner}`;
  }
  function vSheetSwap() {
    const e = D.activo.ejercicios[ui.swap];
    const opts = e.opciones.map((n, i) => `<button class="opt${norm(n) === norm(e.nombre) ? ' on' : ''}" data-act="swapTo" data-n="${esc(n)}"><span>${esc(n)}</span><span class="mu" style="font-size:12px">${i === 0 ? 'Programado' : 'Alternativa'}</span></button>`).join('');
    return `<div class="sheet-bg" data-act="closeSwap"></div>
      <div class="sheet"><div class="grab"></div>
        <div class="c" style="font-size:28px">CAMBIAR EJERCICIO</div>
        <div class="mu" style="font-size:13px;margin:4px 0 12px">Solo para esta sesión. Las series sin completar se rellenan con tu última marca del ejercicio elegido.</div>
        <div style="display:flex;flex-direction:column;gap:8px">${opts}</div>
      </div>`;
  }

  function vProxima(a) {
    const items = proximaVez(a);
    if (!items.length) return '';
    const u = U();
    const filas = items.map(({ nombre, plan }) => {
      const t = plan.sets[0];
      return `<div class="prox t-${plan.tipo}"><div style="flex:1;min-width:0"><div style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(nombre)}</div><div class="mu" style="font-size:12px">${esc(plan.titulo)}</div></div><div class="c" style="font-size:22px;flex:none">${t.kg > 0 ? fv(t.kg) + ' ' + u + ' × ' + t.reps : t.reps + ' reps'}</div></div>`;
    }).join('');
    return `<div class="lbl mt18">PRÓXIMA VEZ · TU ENTRENADOR</div><div class="card mt8" style="padding:6px 14px">${filas}</div>`;
  }

  // ---------- Pantalla: Resumen ----------
  function vSummary() {
    const a = D.activo, r = resumen(a), u = U();
    const prs = r.prs.length
      ? r.prs.map(p => `<div class="pr" style="border:1px solid ${p.c}"><div class="star" style="background:${p.c}">★</div><div style="flex:1"><div style="font-weight:700">${esc(p.nombre)}</div><div class="mu" style="font-size:12px">${p.tipo}</div></div><div class="c" style="font-size:26px;color:${p.c}">${fv(p.v)} ${u}</div></div>`).join('')
      : `<div class="card empty">${D.sesiones.length ? 'Sin récords esta vez. ¡A por ellos la próxima!' : 'Primer entrenamiento registrado: a partir de ahora verás aquí tus récords.'}</div>`;
    let cardio = '';
    if (PRG.cardio) {
      const omitir = a.cardioOmitirSiRpe && r.rpe && r.rpe > a.cardioOmitirSiRpe;
      cardio = `<div class="card mt16" style="border-radius:18px;padding:14px">
        <div class="row" style="gap:12px"><div style="flex:1"><div style="font-weight:700">Cardio</div><div class="mu" style="font-size:12px">${esc(PRG.cardio.texto)}</div></div>
        <input class="num" style="width:70px" value="${esc(a.cardio)}" placeholder="min" inputmode="numeric" data-in="cardio" aria-label="Minutos de cardio"><span class="mu" style="font-size:14px">min</span></div>
        ${omitir ? `<div class="hint" style="margin:10px 0 0">RPE medio de hoy ${fRpe(r.rpe)} (> ${a.cardioOmitirSiRpe}): hoy toca omitir la cinta.</div>` : ''}
        <div class="mu" style="font-size:12px;margin-top:8px;line-height:1.4">${esc(a.descarga && PRG.descarga ? PRG.descarga.cardio : a.cardioNota || PRG.cardio.nota)}</div></div>`;
    }
    return `
      <button class="btn-link" data-act="back">‹ Seguir entrenando</button>
      <div style="text-align:center;margin-top:2px"><div class="cap">ENTRENAMIENTO COMPLETO</div><div class="c" style="font-size:${tamNombre(a.nombre) - 6}px;line-height:1">${esc(a.nombre)}</div></div>
      <div style="margin-top:18px;border-radius:26px;padding:22px;background:linear-gradient(135deg,#E6EBF5 0%,#8FA6CC 130%);color:var(--app);text-align:center">
        <div style="font-size:12px;font-weight:700;letter-spacing:1.5px">VOLUMEN TOTAL</div>
        <div class="c" style="font-size:78px;line-height:.95">${fmt(fv(r.vol))}<span style="font-size:30px"> ${u}</span></div>
      </div>
      <div class="grid3 mt10">
        <div class="stat"><div class="c" style="font-size:34px;color:var(--b2)">${r.done}</div><div class="mu" style="font-size:12px">series</div></div>
        <div class="stat"><div class="c" style="font-size:34px;color:var(--b1)">${clockTxt(a)}</div><div class="mu" style="font-size:12px">duración</div></div>
        <div class="stat"><div class="c" style="font-size:34px;color:${r.rpe && r.rpe > (PRG.umbralDescarga || 9.3) ? 'var(--warn)' : 'var(--si)'}">${r.rpe ? fRpe(r.rpe) : '—'}</div><div class="mu" style="font-size:12px">RPE medio</div></div>
      </div>
      ${r.sobre ? `<div class="hint">${r.sobre} ${r.sobre === 1 ? 'serie pasó' : 'series pasaron'} del techo de RPE. Ajusta la carga la próxima vez.</div>` : ''}
      <div class="lbl mt18">RÉCORDS NUEVOS · ${r.prs.length}</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">${prs}</div>
      ${vProxima(a)}
      ${cardio}
      <div class="card mt10 row" style="border-radius:18px;padding:14px;gap:12px">
        <div style="flex:1"><div style="font-weight:700">Peso corporal</div><div class="mu" style="font-size:12px">Opcional</div></div>
        <input class="num" style="width:80px" value="${esc(ui.bw)}" placeholder="${D.peso.length ? fv(D.peso[D.peso.length - 1].kg) : '—'}" inputmode="decimal" data-in="bw" aria-label="Peso corporal">
        <span class="mu" style="font-size:14px">${u}</span>
      </div>
      <button class="btn btn-w btn-ac mt16" style="font-size:17px" data-act="saveSummary">Guardar y cerrar</button>
      <div style="text-align:center"><button class="btn-link danger" data-act="discard">Descartar entrenamiento</button></div>`;
  }

  // ---------- Pantalla: Rutinas ----------
  function vRutinas() {
    const h = rutinaHoy(), destacada = h && (h.tipo === 'hoy' || h.tipo === 'hecha') ? h.r : null;
    const orden = D.rutinas.map((r, i) => ({ r, i })).sort((x, y) => (x.r.dia || 99) - (y.r.dia || 99));
    const cards = orden.map(({ r, i }) => {
      const hero = r === destacada;
      const sub = hero ? 'rgba(255,255,255,.85)' : 'var(--mu)';
      return `<div class="rut${hero ? ' hero-r' : ''}">
        <div class="between" style="align-items:flex-start;gap:10px">
          <div style="min-width:0">${r.dia ? `<div class="cap" style="color:${sub}">${DIA_NOMBRE[r.dia].toUpperCase()}</div>` : ''}<div class="c" style="font-size:32px;line-height:1">${esc(r.nombre)}</div>
          <div style="font-size:13px;margin-top:4px;color:${sub}">${ejerciciosDe(r, fechaDia(r)).length} ejercicios · ${seriesRutina(r, fechaDia(r))} series${enDescarga(fechaDia(r)) && PRG.descarga ? ' (descarga)' : ''} · ${ultimaVez(r.id)}</div></div>
          <div class="row" style="gap:6px;flex:none"><button class="btn-sm" data-act="editRut" data-i="${i}">Editar</button><button class="btn-sm solid" data-act="startRut" data-i="${i}" aria-label="Empezar ${esc(r.nombre)}">▶</button></div>
        </div>
        <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:12px">${r.ejercicios.map(e => `<span class="pill${vigente(e, fechaDia(r)) ? '' : ' futuro'}">${esc(e.nombre)}${vigente(e, fechaDia(r)) ? '' : ' · desde ' + fechaCorta(parseDia(e.desde))}</span>`).join('')}</div>
        ${r.nota ? `<div style="font-size:12px;margin-top:10px;color:${sub}">${esc(r.nota)}</div>` : ''}
      </div>`;
    }).join('');
    const total = D.rutinas.reduce((s, r) => s + seriesCompletas(r), 0);
    return `
      <div class="between"><div class="h1">Rutinas</div><button class="btn-out" data-act="newRut">+ Nueva</button></div>
      ${PRG.nombre ? `<div class="mu" style="font-size:13px;margin-top:4px">${esc(PRG.nombre)}${PRG.objetivo ? ' · ' + esc(PRG.objetivo) : ''} · ${total} series/semana</div>` : ''}
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:16px">${cards || '<div class="card empty">Aún no tienes rutinas. Crea una con “+ Nueva”.</div>'}</div>`;
  }
  function vSheetRutina() {
    const e = ui.edit;
    const rows = e.ejercicios.map((x, i) => `
      <div class="ex-edit">
        <span class="nm">${esc(x.nombre)}<br><span class="mu" style="font-size:11px">${esc(x.grupo)}${x.rpe ? ' · RPE ' + esc(x.rpe) : ''}</span></span>
        <input class="num" value="${x.series}" inputmode="numeric" data-in="exSeries" data-i="${i}" aria-label="Series">
        <input class="num" value="${esc(x.reps)}" data-in="exReps" data-i="${i}" aria-label="Reps">
        <button class="x" data-act="sheetRmEx" data-i="${i}" aria-label="Quitar">×</button>
      </div>`).join('');
    const known = nombresConocidos().map(k => `<option value="${esc(k.nombre)}">`).join('');
    return `
      <div class="sheet-bg" data-act="closeSheet"></div>
      <div class="sheet">
        <div class="grab"></div>
        <div style="display:grid;grid-template-columns:1fr 120px;gap:8px">
          <div><div class="field-l">NOMBRE</div><input class="input" style="margin:6px 0 12px" value="${esc(e.nombre)}" data-in="editNombre"></div>
          <div><div class="field-l">DÍA</div><select class="input" style="margin:6px 0 12px" data-in="editDia"><option value="">—</option>${DIA_NOMBRE.slice(1).map((d, i) => `<option value="${i + 1}"${e.dia === i + 1 ? ' selected' : ''}>${d}</option>`).join('')}</select></div>
        </div>
        <div class="field-l">ENFOQUE</div>
        <input class="input" style="margin:6px 0 14px;font-weight:500;font-size:15px" value="${esc(e.enfoque)}" placeholder="Pecho, hombro, tríceps" data-in="editEnfoque">
        <div class="between"><div class="field-l">EJERCICIOS</div><div class="mu" style="font-size:11px;display:grid;grid-template-columns:44px 72px 36px;gap:6px;text-align:center;padding-right:4px"><span>SERIES</span><span>REPS</span><span></span></div></div>
        <div style="display:flex;flex-direction:column;gap:6px;margin:6px 0 10px">${rows || '<div class="mu" style="font-size:13px;padding:8px 0">Sin ejercicios todavía.</div>'}</div>
        <div class="row" style="gap:6px">
          <input class="input" list="ejs" placeholder="Añadir ejercicio…" style="flex:1;min-width:0;font-weight:500;font-size:15px;height:44px" value="${esc(e.nuevo)}" data-in="nuevoEj">
          <select class="input" style="width:110px;height:44px" data-in="nuevoGrupo">${GRUPOS.map(g => `<option${g === e.nuevoGrupo ? ' selected' : ''}>${g}</option>`).join('')}</select>
          <button class="btn-out" style="height:44px;padding:0 14px" data-act="sheetAddEx">+</button>
        </div>
        <datalist id="ejs">${known}</datalist>
        <button class="btn btn-w btn-ac mt12" data-act="saveRut">Guardar rutina</button>
        ${e.idx >= 0 ? '<div style="text-align:center"><button class="btn-link danger" data-act="delRut">Eliminar rutina</button></div>' : ''}
      </div>`;
  }

  // ---------- Pantalla: Progreso ----------
  function vProgreso() {
    const tabs = [['peso', 'Peso'], ['fotos', 'Fotos'], ['fuerza', 'Fuerza']].map(([k, l]) => `<button class="${ui.ptab === k ? 'on' : ''}" data-act="ptab" data-k="${k}">${l}</button>`).join('');
    const body = ui.ptab === 'peso' ? vPeso() : ui.ptab === 'fotos' ? vFotos() : vFuerza();
    return `<div class="h1">Progreso</div><div class="seg lg mt12">${tabs}</div>${body}`;
  }
  function regresion(pts) {
    const n = pts.length;
    if (n < 2) return null;
    const mx = pts.reduce((s, p) => s + p.x, 0) / n, my = pts.reduce((s, p) => s + p.y, 0) / n;
    let num = 0, den = 0;
    pts.forEach(p => { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; });
    const b = den ? num / den : 0;
    return { a: my - b * mx, b };
  }
  function vPeso() {
    const u = U(), P = D.peso, meta = D.ajustes.metaPeso;
    const form = `<div class="card mt10 row" style="border-radius:18px;padding:14px;gap:10px">
      <div style="flex:1"><div style="font-weight:700">Registrar peso</div><div class="mu" style="font-size:12px">Hoy · ${fechaCorta(new Date())}</div></div>
      <input class="num" style="width:84px" value="${esc(ui.nuevoPeso)}" placeholder="${P.length ? fv(P[P.length - 1].kg) : '0.0'}" inputmode="decimal" data-in="nuevoPeso" aria-label="Peso de hoy">
      <button class="btn-out" style="height:44px" data-act="addPeso">Guardar</button></div>`;
    if (!P.length) return `<div class="card mt14 empty">Registra tu peso para ver la tendencia${meta ? '' : ' y fija una meta en Ajustes (toca tu inicial en Hoy)'}.</div>${form}`;

    const last = P[P.length - 1], tLast = parseDia(last.fecha).getTime();
    let ref = P[0];
    for (const p of P) if (parseDia(p.fecha).getTime() <= tLast - 7 * DAY) ref = p;
    const diff = last.kg - ref.kg;
    const trend = (diff <= 0 ? '▼ ' : '▲ ') + (U() === 'kg' ? Math.abs(Math.round(diff * 10) / 10).toFixed(1) : Math.round(Math.abs(diff) * LB));

    const pts = P.slice(-30), t0 = parseDia(pts[0].fecha).getTime(), t1 = parseDia(pts[pts.length - 1].fecha).getTime(), span = Math.max(DAY, t1 - t0);
    const vals = pts.map(p => p.kg).concat(meta ? [meta] : []);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi - lo < 1) { hi += .5; lo -= .5; }
    const pd = (hi - lo) * .12; lo -= pd; hi += pd;
    const X = t => 10 + (t - t0) / span * 300, Y = v => 10 + (hi - v) / (hi - lo) * 110;
    const xy = pts.map(p => ({ t: parseDia(p.fecha).getTime(), v: p.kg }));
    const raw = xy.map(p => X(p.t).toFixed(1) + ',' + Y(p.v).toFixed(1)).join(' ');
    const reg = regresion(xy.map(p => ({ x: (p.t - t0) / DAY, y: p.v })));
    const regLine = reg && pts.length > 2 ? `<polyline points="${X(t0)},${Y(reg.a).toFixed(1)} ${X(t1)},${Y(reg.a + reg.b * (t1 - t0) / DAY).toFixed(1)}" fill="none" stroke="#E6EBF5" stroke-width="3" stroke-linecap="round"/>` : '';
    const goal = meta ? `<line x1="0" y1="${Y(meta).toFixed(1)}" x2="320" y2="${Y(meta).toFixed(1)}" stroke="#9FB4D6" stroke-dasharray="5 5" stroke-width="1.5"/><text x="4" y="${(Y(meta) - 6).toFixed(1)}" fill="#9FB4D6" font-size="11">Meta ${fv(meta)} ${u}</text>` : '';
    const lp = xy[xy.length - 1];
    const chart = `<svg viewBox="0 0 320 140" width="100%" style="margin-top:12px">${goal}<polyline points="${raw}" fill="none" stroke="${pts.length > 2 ? '#2F3B52' : '#E6EBF5'}" stroke-width="2"/>${regLine}<circle cx="${X(lp.t).toFixed(1)}" cy="${Y(lp.v).toFixed(1)}" r="6" fill="#E6EBF5"/></svg>
      <div class="between mu" style="font-size:11px"><span>${fechaCorta(t0)}</span><span>${fechaCorta(t1)}</span></div>`;

    let metaCard = '';
    if (meta) {
      const start = P[0].kg, den = start - meta;
      const pct = den === 0 ? 1 : clamp((start - last.kg) / den, 0, 1);
      const falta = Math.abs(last.kg - meta);
      const rec = P.filter(p => parseDia(p.fecha).getTime() >= tLast - 28 * DAY).map(p => ({ x: (parseDia(p.fecha).getTime() - t0) / DAY, y: p.kg }));
      const rr = regresion(rec), rate = rr ? rr.b * 7 : 0;
      const hacia = rate !== 0 && Math.sign(rate) !== Math.sign(last.kg - meta);
      const eta = falta < 0.05 ? '¡Meta alcanzada!' : hacia ? '~' + Math.ceil(falta / Math.abs(rate)) + ' semanas a este ritmo' : 'Registra más días para estimar el ritmo';
      metaCard = `<div class="card mt10 row" style="border-radius:18px;padding:14px;gap:14px">${anillo(pct * 100, '#E6EBF5', 56)}
        <div><div style="font-weight:700">${Math.round(pct * 100)}% hacia la meta</div><div class="mu" style="font-size:12px">Faltan ${fv(falta)} ${u} · ${eta}</div></div></div>`;
    }
    return `
      <div class="card mt14">
        <div class="between" style="align-items:flex-end">
          <div><div class="field-l">PESO ACTUAL</div><div class="c" style="font-size:64px;line-height:.95">${fv(last.kg)}<span class="mu" style="font-size:24px"> ${u}</span></div></div>
          <div style="text-align:right"><div class="mu" style="font-size:12px">Tendencia 7 días</div><div class="c" style="font-size:28px;color:var(--ac)">${trend} ${u}</div></div>
        </div>
        ${chart}
      </div>
      ${metaCard}${form}`;
  }
  function vFotos() {
    const ang = ANGULOS[ui.ang];
    const fotos = ui.fotos.filter(f => f.ang === ang);
    const chips = ANGULOS.map((l, i) => `<button class="chip soft grow${ui.ang === i ? ' on' : ''}" data-act="ang" data-i="${i}">${l}</button>`).join('');
    const antesId = ui.antes[ang] && fotos.some(f => f.id === ui.antes[ang]) ? ui.antes[ang] : fotos[0] && fotos[0].id;
    const thumbs = fotos.slice().reverse().map(f => `<div class="thumb${f.id === antesId && fotos.length > 1 ? ' sel' : ''}" data-act="antes" data-id="${f.id}" role="button" aria-label="Usar como antes"><img src="${f.url}" alt=""><span class="tl">${fechaCorta(parseDia(f.fecha))}</span><button class="del" data-act="delFoto" data-id="${f.id}" aria-label="Eliminar foto">×</button></div>`).join('');
    let cmp;
    if (fotos.length >= 2) {
      const A = fotos.find(f => f.id === antesId), B = fotos[fotos.length - 1] === A ? fotos[fotos.length - 2] : fotos[fotos.length - 1];
      const [antes, despues] = A.fecha <= B.fecha ? [A, B] : [B, A];
      cmp = `<div class="lbl mt16">ANTES / DESPUÉS · <span style="color:var(--tx)">${ang}</span></div>
        <div class="compare mt8">
          <img src="${despues.url}" alt="Después"><div class="tag" style="right:12px;color:var(--ac)">DESPUÉS · ${fechaCorta(parseDia(despues.fecha))}</div>
          <div class="top" data-cmp-top style="clip-path:inset(0 ${100 - ui.cmp}% 0 0)"><img src="${antes.url}" alt="Antes"><div class="tag" style="left:12px;color:var(--b2)">ANTES · ${fechaCorta(parseDia(antes.fecha))}</div></div>
          <div class="handle-l" data-cmp-h style="left:${ui.cmp}%"></div><div class="handle" data-cmp-h style="left:${ui.cmp}%">⇆</div>
        </div>
        <input type="range" min="0" max="100" value="${ui.cmp}" data-in="cmp" style="width:100%;margin-top:10px" aria-label="Comparar">
        <div class="mu" style="font-size:12px;text-align:center">Toca una miniatura para elegir la foto de “antes”.</div>`;
    } else {
      cmp = `<div class="card empty mt16">Añade al menos dos fotos de ${ang.toLowerCase()} para comparar el antes y el después.</div>`;
    }
    return `
      <div class="row mu" style="margin-top:14px;gap:8px;font-size:12px"><span style="color:var(--ac)">●</span> Privadas · se guardan solo en este dispositivo</div>
      <div class="row mt10" style="gap:8px">${chips}</div>
      <div class="chips mt12" style="gap:10px;padding-bottom:4px"><button class="thumb-add" data-act="addFoto"><div style="font-size:26px">+</div>Añadir</button>${thumbs}</div>
      ${cmp}`;
  }
  function liftsHist() {
    const m = new Map();
    D.sesiones.forEach(s => s.ejercicios.forEach(e => {
      if (!e.sets.length) return;
      const nombre = canon(e.nombre), k = norm(nombre);
      if (!m.has(k)) m.set(k, { nombre, ses: [] });
      m.get(k).ses.push({ fecha: s.fecha, sets: e.sets });
    }));
    return [...m.values()].sort((a, b) => b.ses.length - a.ses.length);
  }
  function vVolumen() {
    const v = volumenSemana();
    if (!v.filas.length) return '';
    const filas = v.filas.map(f => `<div class="vol-row"><span>${esc(f.g)}</span><div class="bar"><div style="width:${f.plan ? clamp(f.hecho / f.plan * 100, 0, 100) : 100}%"></div></div><span class="mu">${f.hecho}/${f.plan}</span></div>`).join('');
    return `<div class="card mt14"><div class="between"><div class="lbl">SERIES ESTA SEMANA</div><div class="c" style="font-size:22px">${v.hecho}<span class="mu" style="font-size:15px"> / ${v.plan}</span></div></div><div class="mt10">${filas}</div></div>`;
  }
  function vFuerza() {
    const L = liftsHist(), u = U();
    if (!L.length) return vVolumen() + '<div class="card mt10 empty">Completa tu primer entrenamiento para ver aquí tu 1RM estimado, mejores marcas y récords por ejercicio.<br><button class="btn-out mt12" data-act="import">Importar historial de StrengthLab</button></div>';
    const cur = L.find(l => norm(l.nombre) === norm(ui.lift)) || L[0];
    const chips = L.slice(0, 15).map(l => `<button class="chip soft${l === cur ? ' on' : ''}" data-act="lift" data-n="${esc(l.nombre)}">${esc(l.nombre)}</button>`).join('');
    let best = { v: -1 }, orm = { v: -1 }, volS = { v: -1 }, reps = { v: -1 }, vol30 = 0;
    const desde = Date.now() - 30 * DAY;
    const serie = cur.ses.map(s => {
      let sv = 0, so = 0;
      s.sets.forEach(x => {
        const o = epley(x.kg, x.reps);
        sv += x.kg * x.reps; so = Math.max(so, o);
        if (x.kg > best.v) best = { v: x.kg, f: s.fecha };
        if (o > orm.v) orm = { v: o, f: s.fecha, b: x };
        if (x.reps > reps.v) reps = { v: x.reps, f: s.fecha, kg: x.kg };
      });
      if (sv > volS.v) volS = { v: sv, f: s.fecha };
      if (new Date(s.fecha).getTime() >= desde) vol30 += sv;
      return so;
    });
    let chart = '';
    const sv = serie.slice(-12);
    if (sv.length >= 2) {
      const lo = Math.min(...sv) * .97, hi = Math.max(...sv) * 1.03 || 1;
      const X = i => 10 + i / (sv.length - 1) * 300, Y = v => 8 + (hi - v) / ((hi - lo) || 1) * 64;
      chart = `<svg viewBox="0 0 320 80" width="100%" style="margin-top:10px"><polyline points="${sv.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ')}" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${sv.map((v, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3" fill="#fff"/>`).join('')}</svg>`;
    }
    const prs = [
      { t: 'Mejor peso', d: fechaCorta(best.f), v: fv(best.v) + ' ' + u, c: '#C5CCD8' },
      { t: '1RM estimado', d: fechaCorta(orm.f), v: fv(orm.v) + ' ' + u, c: '#5C86C9' },
      { t: 'Volumen en una sesión', d: fechaCorta(volS.f), v: fmt(fv(volS.v)) + ' ' + u, c: '#9FB4D6' },
      { t: 'Más repeticiones', d: fechaCorta(reps.f) + ' · ' + fv(reps.kg) + ' ' + u, v: reps.v, c: '#7C93BA' }
    ].map(p => `<div class="pr"><div class="star" style="background:${p.c}">★</div><div style="flex:1"><div style="font-weight:700">${p.t}</div><div class="mu" style="font-size:12px">${p.d}</div></div><div class="c" style="font-size:24px">${p.v}</div></div>`).join('');
    return `
      ${vVolumen()}
      <div class="chips mt14">${chips}</div>
      <div class="hero-strength mt12">
        <div class="cap" style="color:#fff;opacity:.85">1RM ESTIMADO</div>
        <div class="c" style="font-size:72px;line-height:.95">${fv(orm.v)}<span style="font-size:26px"> ${u}</span></div>
        <div style="font-size:13px;opacity:.9">Epley · basado en ${fv(orm.b.kg)} ${u} × ${orm.b.reps}</div>
        ${chart}
      </div>
      <div class="grid2 mt10">
        <div class="card" style="border-radius:18px;padding:14px"><div class="mu" style="font-size:12px">Mejor peso</div><div class="c" style="font-size:36px;color:var(--ac)">${fv(best.v)} <span class="mu" style="font-size:16px">${u}</span></div></div>
        <div class="card" style="border-radius:18px;padding:14px"><div class="mu" style="font-size:12px">Volumen del mes</div><div class="c" style="font-size:36px;color:var(--b1)">${fmt(fv(vol30))} <span class="mu" style="font-size:16px">${u}</span></div></div>
      </div>
      <div class="lbl mt16">RÉCORDS</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">${prs}</div>`;
  }

  // ---------- Ajustes ----------
  function vSheetAjustes() {
    const a = D.ajustes, u = U();
    return `
      <div class="sheet-bg" data-act="closeAjustes"></div>
      <div class="sheet">
        <div class="grab"></div>
        <div class="c" style="font-size:30px">${a.onboarded ? 'AJUSTES' : 'BIENVENIDO A FUERZA'}</div>
        ${a.onboarded ? '' : `<div class="mu" style="font-size:14px;margin:4px 0 8px">${PRG.nombre ? 'Ya está cargado tu ' + esc(PRG.nombre) + '. ' : ''}Revisa lo básico. Puedes cambiarlo cuando quieras tocando tu inicial.</div>`}
        <div class="field-l mt12">TU NOMBRE</div>
        <input class="input" style="margin-top:6px" value="${esc(a.nombre)}" placeholder="Nombre" data-in="aj-nombre">
        <div class="grid2 mt12">
          <div><div class="field-l">META DE PESO (${u})</div><input class="input" style="margin-top:6px" value="${a.metaPeso ? fv(a.metaPeso) : ''}" placeholder="Opcional" inputmode="decimal" data-in="aj-meta"></div>
          <div><div class="field-l">DÍAS / SEMANA</div><input class="input" style="margin-top:6px" value="${a.objetivoSemanal}" inputmode="numeric" data-in="aj-obj"></div>
        </div>
        <div class="grid2 mt12">
          <div><div class="field-l">DESCANSO (seg)</div><input class="input" style="margin-top:6px" value="${a.descanso}" inputmode="numeric" data-in="aj-desc"></div>
          <div><div class="field-l">UNIDAD</div><div class="seg" style="margin-top:6px;height:48px;align-items:center"><button class="${u === 'kg' ? 'on' : ''}" data-act="setUnit" data-u="kg">kg</button><button class="${u === 'lb' ? 'on' : ''}" data-act="setUnit" data-u="lb">lb</button></div></div>
        </div>
        <div class="mu" style="font-size:12px;margin-top:8px">Todo se guarda internamente en kg: cambiar de unidad no mezcla registros.</div>
        <button class="btn btn-w btn-ac mt16" data-act="closeAjustes">Listo</button>
        ${a.onboarded ? `
        <div class="field-l mt18">COPIA DE SEGURIDAD</div>
        <div class="mu" style="font-size:12px;margin-top:4px">Los datos viven en este dispositivo. Exporta una copia de vez en cuando (las fotos no se incluyen).</div>
        <div class="grid2 mt10"><button class="btn btn-ghost" data-act="export">Exportar</button><button class="btn btn-ghost" data-act="import">Importar</button></div>
        <div class="mu" style="font-size:12px;margin-top:6px">Importar acepta una copia de Fuerza (.json) o tu historial de StrengthLab (.csv), que se añade sin borrar nada.</div>
        <div style="text-align:center;margin-top:8px"><button class="btn-link danger" data-act="reset">Borrar todos los datos</button></div>` : ''}
      </div>`;
  }

  // ---------- Overlays (barra, descanso, pie) ----------
  function vOverlay() {
    let h = '';
    const a = D.activo, s = ui.screen;
    if (s === 'workout' && a && a.view === 'ex') {
      const last = a.exi === a.ejercicios.length - 1, rest = restLeft(a);
      h += `<div class="rest-banner" data-rest-banner style="${rest > 0 ? '' : 'display:none'}">
          <div style="flex:1"><div class="mu" style="font-size:11px;font-weight:700;letter-spacing:1px">DESCANSO</div><div class="c" style="font-size:34px;line-height:1;color:var(--b1)" data-rest-txt>${mmss(rest)}</div></div>
          <button class="btn btn-ghost" data-act="restAdd">+15s</button><button class="btn btn-b1" style="padding:0 16px" data-act="restSkip">Saltar</button>
        </div>
        <div class="footer">
          <button class="btn btn-ghost" style="flex:1;opacity:${a.exi === 0 ? .35 : 1}" data-act="prevEx">‹ Anterior</button>
          <button class="btn btn-ac" style="flex:2" data-act="nextEx">${last ? 'Terminar entrenamiento' : 'Siguiente: ' + esc(a.ejercicios[a.exi + 1].nombre) + ' ›'}</button>
        </div>`;
    }
    if (s === 'hoy' || s === 'rutinas' || s === 'progreso') {
      h += `<div class="tab-fade"></div>
        <nav class="tabbar">
          <button class="tab${s === 'hoy' ? ' on' : ''}" data-act="go" data-k="hoy">${I.hoy}Hoy</button>
          <button class="tab${s === 'rutinas' ? ' on' : ''}" data-act="go" data-k="rutinas">${I.rut}Rutinas</button>
          <button class="tab-main" data-act="train">${I.bolt}${a ? 'Seguir' : 'Entrenar'}</button>
          <button class="tab${s === 'progreso' ? ' on' : ''}" data-act="go" data-k="progreso">${I.pro}Progreso</button>
          <button class="tab" data-act="unit"><span class="u">${U()}</span>Unidad</button>
        </nav>`;
    }
    if (ui.edit) h += vSheetRutina();
    if (ui.swap != null && a && s === 'workout') h += vSheetSwap();
    if (ui.checkin) h += vSheetCheckin();
    if (ui.picker && a && s === 'workout') h += vSheetPeso();
    if (ui.ajustes) h += vSheetAjustes();
    if (pendiente) {
      h += `<div class="sheet-bg" style="z-index:30" data-act="confNo"></div>
        <div class="dialog" role="alertdialog" aria-modal="true"><div class="dialog-msg">${esc(pendiente.msg)}</div>
        <div class="grid2"><button class="btn btn-ghost" data-act="confNo">Cancelar</button><button class="btn ${pendiente.peligro ? 'btn-danger' : 'btn-ac'}" data-act="confSi">${esc(pendiente.ok)}</button></div></div>`;
    }
    return h;
  }

  // ---------- Render ----------
  const scrollEl = $('#scroll'), overlayEl = $('#overlay');
  function render() {
    if (lastScreen) scrollPos[lastScreen] = scrollEl.scrollTop;
    if (!D.activo && (ui.screen === 'workout' || ui.screen === 'summary')) ui.screen = 'hoy';
    const s = ui.screen;
    scrollEl.className = 'scroll' + (s === 'workout' ? ' workout' : '');
    scrollEl.innerHTML = s === 'hoy' ? vHoy() : s === 'workout' ? vWorkout() : s === 'summary' ? vSummary() : s === 'rutinas' ? vRutinas() : vProgreso();
    renderOverlay();
    scrollEl.scrollTop = s === lastScreen ? (scrollPos[s] || 0) : 0;
    lastScreen = s;
    wakeLock(s === 'workout');
  }
  function renderOverlay() { overlayEl.innerHTML = vOverlay(); }
  function updateProgress() {
    const a = D.activo; if (!a) return;
    const p = progreso(a), n = $('[data-prog-n]'), v = $('[data-prog-v]');
    if (n) n.textContent = p.done + ' de ' + p.total + ' series';
    if (v) v.textContent = 'Vol. ' + fmt(fv(p.vol)) + ' ' + U();
  }
  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function avisoRpe(e, rpe) { if (rpe && e.cap && rpe > e.cap) toast('RPE ' + fRpe(rpe) + ' supera el techo (' + e.rpe + ')'); }

  // ---------- Sonido, vibración y pantalla encendida ----------
  let audio;
  function alarma() {
    try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { /* sin vibración */ }
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      [0, .22].forEach(dt => {
        const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + dt;
        o.frequency.value = 880; o.connect(g); g.connect(audio.destination);
        g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.3, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .18);
        o.start(t); o.stop(t + .2);
      });
    } catch (e) { /* sin audio */ }
  }
  let lock = null;
  async function wakeLock(on) {
    try {
      if (on && !lock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { lock = null; });
      } else if (!on && lock) { await lock.release(); lock = null; }
    } catch (e) { lock = null; }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { wakeLock(ui.screen === 'workout'); tick(); } });

  function tick() {
    const a = D.activo;
    if (!a) return;
    const c = clockTxt(a);
    $$('[data-clock]').forEach(el => { el.textContent = c; });
    const r = restLeft(a);
    $$('[data-rest-txt]').forEach(el => { el.textContent = mmss(r); });
    const ring = $('[data-rest-ring]');
    if (ring) ring.setAttribute('stroke-dasharray', (Math.min(1, r / (a.restTotal || 1)) * 653) + ' 700');
    if (lastRest > 0 && r === 0) {
      a.restEnd = 0; save(); alarma();
      if (ui.screen === 'workout') { if (a.view === 'focus') render(); else { const b = $('[data-rest-banner]'); if (b) b.style.display = 'none'; } }
    }
    lastRest = r;
  }
  setInterval(tick, 500);

  // ---------- Acciones ----------
  async function empezar(r) {
    if (!r) return;
    if (!r.ejercicios.length) { toast('Esta rutina no tiene ejercicios'); return; }
    if (D.activo && !(await confirmar('Tienes un entrenamiento en curso. ¿Descartarlo y empezar ' + r.nombre + '?', 'Descartar y empezar', true))) return;
    ui.checkin = { rid: r.id, sueno: null, energia: null, dolor: null };
    renderOverlay();
  }
  function arrancar(r, estado) {
    D.activo = crearActivo(r, estado); lastRest = 0; save();
    ui.checkin = null; ui.screen = 'workout'; render();
    if (estado === 'rojo') toast('Hoy vas con −5% de carga y RPE más bajo');
    else if (estado === 'amarillo') toast('Hoy apuntamos medio punto de RPE más bajo');
  }
  function vSheetPeso() {
    const { ei, si } = ui.picker, e = D.activo.ejercicios[ei], x = e.sets[si], u = U();
    const escala = Coach.escala(e.equipo, u), actual = x.kg > 0 ? fv(x.kg) : null, previo = x.pk != null ? fv(x.pk) : null;
    let vals = escala.valores.slice();
    [actual, previo].forEach(v => { if (v != null && !vals.some(w => Math.abs(w - v) < 0.01)) vals.push(v); });
    vals.sort((p, q) => p - q);
    const centro = actual != null ? actual : previo != null ? previo : escala.inicio;
    const botones = vals.map(v => `<button class="pkb${actual != null && Math.abs(v - actual) < 0.01 ? ' on' : ''}${previo != null && Math.abs(v - previo) < 0.01 ? ' prev' : ''}"${Math.abs(v - centro) < 0.01 ? ' id="pk-centro"' : ''} data-act="pesoVal" data-v="${v}">${v}</button>`).join('');
    return `<div class="sheet-bg" data-act="pesoCerrar"></div>
      <div class="sheet"><div class="grab"></div>
        <div class="between"><div class="c" style="font-size:26px">PESO · SERIE ${si + 1}</div><div class="mu" style="font-size:13px">${u}</div></div>
        <div class="mu" style="font-size:13px;margin:2px 0 12px">${esc(e.nombre)} · ${esc(e.equipo || 'Equipo')}${previo != null ? ' · anterior <b style="color:var(--b1)">' + previo + ' ' + u + '</b>' : ''}</div>
        <div class="pkgrid" id="pkgrid">${botones}</div>
      </div>`;
  }
  function vSheetCheckin() {
    const c = ui.checkin;
    const fila = (k, titulo, ops) => `<div class="field-l mt12">${titulo}</div><div class="seg" style="margin-top:6px">${ops.map(([v, l]) => `<button class="${c[k] === v ? 'on' : ''}" data-act="ci" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
    return `<div class="sheet-bg" data-act="ciCerrar"></div>
      <div class="sheet"><div class="grab"></div>
        <div class="c" style="font-size:28px">¿CÓMO LLEGAS HOY?</div>
        <div class="mu" style="font-size:13px;margin-top:4px">Con esto ajusto la carga y el RPE de hoy.</div>
        ${fila('sueno', 'SUEÑO', [['poco', '< 6 h'], ['justo', '6–7 h'], ['bien', '7 h o más']])}
        ${fila('energia', 'ENERGÍA', [['baja', 'Baja'], ['normal', 'Normal'], ['alta', 'Alta']])}
        ${fila('dolor', 'DOLOR O AGUJETAS', [['mucho', 'Mucho'], ['algo', 'Algo'], ['nada', 'Nada']])}
        <button class="btn btn-w btn-ac mt16" data-act="ciEmpezar">Empezar</button>
        <div style="text-align:center"><button class="btn-link" data-act="ciSaltar">Saltar, voy normal</button></div>
      </div>`;
  }
  function setSet(ei, si, p) { Object.assign(D.activo.ejercicios[ei].sets[si], p); save(); }
  function focusSet() {
    const a = D.activo, ce = a.ejercicios[a.exi];
    let si = ce.sets.findIndex(x => !x.done);
    if (si < 0) si = ce.sets.length - 1;
    return { ce, si, cs: ce.sets[si] };
  }
  let pendiente = null;
  function confirmar(msg, ok = 'Confirmar', peligro = false) {
    if (pendiente) pendiente.res(false);
    return new Promise(res => { pendiente = { msg, ok, peligro, res }; renderOverlay(); });
  }
  function responder(v) { const p = pendiente; pendiente = null; renderOverlay(); if (p) p.res(v); }
  const A = {
    confSi: () => responder(true),
    peso: d => {
      ui.picker = { ei: +d.ei, si: +d.si }; renderOverlay();
      const g = $('#pkgrid'), c = $('#pk-centro');
      if (g && c) g.scrollTop = c.offsetTop - g.offsetTop - g.clientHeight / 2 + c.clientHeight / 2;
    },
    pesoVal: d => { const { ei, si } = ui.picker; setSet(ei, si, { kg: toKg(d.v), manual: true }); ui.picker = null; render(); },
    pesoCerrar: () => { ui.picker = null; renderOverlay(); },
    calent: () => { ui.calent = !ui.calent; render(); },
    ci: d => { ui.checkin[d.k] = ui.checkin[d.k] === d.v ? null : d.v; renderOverlay(); },
    ciCerrar: () => { ui.checkin = null; renderOverlay(); },
    ciSaltar: () => { const r = D.rutinas.find(x => x.id === ui.checkin.rid); arrancar(r, null); },
    ciEmpezar: () => { const c = ui.checkin, r = D.rutinas.find(x => x.id === c.rid); arrancar(r, Coach.estadoDia(c)); },
    confNo: () => responder(false),
    go: d => { ui.screen = d.k; ui.edit = null; render(); },
    ajustes: () => { ui.ajustes = true; renderOverlay(); },
    closeAjustes: () => { D.ajustes.onboarded = true; save(); ui.ajustes = false; render(); },
    setUnit: d => { D.ajustes.unidad = d.u; save(); render(); },
    unit: () => { D.ajustes.unidad = U() === 'kg' ? 'lb' : 'kg'; save(); render(); toast('Unidad: ' + U()); },
    start: d => empezar(D.rutinas.find(r => r.id === d.id)),
    startRut: d => empezar(D.rutinas[+d.i]),
    train: () => {
      if (D.activo) { ui.screen = D.activo.fin ? 'summary' : 'workout'; render(); return; }
      const h = rutinaHoy();
      if (h && h.tipo === 'hoy') empezar(h.r);
      else { ui.screen = 'rutinas'; render(); toast(h ? 'Elige qué rutina entrenar' : 'Crea una rutina para empezar'); }
    },
    resume: () => { ui.screen = D.activo.fin ? 'summary' : 'workout'; render(); },
    discard: async () => { if (!(await confirmar('¿Descartar este entrenamiento? No se guardará.', 'Descartar', true))) return; D.activo = null; save(); ui.screen = 'hoy'; render(); },
    exit: () => { ui.screen = 'hoy'; render(); },
    finish: () => { D.activo.fin = Date.now(); D.activo.restEnd = 0; lastRest = 0; save(); ui.screen = 'summary'; render(); },
    back: () => { D.activo.inicio += Date.now() - D.activo.fin; D.activo.fin = 0; save(); ui.screen = 'workout'; render(); },
    view: d => { D.activo.view = d.v; save(); render(); },
    chip: d => { D.activo.exi = +d.i; save(); render(); },
    prevEx: () => { const a = D.activo; if (a.exi > 0) { a.exi--; a.restEnd = 0; lastRest = 0; save(); render(); } },
    nextEx: () => { const a = D.activo; if (a.exi === a.ejercicios.length - 1) A.finish(); else { a.exi++; a.restEnd = 0; lastRest = 0; save(); render(); } },
    toggle: d => {
      const a = D.activo, e = a.ejercicios[+d.ei], x = e.sets[+d.si];
      x.done = !x.done;
      if (x.done) { iniciarDescanso(e.descanso, x.rpe); arrastrar(+d.ei, +d.si); const aj = ajustar(+d.ei, +d.si); if (aj) toast(aj.txt); else avisoRpe(e, x.rpe); } else { a.restEnd = 0; lastRest = 0; }
      save(); render();
    },
    addSet: d => { const e = D.activo.ejercicios[+d.ei], l = e.sets[e.sets.length - 1]; e.sets.push({ kg: l.kg, reps: l.reps, rpe: null, trpe: l.trpe, treps: l.treps, pk: null, pr: null, done: false }); save(); render(); },
    rmSet: d => { D.activo.ejercicios[+d.ei].sets.pop(); save(); render(); },
    kgM: () => { const { ce, si, cs } = focusSet(); setSet(D.activo.exi, si, { kg: Math.max(0, cs.kg - Coach.paso(Math.max(cs.kg, 1), ce.equipo, U())), manual: true }); render(); },
    kgP: () => { const { ce, si, cs } = focusSet(); setSet(D.activo.exi, si, { kg: cs.kg + Coach.paso(Math.max(cs.kg, 1), ce.equipo, U()), manual: true }); render(); },
    repM: () => { const { si, cs } = focusSet(); setSet(D.activo.exi, si, { reps: Math.max(0, cs.reps - 1) }); render(); },
    repP: () => { const { si, cs } = focusSet(); setSet(D.activo.exi, si, { reps: cs.reps + 1 }); render(); },
    rpe: d => { const { si, cs } = focusSet(), v = +d.v; setSet(D.activo.exi, si, { rpe: cs.rpe === v ? null : v }); render(); },
    complete: () => { const { ce, si, cs } = focusSet(); setSet(D.activo.exi, si, { done: true }); arrastrar(D.activo.exi, si); const aj = ajustar(D.activo.exi, si); if (aj) toast(aj.txt); else avisoRpe(ce, cs.rpe); iniciarDescanso(ce.descanso, cs.rpe); save(); render(); },
    restAdd: () => { const a = D.activo; if (restLeft(a) > 0) { a.restEnd += 15000; a.restTotal += 15; save(); tick(); } },
    restSkip: () => { D.activo.restEnd = 0; lastRest = 0; save(); render(); },
    restSub: () => { const a = D.activo; if (restLeft(a) > 30) { a.restEnd -= 30000; save(); tick(); } else A.restSkip(); },
    swap: d => { ui.swap = +d.ei; renderOverlay(); },
    closeSwap: () => { ui.swap = null; renderOverlay(); },
    swapTo: d => {
      const e = D.activo.ejercicios[ui.swap];
      if (norm(d.n) !== norm(e.nombre)) { const a = D.activo; e.nombre = d.n; prefill(e.sets, d.n, norm(d.n) === norm(e.original) ? e.kgBase : 0, e.repsBase); if (e.repsTxt) aplicarPlan(e, planDe({ nombre: d.n, grupo: e.grupo, equipo: e.equipo, reps: e.repsTxt, rpe: a.descarga ? PRG.descarga.rpe : e.rpeTxt, kg: norm(d.n) === norm(e.original) ? e.kgBase : 0 }, e.sets.filter(x => !x.done).length || e.sets.length, a.estado, a.descarga)); save(); }
      ui.swap = null; render();
    },
    saveSummary: async () => {
      const a = D.activo, r = resumen(a);
      const ejercicios = a.ejercicios.map(e => ({
        nombre: e.nombre, grupo: e.grupo, ...(e.nombre !== e.original ? { sustituye: e.original } : {}),
        sets: e.sets.filter(s => s.done).map(s => ({ kg: Math.round(s.kg * 100) / 100, reps: s.reps, ...(s.rpe ? { rpe: s.rpe } : {}) }))
      })).filter(e => e.sets.length);
      if (!ejercicios.length) { if (await confirmar('No completaste ninguna serie. ¿Descartar el entrenamiento?', 'Descartar', true)) { D.activo = null; save(); ui.screen = 'hoy'; render(); } return; }
      const fin = a.fin || Date.now();
      D.sesiones.push({
        id: uid(), fecha: new Date(fin).toISOString(), rutinaId: a.rutinaId, nombre: a.nombre, duracion: Math.round((fin - a.inicio) / 1000),
        rpeMedio: r.rpe ? Math.round(r.rpe * 100) / 100 : null, ...(a.estado ? { estado: a.estado } : {}), cardioMin: parseInt(a.cardio) || 0, ...(a.descarga ? { descarga: true } : {}), ejercicios
      });
      D.sesiones.sort((x, y) => x.fecha.localeCompare(y.fecha));
      const bw = toKg(ui.bw);
      if (bw > 0) registrarPeso(bw);
      D.activo = null; ui.bw = ''; save();
      ui.screen = 'hoy'; render(); toast('Entrenamiento guardado 💪');
    },
    // Rutinas
    newRut: () => { ui.edit = { idx: -1, nombre: 'NUEVA RUTINA', dia: null, enfoque: '', ejercicios: [], nuevo: '', nuevoGrupo: 'Pecho' }; renderOverlay(); },
    editRut: d => { const r = D.rutinas[+d.i]; ui.edit = { idx: +d.i, nombre: r.nombre, dia: r.dia, enfoque: r.enfoque || '', ejercicios: r.ejercicios.map(e => ({ ...e })), nuevo: '', nuevoGrupo: 'Pecho' }; renderOverlay(); },
    closeSheet: () => { ui.edit = null; renderOverlay(); },
    sheetRmEx: d => { ui.edit.ejercicios.splice(+d.i, 1); renderOverlay(); },
    sheetAddEx: () => {
      const e = ui.edit, n = e.nuevo.trim();
      if (!n) { toast('Escribe el nombre del ejercicio'); return; }
      const k = nombresConocidos().find(x => norm(x.nombre) === norm(n));
      e.ejercicios.push(normEj(k ? { ...k, series: k.series || 3, reps: k.reps || '8-10' } : { nombre: n, grupo: e.nuevoGrupo, series: 3, reps: '8-10' }));
      e.nuevo = ''; renderOverlay();
    },
    saveRut: () => {
      const e = ui.edit, nombre = e.nombre.trim().toUpperCase();
      if (!nombre) { toast('Ponle un nombre a la rutina'); return; }
      if (e.dia && D.rutinas.some((r, i) => i !== e.idx && r.dia === e.dia)) { toast('Ya hay una rutina el ' + DIA_NOMBRE[e.dia].toLowerCase()); return; }
      const data = { nombre, dia: e.dia || null, enfoque: e.enfoque.trim(), ejercicios: e.ejercicios.map(normEj) };
      if (e.idx >= 0) Object.assign(D.rutinas[e.idx], data); else D.rutinas.push(normRutina({ id: uid(), ...data }));
      ui.edit = null; save(); render(); toast('Rutina guardada');
    },
    delRut: async () => { const e = ui.edit; if (!(await confirmar('¿Eliminar ' + D.rutinas[e.idx].nombre + '? El historial se conserva.', 'Eliminar', true))) return; D.rutinas.splice(e.idx, 1); ui.edit = null; save(); render(); },
    // Progreso
    ptab: d => { ui.ptab = d.k; render(); },
    ang: d => { ui.ang = +d.i; ui.cmp = 50; render(); },
    lift: d => { ui.lift = d.n; render(); },
    addPeso: () => { const kg = toKg(ui.nuevoPeso); if (!(kg > 0)) { toast('Escribe tu peso'); return; } registrarPeso(kg); ui.nuevoPeso = ''; save(); render(); toast('Peso registrado'); },
    addFoto: () => $('#fileFoto').click(),
    antes: d => { ui.antes[ANGULOS[ui.ang]] = d.id; render(); },
    delFoto: async d => { if (!(await confirmar('¿Eliminar esta foto?', 'Eliminar', true))) return; try { await FotoDB.del(d.id); } catch (e) { /* ignorar */ } await cargarFotos(); render(); },
    // Copias
    export: () => {
      const blob = new Blob([JSON.stringify(D, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'fuerza-' + isoDia() + '.json';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    import: () => $('#fileImport').click(),
    reset: async () => { if (!(await confirmar('Se borrarán rutinas, historial y peso de este dispositivo.', 'Borrar todo', true))) return; localStorage.removeItem(KEY); D = load(); aplicarPrograma(); D.ajustes.onboarded = true; save(); ui.ajustes = false; ui.screen = 'hoy'; render(); }
  };
  function registrarPeso(kg) {
    const f = isoDia(), r = Math.round(kg * 100) / 100, ex = D.peso.find(p => p.fecha === f);
    if (ex) ex.kg = r; else { D.peso.push({ fecha: f, kg: r }); D.peso.sort((a, b) => a.fecha.localeCompare(b.fecha)); }
  }
  const leerRpe = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) || n <= 0 ? null : clamp(Math.round(n * 2) / 2, 1, 10); };

  const INPUTS = {
    reps: (el, d) => { setSet(+d.ei, +d.si, { reps: parseInt(el.value) || 0 }); updateProgress(); },
    rpe: (el, d) => {
      const v = leerRpe(el.value), e = D.activo.ejercicios[+d.ei];
      setSet(+d.ei, +d.si, { rpe: v });
      el.classList.toggle('over', !!(v && e.cap && v > e.cap));
    },
    cardio: el => { D.activo.cardio = el.value.replace(/\D/g, ''); save(); },
    bw: el => { ui.bw = el.value; },
    nuevoPeso: el => { ui.nuevoPeso = el.value; },
    editNombre: el => { ui.edit.nombre = el.value; },
    editDia: el => { ui.edit.dia = el.value ? +el.value : null; },
    editEnfoque: el => { ui.edit.enfoque = el.value; },
    exSeries: (el, d) => { ui.edit.ejercicios[+d.i].series = Math.max(1, parseInt(el.value) || 1); },
    exReps: (el, d) => { ui.edit.ejercicios[+d.i].reps = el.value.trim() || '8'; },
    nuevoEj: el => { ui.edit.nuevo = el.value; },
    nuevoGrupo: el => { ui.edit.nuevoGrupo = el.value; },
    cmp: el => {
      ui.cmp = +el.value;
      const t = $('[data-cmp-top]'); if (t) t.style.clipPath = 'inset(0 ' + (100 - ui.cmp) + '% 0 0)';
      $$('[data-cmp-h]').forEach(h => { h.style.left = ui.cmp + '%'; });
    },
    'aj-nombre': el => { D.ajustes.nombre = el.value; save(); },
    'aj-meta': el => { const v = toKg(el.value); D.ajustes.metaPeso = v > 0 ? Math.round(v * 100) / 100 : null; save(); },
    'aj-obj': el => { D.ajustes.objetivoSemanal = clamp(parseInt(el.value) || 1, 1, 7); save(); },
    'aj-desc': el => { D.ajustes.descanso = clamp(parseInt(el.value) || 90, 10, 600); save(); }
  };

  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    ev.stopPropagation();
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      else if (audio.state === 'suspended') audio.resume();
    } catch (e) { /* sin audio */ }
    const fn = A[el.dataset.act];
    if (fn) fn(el.dataset, el);
  });
  document.addEventListener('input', ev => {
    const el = ev.target.closest('[data-in]');
    if (el && el.tagName !== 'SELECT' && INPUTS[el.dataset.in]) INPUTS[el.dataset.in](el, el.dataset);
  });
  document.addEventListener('change', ev => {
    const el = ev.target.closest('[data-in]');
    if (!el) return;
    if (el.tagName === 'SELECT' && INPUTS[el.dataset.in]) INPUTS[el.dataset.in](el, el.dataset);
    if (el.dataset.in === 'rpe' && D.activo) {
      const e = D.activo.ejercicios[+el.dataset.ei];
      avisoRpe(e, e.sets[+el.dataset.si].rpe);
      if (e.sets[+el.dataset.si].rpe) el.value = fRpe(e.sets[+el.dataset.si].rpe);
    }
  });
  document.addEventListener('focusin', ev => { if (ev.target.classList && ev.target.classList.contains('num') && typeof ev.target.select === 'function') ev.target.select(); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.matches('input')) ev.target.blur(); });

  $('#fileFoto').addEventListener('change', async ev => {
    const file = ev.target.files[0]; ev.target.value = '';
    if (!file) return;
    try {
      const blob = await comprimir(file);
      await FotoDB.put({ id: uid(), fecha: isoDia(), ang: ANGULOS[ui.ang], blob });
      await cargarFotos(); toast('Foto guardada');
    } catch (e) { toast('No se pudo guardar la foto'); }
  });
  $('#fileImport').addEventListener('change', async ev => {
    const file = ev.target.files[0]; ev.target.value = '';
    if (!file) return;
    try {
      const texto = await file.text();
      if (!/^\s*\{/.test(texto)) { await importarCSV(texto); return; }
      const d = JSON.parse(texto);
      if (!d || d.version !== 1 || !Array.isArray(d.sesiones)) throw new Error('formato');
      if (!(await confirmar('Esto reemplazará los datos actuales por los de la copia.', 'Importar'))) return;
      const def = defaults();
      D = { ...def, ...d, ajustes: { ...def.ajustes, ...d.ajustes, onboarded: true } };
      save(); ui.ajustes = false; ui.screen = 'hoy'; render(); toast('Copia importada');
    } catch (e) { toast('Archivo no válido'); }
  });
  // Historial de StrengthLab: se añade al de Fuerza sin duplicar sesiones ya importadas.
  async function importarCSV(texto) {
    const filas = Importar.parseCSV(texto);
    if (!Importar.esStrengthLab(filas)) { toast('Este CSV no es un historial de StrengthLab'); return; }
    const r = Importar.convertir(filas, PRG);
    const ya = new Set(D.sesiones.map(s => s.origen).filter(Boolean));
    const nuevas = r.sesiones.filter(s => !ya.has(s.origen));
    if (!nuevas.length) { toast('Ese historial ya estaba importado'); return; }
    const series = nuevas.reduce((n, s) => n + s.ejercicios.reduce((m, e) => m + e.sets.length, 0), 0);
    const desde = fechaCorta(nuevas[0].fecha), hasta = fechaCorta(nuevas[nuevas.length - 1].fecha);
    let msg = `Añadir ${nuevas.length} sesiones (${series} series) de StrengthLab, del ${desde} al ${hasta}. No se borra nada.`;
    if (r.correcciones.length) msg += ` Corrijo ${r.correcciones.length} series con la unidad mal marcada.`;
    if (r.unidadDominante !== U()) msg += ` Registras en ${r.unidadDominante}: cambio la app a ${r.unidadDominante}.`;
    if (!(await confirmar(msg, 'Importar'))) return;
    nuevas.forEach(s => D.sesiones.push({ id: uid(), ...s }));
    D.sesiones.sort((a, b) => a.fecha.localeCompare(b.fecha));
    D.ajustes.unidad = r.unidadDominante;
    save(); ui.ajustes = false; render();
    toast(`Importadas ${nuevas.length} sesiones: el entrenador ya conoce tus cargas`);
  }
  window.addEventListener('online', () => { if (ui.screen === 'hoy') render(); });
  window.addEventListener('offline', () => { if (ui.screen === 'hoy') render(); });

  render();
  cargarFotos();
})();
