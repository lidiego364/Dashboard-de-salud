// Datos de ejemplo para Salud cuando no hay foto de Garmin.
import { addDays, todayISO } from "./dates";
import type { GarminSnapshot } from "./health";

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
