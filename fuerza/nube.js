// Conexión con un repositorio privado de GitHub para que ChatGPT y Claude
// lean tus datos y propongan cambios al plan.
//
// - El resumen para la IA vive en el cuerpo de un issue ("Fuerza · Entrenador IA").
// - Una copia completa de los datos (sin fotos) se guarda en datos.json.
// - La IA propone cambios comentando en ese issue con un bloque ```fuerza { ... } ```.
//   La app los muestra y solo se aplican si tú los aceptas.
(function (root) {
  'use strict';

  const TITULO = 'Fuerza · Entrenador IA';
  const MARCA = '<!-- fuerza-app -->';
  const API = 'https://api.github.com';
  const norm = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // ---------- GitHub ----------
  class ErrorNube extends Error {
    constructor(codigo, mensaje, status) { super(mensaje); this.codigo = codigo; this.status = status || 0; }
  }

  function utf8Base64(texto) {
    const bytes = new TextEncoder().encode(texto);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function base64Utf8(b64) {
    const bin = atob(String(b64).replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function cliente(repo, token, fetchFn) {
    const f = fetchFn || root.fetch.bind(root);
    async function pedir(metodo, ruta, cuerpo) {
      let res;
      try {
        res = await f(API + ruta, {
          method: metodo,
          headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            ...(cuerpo ? { 'Content-Type': 'application/json' } : {})
          },
          body: cuerpo ? JSON.stringify(cuerpo) : undefined,
          cache: 'no-store'
        });
      } catch (e) {
        throw new ErrorNube('red', 'No se pudo conectar con GitHub.');
      }
      if (res.status === 204) return null;
      let data = null;
      try { data = await res.json(); } catch (e) { /* respuesta vacía */ }
      if (!res.ok) {
        const msg = data && data.message ? data.message : '';
        if (res.status === 401) throw new ErrorNube('token', 'El token de GitHub no es válido o caducó.', 401);
        if (res.status === 404) throw new ErrorNube('no_encontrado', 'No encuentro ese repositorio o el token no tiene acceso a él.', 404);
        if (res.status === 403 && /rate limit/i.test(msg)) throw new ErrorNube('limite', 'GitHub limitó las peticiones. Inténtalo en un rato.', 403);
        if (res.status === 403) throw new ErrorNube('permisos', 'Al token le faltan permisos (Contents e Issues: lectura y escritura).', 403);
        if (res.status === 409 || res.status === 422) throw new ErrorNube('conflicto', msg || 'Conflicto al guardar.', res.status);
        throw new ErrorNube('github', 'GitHub respondió ' + res.status + (msg ? ': ' + msg : ''), res.status);
      }
      return data;
    }
    const base = '/repos/' + repo;
    return {
      info: () => pedir('GET', base),
      async leerArchivo(ruta) {
        try {
          const d = await pedir('GET', base + '/contents/' + encodeURIComponent(ruta));
          return { sha: d.sha, texto: d.content ? base64Utf8(d.content) : null, url: d.download_url };
        } catch (e) { if (e.codigo === 'no_encontrado') return null; throw e; }
      },
      async escribirArchivo(ruta, texto, mensaje) {
        for (let intento = 0; intento < 2; intento++) {
          const actual = await this.leerArchivo(ruta);
          try {
            return await pedir('PUT', base + '/contents/' + encodeURIComponent(ruta), {
              message: mensaje, content: utf8Base64(texto), ...(actual ? { sha: actual.sha } : {})
            });
          } catch (e) { if (e.codigo !== 'conflicto' || intento) throw e; }
        }
      },
      async buscarIssue() {
        const lista = await pedir('GET', base + '/issues?state=all&per_page=100');
        const it = (lista || []).find(i => !i.pull_request && i.title === TITULO);
        return it ? it.number : null;
      },
      crearIssue: cuerpo => pedir('POST', base + '/issues', { title: TITULO, body: cuerpo }).then(d => d.number),
      leerIssue: n => pedir('GET', base + '/issues/' + n),
      editarIssue: (n, cuerpo) => pedir('PATCH', base + '/issues/' + n, { body: cuerpo, state: 'open' }),
      comentarios: (n, desde) => pedir('GET', base + '/issues/' + n + '/comments?per_page=100' + (desde ? '&since=' + encodeURIComponent(desde) : '')),
      comentar: (n, cuerpo) => pedir('POST', base + '/issues/' + n + '/comments', { body: cuerpo })
    };
  }

  // ---------- Propuestas de cambios ----------
  // Busca un bloque ```fuerza (o ```json con "cambios") y devuelve { motivo, cambios } o null.
  function parsearPropuesta(texto) {
    const t = String(texto || '');
    if (t.includes(MARCA)) return null;
    const re = /```\s*(fuerza|json)?\s*\n([\s\S]*?)```/gi;
    let m;
    while ((m = re.exec(t))) {
      let obj;
      try { obj = JSON.parse(m[2]); } catch (e) { continue; }
      if (Array.isArray(obj)) obj = { cambios: obj };
      if (obj && Array.isArray(obj.cambios) && obj.cambios.length) {
        return { motivo: typeof obj.motivo === 'string' ? obj.motivo.slice(0, 600) : '', cambios: obj.cambios.slice(0, 40) };
      }
    }
    return null;
  }

  const DIAS = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 7 };
  const NOMBRE_DIA = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  function buscarRutina(rutinas, dia) {
    if (dia == null || dia === '') return -1;
    const n = typeof dia === 'number' ? dia : (DIAS[norm(dia)] || parseInt(dia, 10));
    if (n >= 1 && n <= 7) { const i = rutinas.findIndex(r => r.dia === n); if (i >= 0) return i; }
    const k = norm(dia);
    return rutinas.findIndex(r => norm(r.nombre) === k || norm(r.id) === k);
  }
  function buscarEjercicio(r, nombre) {
    const k = norm(nombre);
    if (!k) return -1;
    return r.ejercicios.findIndex(e => norm(e.nombre) === k || (e.alias || []).some(a => norm(a) === k));
  }
  function segundos(v) {
    if (typeof v === 'number') return Math.round(v);
    const s = String(v || '').trim();
    const m = s.match(/^(\d+):(\d{1,2})$/);
    if (m) return +m[1] * 60 + +m[2];
    const n = parseFloat(s);
    if (isNaN(n)) return null;
    return /min/i.test(s) ? Math.round(n * 60) : Math.round(n);
  }
  // Campos que la IA puede tocar, validados.
  function camposValidos(src) {
    const out = {}, err = [];
    if (src.series != null) { const n = parseInt(src.series, 10); if (n >= 1 && n <= 10) out.series = n; else err.push('series fuera de rango'); }
    if (src.reps != null) { const s = String(src.reps).trim(); if (s && s.length <= 20) out.reps = s; else err.push('reps no válidas'); }
    if (src.rpe != null) { const s = String(src.rpe).trim(); if (s.length <= 12) out.rpe = s; }
    if (src.descanso != null) { const n = segundos(src.descanso); if (n >= 15 && n <= 600) out.descanso = n; else err.push('descanso fuera de rango'); }
    if (Array.isArray(src.alternativas)) out.alternativas = src.alternativas.map(x => String(x).trim()).filter(Boolean).slice(0, 6);
    if (src.notas != null) out.notas = String(src.notas).slice(0, 300);
    if (src.equipo != null) out.equipo = String(src.equipo).slice(0, 40);
    if (src.grupo != null) out.grupo = String(src.grupo).slice(0, 40);
    if (src.opcional != null) out.opcional = !!src.opcional;
    return { out, err };
  }
  const accionDe = c => {
    const a = norm(c && (c.accion || c.action));
    if (/^(anadir|agregar|añadir|add)$/.test(a) || a === 'anadir') return 'anadir';
    if (/^(quitar|eliminar|borrar|remove)$/.test(a)) return 'quitar';
    if (/^(sustituir|reemplazar|cambiar|replace)$/.test(a)) return 'sustituir';
    if (/^(mover|reordenar|move)$/.test(a)) return 'mover';
    if (/^(modificar|editar|ajustar|update)$/.test(a)) return 'modificar';
    if (/^(nota_dia|nota)$/.test(a)) return 'nota_dia';
    return a;
  };

  function describir(c) {
    const dia = c.dia != null ? (typeof c.dia === 'number' ? NOMBRE_DIA[c.dia] || c.dia : String(c.dia)) : '?';
    const nv = c.nuevo || {};
    const det = o => {
      const p = [];
      if (o.series && o.reps) p.push(o.series + ' × ' + o.reps);
      else if (o.series) p.push(o.series + ' series');
      else if (o.reps) p.push('reps ' + o.reps);
      if (o.rpe) p.push('RPE ' + o.rpe);
      if (o.descanso != null) { const s = segundos(o.descanso); if (s) p.push('descanso ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')); }
      if (Array.isArray(o.alternativas)) p.push('alternativas: ' + (o.alternativas.join(', ') || 'ninguna'));
      if (o.notas) p.push('nota: ' + o.notas);
      return p.join(' · ');
    };
    switch (accionDe(c)) {
      case 'modificar': return `${dia}: ${c.ejercicio} → ${det(c) || 'sin cambios'}`;
      case 'sustituir': return `${dia}: cambia ${c.ejercicio} por ${nv.nombre || '?'}${det(nv) ? ' (' + det(nv) + ')' : ''}`;
      case 'anadir': return `${dia}: añade ${nv.nombre || '?'}${c.posicion ? ' en la posición ' + c.posicion : ''}${det(nv) ? ' (' + det(nv) + ')' : ''}`;
      case 'quitar': return `${dia}: quita ${c.ejercicio}`;
      case 'mover': return `${dia}: mueve ${c.ejercicio} a la posición ${c.posicion}`;
      case 'nota_dia': return `${dia}: nota del día → ${c.nota || ''}`;
      default: return `Cambio no reconocido (${c && c.accion})`;
    }
  }

  // Aplica los cambios sobre una copia de las rutinas. normEj normaliza un ejercicio nuevo.
  function aplicarCambios(rutinas, cambios, normEj) {
    const R = JSON.parse(JSON.stringify(rutinas));
    const hechos = [], errores = [];
    (cambios || []).forEach(c => {
      const txt = describir(c);
      const ri = buscarRutina(R, c && c.dia);
      if (ri < 0) { errores.push(txt + ' — no encuentro ese día'); return; }
      const r = R[ri], acc = accionDe(c);
      const pos = n => Math.max(0, Math.min(r.ejercicios.length, (parseInt(n, 10) || r.ejercicios.length + 1) - 1));
      if (acc === 'nota_dia') { r.nota = String(c.nota || '').slice(0, 400); hechos.push(txt); return; }
      if (acc === 'anadir') {
        const nv = c.nuevo || {};
        if (!nv.nombre) { errores.push(txt + ' — falta el nombre'); return; }
        if (buscarEjercicio(r, nv.nombre) >= 0) { errores.push(txt + ' — ya está en ese día'); return; }
        const { out, err } = camposValidos(nv);
        if (err.length) { errores.push(txt + ' — ' + err.join(', ')); return; }
        r.ejercicios.splice(pos(c.posicion), 0, normEj({ series: 3, reps: '8-10', grupo: 'Otro', ...out, nombre: String(nv.nombre).trim() }));
        hechos.push(txt); return;
      }
      const ei = buscarEjercicio(r, c.ejercicio);
      if (ei < 0) { errores.push(txt + ' — no encuentro ese ejercicio en ese día'); return; }
      const e = r.ejercicios[ei];
      if (acc === 'quitar') { r.ejercicios.splice(ei, 1); hechos.push(txt); return; }
      if (acc === 'mover') { r.ejercicios.splice(ei, 1); r.ejercicios.splice(pos(c.posicion), 0, e); hechos.push(txt); return; }
      if (acc === 'modificar') {
        const { out, err } = camposValidos(c);
        if (err.length) { errores.push(txt + ' — ' + err.join(', ')); return; }
        if (!Object.keys(out).length) { errores.push(txt + ' — no indica qué cambiar'); return; }
        Object.assign(e, out); hechos.push(txt); return;
      }
      if (acc === 'sustituir') {
        const nv = c.nuevo || {};
        if (!nv.nombre) { errores.push(txt + ' — falta el nombre nuevo'); return; }
        const { out, err } = camposValidos(nv);
        if (err.length) { errores.push(txt + ' — ' + err.join(', ')); return; }
        const nombre = String(nv.nombre).trim();
        const alts = out.alternativas || [e.nombre, ...(e.alternativas || [])].filter(x => norm(x) !== norm(nombre));
        r.ejercicios[ei] = normEj({
          grupo: e.grupo, equipo: '', series: e.series, reps: e.reps, rpe: e.rpe, descanso: e.descanso, opcional: e.opcional,
          ...out, nombre, alternativas: alts, alias: Array.isArray(nv.alias) ? nv.alias : []
        });
        hechos.push(txt); return;
      }
      errores.push(txt);
    });
    return { rutinas: R, hechos, errores };
  }

  // Hash corto para no reenviar lo que no cambió.
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36) + ':' + s.length;
  }

  const Nube = { TITULO, MARCA, ErrorNube, cliente, parsearPropuesta, aplicarCambios, describir, hash, segundos, utf8Base64, base64Utf8 };
  if (typeof module !== 'undefined' && module.exports) module.exports = Nube;
  else root.Nube = Nube;
})(typeof window !== 'undefined' ? window : globalThis);
