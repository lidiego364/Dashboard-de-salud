// Universidad: une las entregas (Calendar/Canvas + tareas de la uni) con lo que
// dicen los syllabus (cuánto vale cada parte de la nota) para ordenarlas por
// "% de la nota ÷ días que faltan" y armar el plan de estudio de hoy.
import type { Deadline } from "./selectors";
import type { AssignmentMeta, Course, GradeComponent } from "./types";

// Marcas de acento (U+0300 a U+036F). Se arma desde un texto con escapes: esbuild
// deja los regex literales con los caracteres crudos y la página debe ser solo ASCII.
const ACCENTS = new RegExp("[\\u0300-\\u036f]", "g");
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(ACCENTS, "").trim();
const codeKey = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
const CODE_RE = /\b([A-Z]{3})\s?-?(\d{4}[A-Z]?)\b/g;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** El curso de una entrega: por el nombre de Canvas entre corchetes, o por el código (ISM 4210) en el título. */
export function matchCourse(d: Pick<Deadline, "title" | "meta" | "course">, courses: Course[]): Course | null {
  if (d.course) {
    const c = norm(d.course);
    const hit =
      courses.find((x) => x.calendar_name && norm(x.calendar_name) === c) ??
      courses.find((x) => norm(x.name) === c) ??
      courses.find((x) => c.includes(norm(x.name)) || norm(x.name).includes(c));
    if (hit) return hit;
  }
  const text = `${d.title} ${d.meta ?? ""}`.toUpperCase();
  for (const m of text.matchAll(CODE_RE)) {
    const hit = courses.find((x) => codeKey(x.code) === m[1] + m[2]);
    if (hit) return hit;
  }
  return null;
}

/** La parte de la nota a la que pertenece una entrega, por sus palabras clave
 *  ("quiz" encaja con "Quiz 5", "q" con "Q6", "exam" con "Exam1_Fall2026B"). */
export function matchComponent(title: string, course: Course): GradeComponent | null {
  const t = norm(title.replace(/_/g, " "));
  let best: { comp: GradeComponent; len: number } | null = null;
  for (const comp of course.components) {
    for (const kw of comp.keywords) {
      const k = norm(kw);
      if (!k) continue;
      // La palabra, opcionalmente seguida de número o plural: "q6", "quizzes", "exam1".
      if (new RegExp(`\\b${escapeRe(k)}(\\d+[a-z]?|s|es|zes)?\\b`).test(t) && (!best || k.length > best.len)) best = { comp, len: k.length };
    }
  }
  return best?.comp ?? null;
}

export type RankedItem = Deadline & {
  courseRow: Course | null;
  component: GradeComponent | null;
  /** % de la nota de ESTA entrega (null si no se sabe). */
  weightPct: number | null;
  /** true si el % se estimó (el syllabus no dice cuántas entregas reparten la parte). */
  weightEstimated: boolean;
  score: number;
  priority: "Alta" | "Media" | "Baja";
  metaRow: AssignmentMeta | null;
  /** Minutos totales estimados (del checklist de Claude o por tipo de entrega). */
  minutes: number;
};

/** Minutos por defecto según el tipo de entrega. */
function defaultMinutes(title: string, comp: GradeComponent | null) {
  const t = norm(`${comp?.name ?? ""} ${title}`);
  if (/\b(final|midterm|exam\w*|parcial|examen)\b/.test(t)) return 240;
  if (/\b(project|proyecto|case|caso)\b/.test(t)) return 240;
  if (/\b(quiz\w*|q\d+)\b/.test(t)) return 45;
  if (/\b(discussion|post|foro|reflection)\b/.test(t)) return 30;
  if (/\b(lab\w*|l\d+|assignment|homework|hw|tarea)\b/.test(t)) return 120;
  return 90;
}

export function metaKey(d: Pick<Deadline, "key">) {
  return d.key;
}

export function rankDeadlines(deadlines: Deadline[], courses: Course[], meta: AssignmentMeta[]): RankedItem[] {
  const byKey = new Map(meta.map((m) => [m.key, m]));
  return deadlines
    .map((d) => {
      const courseRow = matchCourse(d, courses);
      const component = courseRow ? matchComponent(d.title, courseRow) : null;
      let weightPct: number | null = null;
      let weightEstimated = false;
      if (component) {
        if (component.count && component.count > 0) weightPct = component.weight_pct / component.count;
        else {
          // Sin cantidad en el syllabus: "Final Exam"/"Midterm"/"Project" es una sola entrega,
          // "Exams" (plural) suelen ser 2, y lo demás se reparte en ~4. Siempre se marca como estimado.
          const n = norm(component.name);
          const parts = /\b(final|midterm|exam|project|proyecto|examen|parcial)\b/.test(n) ? 1 : /\b(exams|examenes|midterms|projects|proyectos)\b/.test(n) ? 2 : 4;
          weightPct = component.weight_pct / parts;
          weightEstimated = true;
        }
      }
      const score = (weightPct ?? 1) / Math.max(d.days, 0.5);
      const metaRow = byKey.get(metaKey(d)) ?? null;
      return {
        ...d,
        courseRow,
        component,
        weightPct,
        weightEstimated,
        score,
        priority: (score >= 3 ? "Alta" : score >= 1.5 ? "Media" : "Baja") as RankedItem["priority"],
        metaRow,
        minutes: metaRow?.minutes ?? defaultMinutes(d.title, component),
      };
    })
    .filter((x) => !x.metaRow?.done_at)
    .sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
}

export function fmtWeight(x: Pick<RankedItem, "weightPct" | "weightEstimated">) {
  if (x.weightPct === null) return null;
  const v = x.weightPct >= 10 ? Math.round(x.weightPct) : Math.round(x.weightPct * 10) / 10;
  return `${x.weightEstimated ? "≈" : ""}${v}%`;
}

const round15 = (m: number) => Math.round(m / 15) * 15;

/** Plan de hoy: las 3 entregas más urgentes, con los minutos que tocan hoy
 *  (tiempo total repartido entre los días que faltan). */
export function studyPlan(items: RankedItem[], horizonDays = 14) {
  return items
    .filter((x) => x.days <= horizonDays)
    .slice(0, 3)
    .map((x) => {
      const perDay = x.days <= 0 ? x.minutes : x.minutes / Math.max(x.days, 1);
      const minutes = Math.min(150, Math.max(15, round15(perDay)));
      const w = fmtWeight(x);
      const when = x.days <= 0 ? "vence hoy" : x.days === 1 ? "vence mañana" : `vence en ${x.days} días`;
      return { key: x.key, minutes, title: x.title, course: x.courseRow?.code ?? x.course, why: `${when}${w ? ` (${w} de la nota)` : ""}` };
    });
}

// ── Instrucciones para Claude ─────────────────────────────────────────────

export type CourseExtraction = Omit<Course, "id" | "created_at" | "grade">;

export function syllabusPrompt(text: string, calendarNames: string[]) {
  return `Eres un asistente que lee el syllabus de un curso universitario (FIU, Miami) y extrae cómo se calcula la nota.

Responde SOLO con un objeto JSON con esta forma exacta:
{"code": "ISM 4210", "name": "Database Applications", "calendar_name": null, "components": [{"name": "Quizzes", "weight_pct": 20, "count": 10, "keywords": ["quiz", "q"]}]}

Reglas:
- "code": código del curso con espacio (ej. "ISM 4210", "QMB 3200").
- "name": nombre del curso en inglés, como aparece en el syllabus.
- "calendar_name": de esta lista de nombres de cursos que aparecen en el calendario del estudiante, elige el que corresponda a este curso, o null si ninguno: ${JSON.stringify(calendarNames)}
- "components": cada parte de la nota con su porcentaje ("weight_pct", número de 0 a 100). Deben sumar alrededor de 100. Si el syllabus usa puntos, conviértelos a porcentaje.
- "count": cuántas entregas reparten ese porcentaje (ej. 10 quizzes). Si el syllabus no lo dice ni se puede deducir del calendario del curso, pon null.
- "keywords": palabras cortas en minúsculas con las que esas entregas aparecen en Canvas (ej. ["quiz","q"] para "Quiz 5" o "Q6"; ["lab","l"] para "L1 - …"; ["exam","midterm","final"]; ["discussion"]). Incluye abreviaturas solo si el syllabus o el calendario las usan.
- Si el texto no es un syllabus, responde {"error": "explicación breve en español"}.

Texto del syllabus:
"""
${text.slice(0, 60_000)}
"""`;
}

/** Valida y limpia lo que devolvió Claude (nunca se guarda sin revisar). */
export function parseCourseExtraction(raw: unknown, calendarNames: string[]): CourseExtraction {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object") throw new Error("Claude no devolvió datos del curso.");
  if (typeof o.error === "string") throw new Error(o.error);
  const code = String(o.code ?? "").trim();
  const name = String(o.name ?? "").trim();
  if (!code && !name) throw new Error("No encontré el código ni el nombre del curso.");
  const comps = Array.isArray(o.components) ? o.components : [];
  const components: GradeComponent[] = comps
    .map((c: Record<string, unknown>) => ({
      name: String(c?.name ?? "").trim(),
      weight_pct: Number(c?.weight_pct),
      count: c?.count === null || c?.count === undefined || !(Number(c.count) > 0) ? null : Math.round(Number(c.count)),
      keywords: (Array.isArray(c?.keywords) ? c.keywords : []).map((k: unknown) => String(k).toLowerCase().trim()).filter(Boolean).slice(0, 6),
    }))
    .filter((c) => c.name && c.weight_pct > 0 && c.weight_pct <= 100);
  const cal = typeof o.calendar_name === "string" && calendarNames.includes(o.calendar_name) ? o.calendar_name : null;
  return { code: code || name, name: name || code, calendar_name: cal, components };
}

export function checklistPrompt(x: Pick<RankedItem, "title" | "course" | "date">, course: Course | null, component: GradeComponent | null) {
  return `Un estudiante de FIU tiene esta entrega: "${x.title}"${course ? ` del curso ${course.code} ${course.name}` : x.course ? ` del curso ${x.course}` : ""}${component ? ` (parte "${component.name}" de la nota)` : ""}, para el ${x.date}.

Responde SOLO con JSON: {"minutes": 120, "steps": ["Paso concreto 1", "Paso 2", "Paso 3"]}
- "steps": de 3 a 6 pasos cortos y concretos en español para completarla, en orden.
- "minutes": tiempo total realista en minutos para hacerla completa.`;
}

export function parseChecklist(raw: unknown): { minutes: number | null; steps: string[] } {
  const o = raw as { minutes?: unknown; steps?: unknown } | null;
  const steps = (Array.isArray(o?.steps) ? o!.steps : []).map((s) => String(s).trim()).filter(Boolean).slice(0, 8);
  if (!steps.length) throw new Error("Claude no devolvió pasos.");
  const m = Number(o?.minutes);
  return { minutes: m > 0 && m < 6000 ? Math.round(m) : null, steps };
}

const TIME_RANGE = new RegExp("\\d{2}:\\d{2}(\u2013\\d{2}:\\d{2})?");

/** Entregas en orden de fecha, sin las hechas, con el % de la nota en el detalle (para "Deadlines FIU"). */
export function withWeights(deadlines: Deadline[], courses: Course[], meta: AssignmentMeta[]): Deadline[] {
  const ranked = new Map(rankDeadlines(deadlines, courses, meta).map((r) => [r.key, r]));
  return deadlines
    .filter((d) => ranked.has(d.key))
    .map((d) => {
      const r = ranked.get(d.key)!;
      const w = fmtWeight(r);
      const course = r.courseRow ? r.courseRow.code : d.course;
      const time = d.time ? (d.meta?.match(TIME_RANGE)?.[0] ?? d.time) : null;
      const meta = d.source === "calendar" ? [course, time, w && `${w} de la nota`].filter(Boolean).join(" · ") || null : [d.meta, w && `${w} de la nota`].filter(Boolean).join(" · ") || null;
      return { ...d, meta };
    });
}
