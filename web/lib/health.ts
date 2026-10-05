// Salud a partir de una "foto" de Garmin. En la versión de un solo archivo la
// foto se incrusta como window.__GARMIN__ al generar el HTML; si no hay foto
// (p. ej. la app Next.js antes de la fase 2) se usan datos de ejemplo.
import { addDays, daysBetween, dowShort, dayNum, shortDate, todayISO, TZ } from "./dates";
import { demoSnapshot } from "./demo";

/** Meta de peso (se compara contra la tendencia de 7 días, no contra un pesaje suelto). */
export const HEALTH_GOAL = { kg: 84, by: "2026-10-31" };

export type GarminSnapshot = {
  synced_at: string; // ISO con zona
  weights: { date: string; kg: number }[];
  days: { date: string; steps: number; total_kcal: number; active_kcal: number; partial: boolean }[];
  sleep: {
    date: string;
    hours: number;
    score: number;
    hrv: number | null;
    /** Fases en horas (opcionales: fotos viejas no las traen). */
    deep_h?: number | null;
    light_h?: number | null;
    rem_h?: number | null;
    awake_h?: number | null;
  }[];
  /** Extras de recuperación (opcionales: si su lectura falla, Salud sigue igual). */
  hrv?: { date: string; ms: number | null; weekly_ms: number | null; status: string | null }[];
  training?: {
    status: string | null; // "MAINTAINING_1"
    acute_load: number | null;
    chronic_load: number | null;
    ratio: number | null;
    acwr_status: string | null; // "OPTIMAL"
    balance: string | null; // "ANAEROBIC_FOCUS"
  } | null;
  recovery_hours?: number | null;
  activities: { start: string; type: string; name: string; minutes: number; distance_m: number | null; kcal: number; avg_hr: number | null }[];
  today: {
    date: string;
    steps: number;
    step_goal: number;
    resting_hr: number | null;
    resting_hr_7d: number | null;
    body_battery: number | null;
    body_battery_high: number | null;
  };
};

declare global {
  interface Window {
    __GARMIN__?: GarminSnapshot;
  }
}

export function getSnapshot(): { snap: GarminSnapshot; live: boolean } {
  const g = typeof window !== "undefined" ? window.__GARMIN__ : undefined;
  return g ? { snap: g, live: true } : { snap: demoSnapshot(), live: false };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtKg = (n: number) => n.toFixed(1);
const signed = (n: number, digits = 1) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(digits)}`;

export function fmtHours(h: number) {
  const m = Math.round(h * 60);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/** Media de los pesajes de los 7 días que terminan en `date` (incluido). */
export function trendAt(weights: GarminSnapshot["weights"], date: string): number | null {
  const from = addDays(date, -6);
  return avg(weights.filter((w) => w.date >= from && w.date <= date).map((w) => w.kg));
}

const TYPE_LABEL: Record<string, string> = {
  strength_training: "Fuerza",
  treadmill_running: "Cinta",
  running: "Carrera",
  walking: "Caminata",
  tennis_v2: "Tenis",
  tennis: "Tenis",
  racket_sports: "Raqueta",
  cycling: "Bici",
  indoor_cycling: "Bici fija",
  lap_swimming: "Natación",
  stop_watch: "Actividad libre",
};

// Solo en estas tiene sentido la distancia (en tenis/raqueta el GPS da números raros).
const DISTANCE_TYPES = new Set(["treadmill_running", "running", "walking", "cycling", "lap_swimming"]);

// Mismas traducciones que el Streamlit (garmin_sync.ESTADO_ENTRENAMIENTO_ES).
const TRAINING_ES: Record<string, string> = {
  PRODUCTIVE: "Productivo",
  MAINTAINING: "Mantenimiento",
  RECOVERY: "Recuperación",
  STRAINED: "Tensión",
  OVERREACHING: "Sobreesfuerzo",
  UNPRODUCTIVE: "Improductivo",
  DETRAINING: "Desentrenamiento",
  PEAKING: "Punto máximo",
  NO_STATUS: "Sin estado",
};
const HRV_ES: Record<string, { label: string; ok: boolean }> = {
  BALANCED: { label: "Equilibrado", ok: true },
  UNBALANCED: { label: "Desequilibrado", ok: false },
  LOW: { label: "Bajo", ok: false },
  POOR: { label: "Bajo", ok: false },
};
const ACWR_ES: Record<string, { label: string; ok: boolean }> = {
  OPTIMAL: { label: "óptima", ok: true },
  LOW: { label: "baja", ok: true },
  HIGH: { label: "alta", ok: false },
  VERY_HIGH: { label: "muy alta", ok: false },
};
const BALANCE_ES: Record<string, string> = {
  ANAEROBIC_FOCUS: "Enfoque anaeróbico",
  AEROBIC_HIGH_FOCUS: "Enfoque aeróbico intenso",
  AEROBIC_LOW_FOCUS: "Enfoque aeróbico suave",
  BALANCED: "Equilibrado",
  ANAEROBIC_SHORTAGE: "Falta anaeróbico",
  AEROBIC_HIGH_SHORTAGE: "Falta aeróbico intenso",
  AEROBIC_LOW_SHORTAGE: "Falta aeróbico suave",
};

function recoveryView(snap: GarminSnapshot) {
  const hrv = (snap.hrv ?? []).filter((d) => d.ms !== null).sort((a, b) => a.date.localeCompare(b.date));
  const lastHrv = hrv.at(-1);
  const hrvStatus = lastHrv?.status ? HRV_ES[lastHrv.status] ?? { label: lastHrv.status.toLowerCase(), ok: true } : null;

  const t = snap.training;
  const statusKey = t?.status?.replace(/_\d+$/, "") ?? null;
  const acwr = t?.acwr_status ? ACWR_ES[t.acwr_status] ?? { label: t.acwr_status.toLowerCase(), ok: true } : null;

  const nights = [...snap.sleep].sort((a, b) => a.date.localeCompare(b.date));
  const withStages = nights.filter((n) => n.deep_h != null || n.rem_h != null);
  const lastNight = withStages.at(-1);

  return {
    hrv: lastHrv
      ? {
          ms: lastHrv.ms!,
          weekly: lastHrv.weekly_ms,
          diff: lastHrv.weekly_ms !== null ? lastHrv.ms! - lastHrv.weekly_ms : null,
          status: hrvStatus,
          series: hrv.map((d) => ({ date: d.date, ms: d.ms!, weekly: d.weekly_ms })),
        }
      : null,
    training: t
      ? {
          label: statusKey ? TRAINING_ES[statusKey] ?? statusKey : "Sin estado",
          acute: t.acute_load,
          chronic: t.chronic_load,
          ratio: t.ratio,
          acwr,
          balance: t.balance ? BALANCE_ES[t.balance] ?? t.balance.toLowerCase().replace(/_/g, " ") : null,
        }
      : null,
    recoveryHours: snap.recovery_hours ?? null,
    sleep: lastNight
      ? {
          date: lastNight.date,
          total: lastNight.hours,
          stages: [
            { key: "deep", label: "Profundo", h: lastNight.deep_h ?? 0 },
            { key: "light", label: "Ligero", h: lastNight.light_h ?? 0 },
            { key: "rem", label: "REM", h: lastNight.rem_h ?? 0 },
            { key: "awake", label: "Despierto", h: lastNight.awake_h ?? 0 },
          ],
          week: withStages.slice(-7).map((n) => ({
            date: n.date,
            total: n.hours,
            score: n.score,
            deep: n.deep_h ?? 0,
            light: n.light_h ?? 0,
            rem: n.rem_h ?? 0,
            awake: n.awake_h ?? 0,
          })),
        }
      : null,
  };
}

export function healthView(snap: GarminSnapshot) {
  const ref = snap.today.date;
  const w = [...snap.weights].sort((a, b) => a.date.localeCompare(b.date));
  const last = w.at(-1);
  const prev = w.at(-2);
  const first = w[0];

  const trendNow = trendAt(w, ref);
  const trendWeekAgo = trendAt(w, addDays(ref, -7));
  const weekly = trendNow !== null && trendWeekAgo !== null ? trendNow - trendWeekAgo : null; // negativo = bajando
  const goal = HEALTH_GOAL;
  const toGo = trendNow !== null ? trendNow - goal.kg : null;
  const daysLeft = daysBetween(ref, goal.by);
  // Ritmo necesario para llegar a tiempo (kg/semana, positivo = hay que bajar).
  const needed = toGo !== null && toGo > 0 && daysLeft > 0 ? toGo / (daysLeft / 7) : null;
  let eta: string | null = null;
  if (toGo !== null && toGo <= 0) eta = "¡Meta alcanzada!";
  else if (toGo !== null && weekly !== null && weekly < 0) eta = `≈ ${shortDate(addDays(ref, Math.round((toGo / -weekly) * 7)))}`;
  else if (toGo !== null) eta = "Sin bajar";
  const onTrack = toGo !== null && (toGo <= 0 || (needed !== null && weekly !== null && -weekly >= needed));
  const goalTitle = `Llegar a ${goal.kg} kg al ${shortDate(goal.by)}`;

  const weightStats = [
    {
      label: last && last.date !== ref ? `Último peso · ${shortDate(last.date)}` : "Peso hoy",
      value: last ? `${fmtKg(last.kg)} kg` : "—",
      sub: last && prev ? `${signed(last.kg - prev.kg)} vs ${shortDate(prev.date)}` : "Sin pesajes previos",
      accent: false,
    },
    { label: "Tendencia 7 días", value: trendNow !== null ? `${fmtKg(trendNow)} kg` : "—", sub: "El número que importa", accent: true },
    {
      label: "Ritmo semanal",
      value: weekly !== null ? `${signed(weekly, 2)} kg` : "—",
      sub:
        weekly !== null && trendNow
          ? `${((Math.abs(weekly) / trendNow) * 100).toFixed(2)}% del peso · ${weekly < 0 ? (Math.abs(weekly) / trendNow > 0.01 ? "ritmo agresivo" : "ritmo sostenible") : "sin bajar esta semana"}`
          : "Faltan pesajes",
      accent: false,
    },
    {
      label: `Al ritmo actual llegas a ${goal.kg} kg`,
      value: eta ?? "—",
      sub:
        toGo === null || toGo <= 0
          ? "Con la tendencia de 7 días"
          : daysLeft <= 0
            ? `La fecha meta (${shortDate(goal.by)}) ya pasó · faltan ${fmtKg(toGo)} kg`
            : `${onTrack ? "Vas a tiempo" : "Para el " + shortDate(goal.by)}: −${needed!.toFixed(2)} kg/sem · ${daysLeft} días`,
      accent: !onTrack,
    },
  ];

  // Gráfico: últimos 28 días.
  const chartStart = addDays(ref, -27);
  const points = w.filter((p) => p.date >= chartStart && p.date <= ref);
  const chart = {
    start: chartStart,
    days: 28,
    points,
    trend: points.map((p) => ({ date: p.date, kg: trendAt(w, p.date)! })),
    goal: goal.kg,
  };

  // Métricas del día.
  const fullDays = snap.days.filter((d) => !d.partial && d.date >= addDays(ref, -7) && d.date < ref);
  const steps7 = avg(fullDays.map((d) => d.steps));
  const kcal7 = avg(fullDays.map((d) => d.total_kcal));
  const todayStats = snap.days.find((d) => d.date === ref);
  const night = [...snap.sleep].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const recent = snap.activities.filter((a) => a.start.slice(0, 10) >= addDays(ref, -6));
  const strength = recent.filter((a) => a.type === "strength_training" && a.minutes >= 30);
  const strengthDays = new Set(strength.map((a) => a.start.slice(0, 10))).size;

  const metrics = [
    {
      icon: "ph ph-sneaker-move",
      label: "Pasos hoy",
      value: fmtInt(snap.today.steps),
      pct: Math.min(100, (snap.today.steps / snap.today.step_goal) * 100),
      sub: `Meta ${fmtInt(snap.today.step_goal)}${steps7 ? ` · media 7 días ${fmtInt(steps7)}` : ""}`,
    },
    night && {
      icon: "ph ph-moon",
      label: "Sueño anoche",
      value: fmtHours(night.hours),
      pct: Math.min(100, (night.hours / 8) * 100),
      sub: `Score ${night.score}${night.hrv ? ` · HRV ${night.hrv} ms` : ""}`,
    },
    todayStats && {
      icon: "ph ph-fire",
      label: "Calorías quemadas",
      value: fmtInt(todayStats.total_kcal),
      pct: kcal7 ? Math.min(100, (todayStats.total_kcal / kcal7) * 100) : null,
      sub: `${fmtInt(todayStats.active_kcal)} activas${todayStats.partial ? " · día en curso" : ""}${kcal7 ? ` · media ${fmtInt(kcal7)}` : ""}`,
    },
    snap.today.resting_hr !== null && {
      icon: "ph ph-heartbeat",
      label: "FC en reposo",
      value: `${snap.today.resting_hr} ppm`,
      pct: null,
      sub: snap.today.resting_hr_7d !== null ? `Media 7 días ${snap.today.resting_hr_7d} ppm` : "Hoy",
    },
    snap.today.body_battery !== null && {
      icon: "ph ph-battery-high",
      label: "Body Battery",
      value: String(snap.today.body_battery),
      pct: snap.today.body_battery,
      sub: snap.today.body_battery_high !== null ? `Máximo hoy ${snap.today.body_battery_high}` : "Ahora",
    },
    {
      icon: "ph ph-barbell",
      label: "Gym · 7 días",
      value: `${strengthDays} / 5`,
      pct: Math.min(100, (strengthDays / 5) * 100),
      sub: "Días con sesión de fuerza",
    },
  ].filter(Boolean) as { icon: string; label: string; value: string; pct: number | null; sub: string }[];

  const workouts = [...recent]
    .sort((a, b) => b.start.localeCompare(a.start))
    .map((a) => {
      const date = a.start.slice(0, 10);
      const km = a.distance_m && DISTANCE_TYPES.has(a.type) ? ` · ${(a.distance_m / 1000).toFixed(1)} km` : "";
      return {
        key: a.start + a.type,
        day: `${dowShort(date)} ${dayNum(date)}`,
        name: (TYPE_LABEL[a.type] ?? a.name) + km,
        dur: `${a.minutes} min`,
        hr: a.avg_hr ? `${Math.round(a.avg_hr)} ppm` : "—",
        kcal: fmtInt(a.kcal),
      };
    });

  const synced = new Date(snap.synced_at);
  const syncedLabel = `${shortDate(todayISO(synced))} ${synced.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: TZ })}`;

  return {
    subtitle: first
      ? `Meta ${goal.kg} kg al ${shortDate(goal.by)} · empezaste en ${fmtKg(first.kg)} kg el ${shortDate(first.date)}${last ? ` · llevas ${signed(last.kg - first.kg)} kg` : ""}`
      : `Meta ${goal.kg} kg al ${shortDate(goal.by)}`,
    // Objetivo calculado para la tarjeta "Objetivos" (progreso desde el primer pesaje).
    goal: {
      title: goalTitle,
      status:
        trendNow === null
          ? "Sin pesajes"
          : toGo! <= 0
            ? `${fmtKg(trendNow)} kg · ¡logrado!`
            : `${fmtKg(trendNow)} kg · faltan ${fmtKg(toGo!)}${daysLeft > 0 ? ` · ${daysLeft} días` : ""}`,
      progress:
        first && trendNow !== null && first.kg > goal.kg
          ? Math.max(0, Math.min(100, ((first.kg - trendNow) / (first.kg - goal.kg)) * 100))
          : 0,
      onTrack,
    },
    weightStats,
    chart,
    recovery: recoveryView(snap),
    metrics,
    workouts,
    syncedLabel,
    hoy: {
      weight: last ? fmtKg(last.kg) : "—",
      trend: trendNow !== null ? fmtKg(trendNow) : "—",
      steps: fmtInt(snap.today.steps),
      stepGoal: `${(snap.today.step_goal / 1000).toFixed(snap.today.step_goal % 1000 ? 1 : 0)}k`,
      sleep: night ? fmtHours(night.hours) : "—",
    },
  };
}
