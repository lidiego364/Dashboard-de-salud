// Convierte las respuestas del conector de Garmin (las mismas que devuelven
// sus herramientas) en la "foto" que usa la app. Lo usan la página en vivo
// (lib/health-live.ts) y el script standalone/make-snapshot.mjs.
import { addDays } from "./dates";
import type { GarminSnapshot } from "./health";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

export type GarminRaw = {
  weighIns: Json; // get_weigh_ins
  stats: Json; // get_stats_range
  activities: Json; // get_activities_by_date
  sleep: Json; // get_sleep_summary_range
  summary: Json; // get_user_summary
};

/** Herramientas y argumentos para armar la foto del día `today` (YYYY-MM-DD). */
export function garminCalls(today: string) {
  return {
    weighIns: { tool: "get_weigh_ins", input: { start_date: addDays(today, -60), end_date: today } },
    stats: { tool: "get_stats_range", input: { start_date: addDays(today, -27), end_date: today } },
    activities: { tool: "get_activities_by_date", input: { start_date: addDays(today, -13), end_date: today, page_size: 100 } },
    sleep: { tool: "get_sleep_summary_range", input: { start_date: addDays(today, -7), end_date: today } },
    summary: { tool: "get_user_summary", input: { date: today } },
  } satisfies Record<keyof GarminRaw, { tool: string; input: Record<string, unknown> }>;
}

export function toSnapshot(raw: GarminRaw): GarminSnapshot {
  const { weighIns, stats, activities, sleep, summary } = raw;

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
    days: (stats?.days ?? [])
      .filter((d: Json) => d.has_data)
      .map((d: Json) => ({ date: d.date, steps: d.steps ?? 0, total_kcal: d.total_calories ?? 0, active_kcal: d.active_calories ?? 0, partial: !!d.is_partial })),
    sleep: (sleep?.nights ?? [])
      .filter((n: Json) => n.sleep_hours)
      .map((n: Json) => ({ date: n.date, hours: n.sleep_hours, score: n.sleep_score ?? null, hrv: n.avg_overnight_hrv ?? null })),
    activities: (activities?.activities ?? []).map((a: Json) => ({
      start: a.start_time,
      type: a.type,
      name: a.name,
      minutes: Math.round((a.duration_seconds ?? 0) / 60),
      distance_m: a.distance_meters ? Math.round(a.distance_meters) : null,
      kcal: Math.round(a.calories ?? 0),
      avg_hr: a.avg_hr_bpm ? Math.round(a.avg_hr_bpm) : null,
    })),
    today: {
      date: today,
      steps: summary.totalSteps ?? 0,
      step_goal: summary.dailyStepGoal ?? 10000,
      resting_hr: summary.restingHeartRate ?? null,
      resting_hr_7d: summary.lastSevenDaysAvgRestingHeartRate ?? null,
      body_battery: summary.bodyBatteryMostRecentValue ?? null,
      body_battery_high: summary.bodyBatteryHighestValue ?? null,
    },
  };
}
