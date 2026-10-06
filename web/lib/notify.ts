// Fase 5: bloques de estudio en Google Calendar y avisos al celular.
import type { CalEvent } from "./calendar";
import { TZ } from "./dates";

const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
const toHM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Primer hueco libre del día con `minutes` seguidos, desde ahora (redondeado al
 *  siguiente cuarto de hora, con 10 min de margen) y entre `from` y `to`. */
export function freeSlot(events: CalEvent[], date: string, minutes: number, now: string | null, from = "08:00", to = "23:00") {
  const busy = events
    .filter((e) => e.date === date && e.time)
    .map((e) => [toMin(e.time!), toMin(e.endTime && e.endTime > e.time! ? e.endTime : e.time!) || toMin(e.time!) + 30] as const)
    .sort((a, b) => a[0] - b[0]);
  let start = Math.max(toMin(from), now ? Math.ceil((toMin(now) + 10) / 15) * 15 : 0);
  for (const [s, e] of busy) {
    if (s - start >= minutes) break;
    if (e > start) start = Math.ceil(e / 15) * 15;
  }
  return start + minutes <= toMin(to) ? { start: toHM(start), end: toHM(start + minutes) } : null;
}

/** Título de los bloques que crea la página (no cuentan como entregas). */
export const studyTitle = (title: string) => `Estudiar: ${title.replace(/\s*\[[^\]]*\]\s*$/, "")}`;

export function studyEventArgs(x: { title: string; course: string | null; why: string }, date: string, slot: { start: string; end: string }) {
  return {
    summary: studyTitle(x.title),
    description: `Bloque de estudio sugerido por Diego OS${x.course ? ` · ${x.course}` : ""} · ${x.why}.`,
    startTime: `${date}T${slot.start}:00`,
    endTime: `${date}T${slot.end}:00`,
    timeZone: TZ,
    overrideReminders: [{ method: "popup", minutes: 10 }],
    notificationLevel: "NONE",
  };
}

/** Avisos al celular (rutinas programadas de Claude). Se apagan desde la página
 *  guardando 0 en `settings`; sin fila = prendido. */
export const NOTIFY = [
  { key: "notify_morning", time: "7:47 am", title: "Resumen de la mañana", detail: "Lo de hoy en el calendario, entregas de los próximos 3 días, tareas que vencen y cuánto te queda del presupuesto." },
  { key: "notify_night", time: "8:47 pm", title: "Repaso de la noche", detail: "Si no marcaste la creatina, lo que vence mañana y las tareas de hoy sin terminar. Si todo está al día, no te escribe." },
] as const;
