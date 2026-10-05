// Salud = tendencia del peso, a partir de una "foto" de Garmin. En la versión
// de un solo archivo la foto se incrusta como window.__GARMIN__; en claude.ai se
// lee en vivo (lib/health-live.ts); si no hay ninguna se usan datos de ejemplo.
// (Lo demás de Garmin —sueño, pasos, entrenamientos— se ve en la app de Garmin.)
import { addDays, daysBetween, shortDate, todayISO, TZ } from "./dates";
import { demoSnapshot } from "./demo";

/** Meta de peso (se compara contra la tendencia de 7 días, no contra un pesaje suelto). */
export const HEALTH_GOAL = { kg: 84, by: "2026-10-31" };

export type GarminSnapshot = {
  synced_at: string; // ISO con zona
  weights: { date: string; kg: number }[];
  today: { date: string };
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
const fmtKg = (n: number) => n.toFixed(1);
const signed = (n: number, digits = 1) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(digits)}`;

/** Media de los pesajes de los 7 días que terminan en `date` (incluido). */
export function trendAt(weights: GarminSnapshot["weights"], date: string): number | null {
  const from = addDays(date, -6);
  return avg(weights.filter((w) => w.date >= from && w.date <= date).map((w) => w.kg));
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
    syncedLabel,
    hoy: {
      weight: last ? fmtKg(last.kg) : "—",
      trend: trendNow !== null ? fmtKg(trendNow) : "—",
      weekly: weekly !== null ? `${signed(weekly, 2)} kg/sem` : "—",
      eta: eta ?? "—",
      onTrack,
    },
  };
}
