// Importador de historial desde un CSV de StrengthLab ("progreso-strengthlab-*.csv").
//
// - Usa peso_kg (ya convertido) y corrige series con la unidad mal marcada:
//   si en un ejercicio casi todo va en lb y aparece "14 kg" donde siempre hubo
//   "14 lb", se queda con la interpretación más coherente con el resto.
// - Traduce entrenamientos y ejercicios a los de tu programa por nombre, por
//   alias (campo `alias` en programa.js) o, para la rutina, por día de la semana.
// - Cada sesión guarda su origen, así que importar dos veces no duplica nada.
(function (root) {
  'use strict';

  const LB = 2.2046;
  const norm = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    const filas = [];
    let fila = [], campo = '', comillas = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (comillas) {
        if (c === '"' && text[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') comillas = false;
        else campo += c;
      } else if (c === '"') comillas = true;
      else if (c === ',') { fila.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        fila.push(campo); campo = '';
        if (fila.some(x => x !== '')) filas.push(fila);
        fila = [];
      } else campo += c;
    }
    fila.push(campo);
    if (fila.some(x => x !== '')) filas.push(fila);
    if (!filas.length) return [];
    const cab = filas[0].map(h => h.trim());
    return filas.slice(1).map(f => Object.fromEntries(cab.map((h, i) => [h, (f[i] || '').trim()])));
  }

  const esStrengthLab = filas => filas.length > 0 && ['fecha', 'ejercicio', 'peso_kg', 'repeticiones', 'sesion_id'].every(k => k in filas[0]);

  const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
  const mediana = xs => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

  // Peso en kg de cada fila, corrigiendo la unidad cuando está claramente mal marcada.
  function pesosCorregidos(filas) {
    const porEj = new Map();
    filas.forEach(f => { const k = norm(f.ejercicio); if (!porEj.has(k)) porEj.set(k, []); porEj.get(k).push(f); });
    const correcciones = [];
    const kg = new Map();
    porEj.forEach(fs => {
      const cuenta = { kg: 0, lb: 0 };
      fs.forEach(f => { if (f.unidad in cuenta) cuenta[f.unidad]++; });
      const mayor = cuenta.lb >= cuenta.kg ? 'lb' : 'kg';
      const med = mediana(fs.filter(f => f.unidad === mayor).map(f => num(f.peso_registrado)).filter(v => v != null));
      fs.forEach(f => {
        const reg = num(f.peso_registrado), pk = num(f.peso_kg);
        let valor = pk != null ? pk : reg != null ? (f.unidad === 'lb' ? reg / LB : reg) : 0;
        if (med != null && reg != null && f.unidad && f.unidad !== mayor) {
          const comoMarcado = mayor === 'lb' ? valor * LB : valor;   // en la unidad mayoritaria
          const comoMayor = reg;                                     // el número leído en la unidad mayoritaria
          if (Math.abs(comoMayor - med) < Math.abs(comoMarcado - med)) {
            valor = mayor === 'lb' ? reg / LB : reg;
            correcciones.push({ ejercicio: f.ejercicio, fecha: f.fecha, de: reg + ' ' + f.unidad, a: reg + ' ' + mayor });
          }
        }
        kg.set(f, Math.round(valor * 100) / 100);
      });
    });
    return { kg, correcciones };
  }

  function diaSemana(fecha) {
    const [y, m, d] = fecha.split('-').map(Number);
    return (new Date(y, m - 1, d).getDay() + 6) % 7 + 1;
  }

  // programa: window.PROGRAMA_FUERZA
  function convertir(filas, programa) {
    const rutinas = (programa && programa.rutinas) || [];
    const { kg, correcciones } = pesosCorregidos(filas);
    const coincide = (obj, nombre) => [obj.nombre].concat(obj.alias || []).some(n => norm(n) === norm(nombre));
    function rutinaDe(entrenamiento, fecha) {
      return rutinas.find(r => coincide(r, entrenamiento)) || rutinas.find(r => r.dia === diaSemana(fecha)) || null;
    }
    function ejercicioDe(nombre, rutina) {
      const enRutina = rutina && rutina.ejercicios.find(e => coincide(e, nombre));
      if (enRutina) return enRutina;
      for (const r of rutinas) { const e = r.ejercicios.find(x => coincide(x, nombre)); if (e) return e; }
      return null;
    }

    const sesiones = new Map(), sinMapear = new Set();
    let unidades = { kg: 0, lb: 0 };
    filas.forEach(f => {
      const id = f.sesion_id || f.fecha + '|' + f.entrenamiento;
      if (!sesiones.has(id)) sesiones.set(id, { id, fecha: f.fecha, entrenamiento: f.entrenamiento, duracion: num(f.duracion_entrenamiento_min), filas: [] });
      sesiones.get(id).filas.push(f);
      if (f.unidad in unidades) unidades[f.unidad]++;
    });

    const salida = [];
    sesiones.forEach(s => {
      const r = rutinaDe(s.entrenamiento, s.fecha);
      const ejercicios = [], idx = new Map();
      s.filas.forEach(f => {
        const e = ejercicioDe(f.ejercicio, r);
        if (!e) sinMapear.add(f.ejercicio);
        const nombre = e ? e.nombre : f.ejercicio;
        if (!idx.has(nombre)) { idx.set(nombre, ejercicios.length); ejercicios.push({ nombre, grupo: e ? e.grupo : 'Otro', sets: [], _orden: [] }); }
        const ej = ejercicios[idx.get(nombre)];
        const reps = parseInt(f.repeticiones, 10), rpe = num(f.rpe);
        if (!(reps > 0)) return;
        ej.sets.push({ kg: kg.get(f), reps, ...(rpe ? { rpe } : {}) });
        ej._orden.push(num(f.serie) || ej._orden.length + 1);
      });
      ejercicios.forEach(ej => {
        const orden = ej.sets.map((x, i) => [ej._orden[i], x]).sort((a, b) => a[0] - b[0]);
        ej.sets = orden.map(o => o[1]);
        delete ej._orden;
      });
      const validos = ejercicios.filter(e => e.sets.length);
      if (!validos.length) return;
      const rpes = validos.flatMap(e => e.sets.map(x => x.rpe).filter(Boolean));
      const [y, m, d] = s.fecha.split('-').map(Number);
      salida.push({
        origen: 'strengthlab:' + s.id,
        fecha: new Date(y, m - 1, d, 12).toISOString(),
        rutinaId: r ? r.id : null,
        nombre: r ? r.nombre : String(s.entrenamiento || 'ENTRENAMIENTO').toUpperCase(),
        duracion: s.duracion && s.duracion > 0 && s.duracion <= 300 ? Math.round(s.duracion * 60) : null,
        rpeMedio: rpes.length ? Math.round(rpes.reduce((a, b) => a + b, 0) / rpes.length * 100) / 100 : null,
        cardioMin: 0,
        ejercicios: validos
      });
    });
    salida.sort((a, b) => a.fecha.localeCompare(b.fecha));
    return {
      sesiones: salida,
      series: salida.reduce((n, s) => n + s.ejercicios.reduce((m, e) => m + e.sets.length, 0), 0),
      correcciones,
      sinMapear: [...sinMapear],
      unidadDominante: unidades.lb > unidades.kg ? 'lb' : 'kg'
    };
  }

  const Importar = { parseCSV, esStrengthLab, convertir };
  if (typeof module !== 'undefined' && module.exports) module.exports = Importar;
  else root.Importar = Importar;
})(typeof window !== 'undefined' ? window : globalThis);
