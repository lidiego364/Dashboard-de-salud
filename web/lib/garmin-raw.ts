// Convierte las respuestas del conector de Garmin (las mismas que devuelven
// sus herramientas) en la "foto" que usa la app: solo pesajes y el día de hoy.
// Lo usan la página en vivo (lib/health-live.ts) y standalone/make-snapshot.mjs.
import { addDays } from "./dates";
import type { GarminSnapshot } from "./health";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

export type GarminRaw = {
  weighIns: Json; // get_weigh_ins
  summary: Json; // get_user_summary (fecha de hoy y hora de la última sincronización)
};

/** Herramientas y argumentos para armar la foto del día `today` (YYYY-MM-DD). */
export function garminCalls(today: string) {
  return {
    weighIns: { tool: "get_weigh_ins", input: { start_date: addDays(today, -60), end_date: today } },
    summary: { tool: "get_user_summary", input: { date: today } },
  } satisfies Record<keyof GarminRaw, { tool: string; input: Record<string, unknown> }>;
}

export function toSnapshot(raw: GarminRaw): GarminSnapshot {
  const { weighIns, summary } = raw;

  // Un pesaje por día (el último). "USER_SETTING" es el peso del perfil, no un pesaje.
  const byDay = new Map<string, { kg: number; ts: number }>();
  for (const m of weighIns?.measurements ?? []) {
    if (m.source_type === "USER_SETTING" || m.weight_kg == null || !m.date) continue;
    const prev = byDay.get(m.date);
    if (!prev || (m.timestamp_gmt ?? 0) > prev.ts) byDay.set(m.date, { kg: m.weight_kg, ts: m.timestamp_gmt ?? 0 });
  }

  const today: string | undefined = summary?.calendarDate;
  if (!today) throw new Error("Garmin no devolvió el resumen de hoy.");
  const lastSync: string | undefined = summary.lastSyncTimestampGMT;

  return {
    synced_at: lastSync ? `${lastSync.replace(/\.\d+$/, "")}Z` : new Date().toISOString(),
    weights: [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, kg: v.kg })),
    today: { date: today },
  };
}
