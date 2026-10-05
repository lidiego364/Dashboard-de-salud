// Datos estáticos del prototipo para lo que todavía no tiene fuente real:
// Finanzas (fase 4) y Salud cuando no hay foto de Garmin.
import { addDays, todayISO } from "./dates";
import type { GarminSnapshot } from "./health";

export const DEMO = {
  budget: { month: "octubre", total: 1800, spent: 286, perDay: 56 },

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

/** Foto de Garmin inventada (pesos del prototipo), con fechas relativas a hoy. */
export function demoSnapshot(): GarminSnapshot {
  const ref = todayISO();
  const weights = [89.4, 89.1, 89.6, 89.0, 88.8, 89.2, 88.7, 88.9, 88.5, 88.8, 88.3, 88.6, 88.1, 88.4, 88.0, 87.75, 87.7, 87.6, 87.9, 87.5, 87.7, 87.3, 87.6, 87.1, 87.4, 86.9, 87.2, 86.8];
  return {
    synced_at: new Date().toISOString(),
    weights: weights.map((kg, i) => ({ date: addDays(ref, i - weights.length + 1), kg })),
    today: { date: ref },
  };
}
