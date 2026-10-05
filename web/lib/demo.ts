// Datos estáticos del prototipo para las secciones que todavía no tienen
// fuente real: Universidad (Canvas, fase 3), Salud (Garmin, cuando no hay
// foto incrustada) y Finanzas (PocketSmith/CSV, fase 4).
import { addDays, todayISO } from "./dates";
import type { GarminSnapshot } from "./health";

export const DEMO = {
  budget: { month: "octubre", total: 1800, spent: 286, perDay: 56 },

  assignments: [
    { id: "a1", title: "SQL Lab 3 · Joins", course: "ISM 4212", days: 1, weight: 5, time: "2h", checklist: ["Leer instrucciones en Canvas", "INNER y LEFT JOIN (ej. 1–4)", "Subqueries (ej. 5–6)", "Exportar .sql y subir"] },
    { id: "a2", title: "Tableau Dashboard Project", course: "ISM 4402", days: 3, weight: 15, time: "5h", checklist: ["Limpiar dataset en Tableau Prep", "3 visualizaciones + 1 KPI", "Armar dashboard con filtros", "Story de 4 puntos", "Publicar en Tableau Public"] },
    { id: "a3", title: "Midterm · Estadística", course: "QMB 3200", days: 9, weight: 25, time: "8h estudio", checklist: ["Caps. 4–7 resumen", "Practice exam 1", "Practice exam 2", "Hoja de fórmulas"] },
    { id: "a4", title: "Case study write-up", course: "ISM 3232", days: 6, weight: 10, time: "3h", checklist: ["Leer caso", "Análisis en Excel", "Escribir 2 páginas"] },
    { id: "a5", title: "Discussion post semana 7", course: "ISM 3232", days: 5, weight: 2, time: "30 min", checklist: ["Post inicial", "Responder a 2 compañeros"] },
  ],
  study: [
    { mins: "60 min", subject: "SQL · joins y subqueries", why: "Lab 3 vence mañana (5% de la nota)" },
    { mins: "45 min", subject: "Estadística · cap. 6", why: "Midterm en 9 días (25%) · empezar ya rinde más" },
    { mins: "30 min", subject: "Tableau · limpiar dataset", why: "Project en 3 días (15%)" },
  ],
  courses: [
    { code: "ISM 4212", name: "Database Management", grade: "A− · 91%" },
    { code: "ISM 4402", name: "Business Intelligence", grade: "A · 94%" },
    { code: "QMB 3200", name: "Business Statistics", grade: "B+ · 87%" },
    { code: "ISM 3232", name: "Business Analytics", grade: "A− · 90%" },
  ],

  photos: ["1 ago", "1 sep", "1 oct"],

  insights: [
    { icon: "ph ph-trend-up", text: "Este mes llevas $312 más que el mes pasado.", sub: "Septiembre $1,550 vs agosto $1,238" },
    { icon: "ph ph-fork-knife", text: "Tu mayor aumento fue restaurantes.", sub: "+$176 · 14 pedidos de delivery" },
    { icon: "ph ph-piggy-bank", text: "Puedes ahorrar aproximadamente $140 eliminando/reduciendo estas 3 cosas.", sub: "Detalle abajo a la derecha" },
  ],
  categories: [
    ["Food", "ph ph-fork-knife", 538, 362],
    ["Education", "ph ph-books", 420, 410],
    ["Shopping", "ph ph-shopping-bag", 164, 120],
    ["Transportation", "ph ph-car", 142, 128],
    ["Entertainment", "ph ph-film-slate", 96, 70],
    ["Subscriptions", "ph ph-repeat", 87, 61],
    ["Other", "ph ph-dots-three", 58, 42],
    ["Gym", "ph ph-barbell", 45, 45],
  ] as [string, string, number, number][],
  savings: [
    { title: "Reducir delivery a 1 por semana", detail: "Uber Eats + DoorDash · 14 pedidos en sep", amt: "$70" },
    { title: "Café fuera de casa", detail: "Starbucks · 18 visitas", amt: "$42" },
    { title: "Suscripciones duplicadas", detail: "Spotify + Apple Music · Max sin uso", amt: "$28" },
  ],
  transactions: [
    { date: "30 sep", merchant: "Uber Eats", cat: "Food", amt: "$24.80" },
    { date: "29 sep", merchant: "FIU Bookstore", cat: "Education", amt: "$89.00" },
    { date: "28 sep", merchant: "Shell", cat: "Transportation", amt: "$41.20" },
    { date: "27 sep", merchant: "Spotify", cat: "Subscriptions", amt: "$11.99" },
    { date: "26 sep", merchant: "Amazon", cat: "Shopping", amt: "$36.45" },
    { date: "25 sep", merchant: "LA Fitness", cat: "Gym", amt: "$45.00" },
    { date: "24 sep", merchant: "AMC Theatres", cat: "Entertainment", amt: "$18.50" },
    { date: "24 sep", merchant: "Publix", cat: "Food", amt: "$62.13" },
  ],
};

/** Foto de Garmin inventada (la del prototipo), con fechas relativas a hoy. */
export function demoSnapshot(): GarminSnapshot {
  const ref = todayISO();
  const weights = [89.4, 89.1, 89.6, 89.0, 88.8, 89.2, 88.7, 88.9, 88.5, 88.8, 88.3, 88.6, 88.1, 88.4, 88.0, 87.75, 87.7, 87.6, 87.9, 87.5, 87.7, 87.3, 87.6, 87.1, 87.4, 86.9, 87.2, 86.8];
  const steps = [9100, 7800, 10200, 8400, 7600, 9300, 6240];
  const at = (n: number, time: string) => `${addDays(ref, n)} ${time}`;
  return {
    synced_at: new Date().toISOString(),
    weights: weights.map((kg, i) => ({ date: addDays(ref, i - weights.length + 1), kg })),
    days: steps.map((s, i) => ({ date: addDays(ref, i - steps.length + 1), steps: s, total_kcal: 2900 + (s % 700), active_kcal: 600 + (s % 500), partial: i === steps.length - 1 })),
    sleep: [{ date: ref, hours: 7.08, score: 78, hrv: 88 }],
    activities: [
      { start: at(-6, "18:00:00"), type: "strength_training", name: "Upper A", minutes: 62, distance_m: null, kcal: 480, avg_hr: 112 },
      { start: at(-5, "18:00:00"), type: "strength_training", name: "Lower A", minutes: 58, distance_m: null, kcal: 455, avg_hr: 118 },
      { start: at(-3, "07:30:00"), type: "running", name: "Zona 2", minutes: 34, distance_m: 5200, kcal: 390, avg_hr: 138 },
      { start: at(-2, "18:00:00"), type: "strength_training", name: "Upper B", minutes: 55, distance_m: null, kcal: 430, avg_hr: 110 },
    ],
    today: { date: ref, steps: 6240, step_goal: 10000, resting_hr: 56, resting_hr_7d: 57, body_battery: 64, body_battery_high: 92 },
  };
}
