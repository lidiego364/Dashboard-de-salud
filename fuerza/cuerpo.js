// Medidas corporales y análisis de fotos con Claude.
//
// - grasaNavy: % de grasa estimado con la fórmula de la Marina de EE. UU. (cinta métrica).
// - analizarFotos: envía las fotos de progreso a Claude y devuelve un análisis
//   estructurado (contextura, grasa estimada, puntos fuertes, zonas a mejorar).
//   Usa la clave de API del propio usuario, guardada solo en su teléfono.
(function (root) {
  'use strict';

  const MEDIDAS = [
    ['cintura', 'Cintura', 'A la altura del ombligo, relajado, al final de una espiración.'],
    ['cuello', 'Cuello', 'Justo debajo de la nuez, cinta ligeramente inclinada hacia abajo.'],
    ['pecho', 'Pecho', 'Por la línea de los pezones, brazos relajados.'],
    ['hombros', 'Hombros', 'Por el punto más ancho de los deltoides.'],
    ['brazo', 'Brazo', 'Bíceps contraído, en el punto más grueso.'],
    ['muslo', 'Muslo', 'Debajo del glúteo, en el punto más grueso.'],
    ['cadera', 'Cadera', 'Por el punto más ancho de los glúteos.']
  ];

  // Fórmula de la Marina de EE. UU. (todas las medidas en cm). Devuelve null si faltan datos.
  function grasaNavy({ sexo, altura, cintura, cuello, cadera }) {
    if (!(altura > 0 && cintura > 0 && cuello > 0)) return null;
    let d;
    if (sexo === 'h') {
      if (cintura - cuello <= 0) return null;
      d = 1.0324 - 0.19077 * Math.log10(cintura - cuello) + 0.15456 * Math.log10(altura);
    } else if (sexo === 'm') {
      if (!(cadera > 0) || cintura + cadera - cuello <= 0) return null;
      d = 1.29579 - 0.35004 * Math.log10(cintura + cadera - cuello) + 0.22100 * Math.log10(altura);
    } else return null;
    const v = 495 / d - 450;
    return v > 2 && v < 60 ? Math.round(v * 10) / 10 : null;
  }

  // ---------- Análisis con Claude ----------
  const MODELO = 'claude-opus-5-5';
  const ESQUEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['resumen', 'contextura', 'grasa_min', 'grasa_max', 'grasa_comentario', 'fuertes', 'mejorar', 'postura', 'cambios', 'recomendaciones', 'calidad_fotos'],
    properties: {
      resumen: { type: 'string' },
      contextura: { type: 'string' },
      grasa_min: { type: 'number' },
      grasa_max: { type: 'number' },
      grasa_comentario: { type: 'string' },
      fuertes: { type: 'array', items: { type: 'string' } },
      mejorar: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false, required: ['zona', 'observacion', 'sugerencia'],
          properties: { zona: { type: 'string' }, observacion: { type: 'string' }, sugerencia: { type: 'string' } }
        }
      },
      postura: { type: 'string' },
      cambios: { type: 'string' },
      recomendaciones: { type: 'array', items: { type: 'string' } },
      calidad_fotos: { type: 'string' }
    }
  };
  const SISTEMA = `Eres un entrenador de fuerza con experiencia en evaluación visual de composición corporal. Analizas fotos de progreso de una persona que entrena con un programa concreto y quiere entender su físico para entrenar mejor.

Cómo trabajas:
- Habla en español, de tú, con tono directo, profesional y respetuoso. Describe el físico con lenguaje técnico de entrenamiento, sin juicios estéticos ni comentarios sobre el atractivo.
- Basa cada observación en lo que se ve en las fotos y en los datos que te dan. Si algo no se aprecia bien (luz, ángulo, ropa, distancia), dilo en calidad_fotos y no lo inventes.
- La grasa corporal por foto es una estimación con incertidumbre: da un rango realista (grasa_min y grasa_max, en %) de no más de 5 puntos y explica en qué te basas. Si hay una estimación por cinta métrica en los datos, contrástala.
- contextura: estructura ósea y proporciones (anchura de hombros frente a cintura y cadera, longitud de extremidades, inserciones visibles) y cómo influyen en el entrenamiento.
- fuertes: 2 a 4 grupos musculares o rasgos más desarrollados.
- mejorar: 2 a 4 zonas rezagadas o desequilibrios (incluida asimetría izquierda/derecha si se ve), cada una con una sugerencia concreta que encaje con su programa (ejercicios que ya hace, series o énfasis).
- postura: lo que se observa (hombros adelantados, inclinación pélvica, escápulas…) y qué hacer, sin diagnósticos médicos.
- cambios: si hay fotos de "antes" y "ahora", compara con detalle; si no, explica que hará falta otra tanda para comparar.
- recomendaciones: 3 a 5 acciones concretas para las próximas semanas, coherentes con su objetivo de recomposición en déficit.
- No des consejos médicos ni de fármacos. Si ves algo que convenga revisar con un profesional (por ejemplo, una asimetría marcada o un dolor reportado), recomiéndalo con naturalidad.`;

  let carga = null;
  function cargarSDK() {
    if (root.Anthropic) return Promise.resolve(root.Anthropic);
    if (!carga) {
      carga = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'vendor/anthropic-sdk.js';
        s.onload = () => (root.Anthropic ? res(root.Anthropic) : rej(new Error('sdk')));
        s.onerror = () => { carga = null; rej(new Error('sdk')); };
        document.head.appendChild(s);
      });
    }
    return carga;
  }

  async function aBase64(blob) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  // fotos: [{ etiqueta, blob }] · contexto: texto con los datos del usuario.
  // Devuelve { ok: true, resultado, modelo } o { ok: false, error }.
  async function analizarFotos(clave, fotos, contexto) {
    let Anthropic;
    try { Anthropic = await cargarSDK(); } catch (e) { return { ok: false, error: 'No se pudo cargar el módulo de IA. Revisa tu conexión.' }; }
    const client = new Anthropic({ apiKey: clave, dangerouslyAllowBrowser: true });
    const contenido = [];
    for (const f of fotos) {
      contenido.push({ type: 'text', text: f.etiqueta });
      contenido.push({ type: 'image', source: { type: 'base64', media_type: f.blob.type || 'image/jpeg', data: await aBase64(f.blob) } });
    }
    contenido.push({ type: 'text', text: contexto + '\n\nAnaliza las fotos y devuelve el análisis completo.' });
    try {
      const r = await client.beta.messages.create({
        model: MODELO,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SISTEMA,
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMA } },
        messages: [{ role: 'user', content: contenido }]
      });
      if (r.stop_reason === 'refusal') return { ok: false, error: 'La IA no pudo analizar estas fotos. Prueba con otras fotos (buena luz, cuerpo entero, ropa ajustada).' };
      if (r.stop_reason === 'max_tokens') return { ok: false, error: 'El análisis quedó incompleto. Vuelve a intentarlo.' };
      const texto = r.content.filter(b => b.type === 'text').map(b => b.text).join('');
      return { ok: true, resultado: JSON.parse(texto), modelo: r.model };
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) return { ok: false, error: 'La clave de API no es válida. Revísala en Ajustes.' };
      if (e instanceof Anthropic.PermissionDeniedError) return { ok: false, error: 'Tu clave de API no tiene permiso para este modelo.' };
      if (e instanceof Anthropic.RateLimitError) return { ok: false, error: 'Demasiadas peticiones o saldo agotado en tu cuenta de Anthropic. Inténtalo en un rato.' };
      if (e instanceof Anthropic.BadRequestError) return { ok: false, error: 'Anthropic rechazó la petición: ' + (e.message || 'error de formato') };
      if (e instanceof Anthropic.APIConnectionError) return { ok: false, error: 'Sin conexión: el análisis necesita internet.' };
      if (e instanceof Anthropic.APIError) return { ok: false, error: 'Error del servicio de IA (' + (e.status || '?') + '). Inténtalo más tarde.' };
      if (e instanceof SyntaxError) return { ok: false, error: 'La respuesta de la IA llegó incompleta. Vuelve a intentarlo.' };
      return { ok: false, error: 'No se pudo completar el análisis.' };
    }
  }

  const Cuerpo = { MEDIDAS, grasaNavy, analizarFotos, MODELO };
  if (typeof module !== 'undefined' && module.exports) module.exports = Cuerpo;
  else root.Cuerpo = Cuerpo;
})(typeof window !== 'undefined' ? window : globalThis);
