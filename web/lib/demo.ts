// Datos estáticos del prototipo para las secciones que todavía no tienen
// fuente real: Universidad (Canvas, fase 3), Salud (Garmin, fase 2) y
// Finanzas (PocketSmith/CSV, fase 4). Se reemplazan pieza por pieza.

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

  weights: [89.4, 89.1, 89.6, 89.0, 88.8, 89.2, 88.7, 88.9, 88.5, 88.8, 88.3, 88.6, 88.1, 88.4, 88.0, 87.75, 87.7, 87.6, 87.9, 87.5, 87.7, 87.3, 87.6, 87.1, 87.4, 86.9, 87.2, 86.8],
  goalKg: 85,
  weightStats: [
    { label: "Peso hoy", value: "86.8 kg", sub: "−0.4 vs ayer", accent: false },
    { label: "Tendencia 7 días", value: "87.2 kg", sub: "El número que importa", accent: true },
    { label: "Pérdida semanal", value: "−0.55 kg", sub: "0.63% del peso · ritmo sostenible", accent: false },
    { label: "Estimado 85 kg", value: "25–30 oct", sub: "Al ritmo actual de tendencia", accent: false },
  ],
  healthMetrics: [
    { icon: "ph ph-ruler", label: "Cintura", value: "91.5 cm", pct: 60, sub: "−1.0 cm en 2 semanas" },
    { icon: "ph ph-sneaker-move", label: "Pasos", value: "6,240", pct: 62, sub: "Media 7 días 8,420" },
    { icon: "ph ph-moon", label: "Sueño", value: "7h 05m", pct: 88, sub: "Garmin · score 78" },
    { icon: "ph ph-fire", label: "Calorías", value: "1,480", pct: 67, sub: "de 2,200 kcal · 132 g proteína" },
    { icon: "ph ph-barbell", label: "Gym", value: "3 / 5", pct: 60, sub: "Sesiones esta semana" },
  ],
  workouts: [
    { day: "Lun 28", name: "Upper A · press banca 4×6 @ 80 kg", dur: "62 min", src: "Manual" },
    { day: "Mar 29", name: "Lower A · sentadilla 4×5 @ 100 kg", dur: "58 min", src: "Manual" },
    { day: "Jue 1", name: "Zona 2 · 5.2 km", dur: "34 min", src: "Garmin" },
    { day: "Vie 2", name: "Upper B · dominadas 4×8", dur: "55 min", src: "Manual" },
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
