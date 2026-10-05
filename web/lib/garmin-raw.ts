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
  // Opcionales (recuperación)
  hrv?: Json; // get_hrv_trend
  training?: Json; // get_training_status
  readiness?: Json; // get_morning_training_readiness
};

/** Lecturas extra de recuperación: si fallan, se omiten. */
export function garminExtraCalls(today: string) {
  return {
    hrv: { tool: "get_hrv_trend", input: { start_date: addDays(today, -13), end_date: today } },
    training: { tool: "get_training_status", input: { date: today } },
    readiness: { tool: "get_morning_training_readiness", input: { date: today } },
  } satisfies Record<"hrv" | "training" | "readiness", { tool: string; input: Record<string, unknown> }>;
}

/** Herramientas y argumentos para armar la foto del día `today` (YYYY-MM-DD). */
export function garminCalls(today: string) {
  return {
    weighIns: { tool: "get_weigh_ins", input: { start_date: addDays(today, -60), end_date: today } },
    stats: { tool: "get_stats_range", input: { start_date: addDays(today, -27), end_date: today } },
    activities: { tool: "get_activities_by_date", input: { start_date: addDays(today, -13), end_date: today, page_size: 100 } },
    sleep: { tool: "get_sleep_summary_range", input: { start_date: addDays(today, -7), end_date: today } },
    summary: { tool: "get_user_summary", input: { date: today } },
  } satisfies Record<"weighIns" | "stats" | "activities" | "sleep" | "summary", { tool: string; input: Record<string, unknown> }>;
}

export function toSnapshot(raw: GarminRaw): GarminSnapshot {
  const { weighIns, stats, activities, sleep, summary, hrv, training, readiness } = raw;
  const hours = (sec: unknown) => (typeof sec === "number" ? Math.round((sec / 3600) * 100) / 100 : null);

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
      .map((n: Json) => ({
        date: n.date,
        hours: n.sleep_hours,
        score: n.sleep_score ?? null,
        hrv: n.avg_overnight_hrv ?? null,
        deep_h: hours(n.deep_sleep_seconds),
        light_h: hours(n.light_sleep_seconds),
        rem_h: hours(n.rem_sleep_seconds),
        awake_h: hours(n.awake_seconds),
      })),
    hrv: Array.isArray(hrv?.trend)
      ? hrv.trend.map((d: Json) => ({ date: d.date, ms: d.last_night_avg_hrv_ms ?? null, weekly_ms: d.weekly_avg_hrv_ms ?? null, status: d.status ?? null }))
      : undefined,
    training: training
      ? {
          status: training.training_status_feedback ?? null,
          acute_load: training.acute_load ?? null,
          chronic_load: training.chronic_load ?? null,
          ratio: training.load_ratio ?? null,
          acwr_status: training.acwr_status ?? null,
          balance: training.training_balance_feedback ?? null,
        }
      : undefined,
    recovery_hours: typeof readiness?.recovery_time_hours === "number" ? readiness.recovery_time_hours : undefined,
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
