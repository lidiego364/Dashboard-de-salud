import { addDays, daysBetween } from "./dates";
import type { Area, Reminder, Task } from "./types";
import type { CalEvent } from "./calendar";

const doneOn = (t: Task, day: string, toISO: (d: Date) => string) => !!t.done_at && toISO(new Date(t.done_at)) === day;

/** Tareas de "Hoy": pendientes sin fecha o con fecha ≤ hoy, más las completadas hoy. */
export function tasksForToday(tasks: Task[], today: string, toISO: (d: Date) => string): Task[] {
  return tasks
    .filter((t) => {
      if (t.done_at) return doneOn(t, today, toISO) && (t.due_date === null || t.due_date <= today);
      return t.due_date === null || t.due_date <= today;
    })
    .sort(byDue);
}

export function byDue(a: Task, b: Task) {
  const ka = `${a.due_date ?? "9999"}${a.due_time ?? "99"}`;
  const kb = `${b.due_date ?? "9999"}${b.due_time ?? "99"}`;
  return ka < kb ? -1 : ka > kb ? 1 : a.created_at.localeCompare(b.created_at);
}

/** Pendientes primero (por fecha), luego las hechas (más recientes primero). */
export function areaTasks(tasks: Task[], area: Area): Task[] {
  const mine = tasks.filter((t) => t.area === area);
  const open = mine.filter((t) => !t.done_at).sort(byDue);
  const done = mine.filter((t) => t.done_at).sort((a, b) => b.done_at!.localeCompare(a.done_at!));
  return [...open, ...done];
}

export function upcomingReminders(reminders: Reminder[], area?: Area): Reminder[] {
  return reminders
    .filter((r) => !r.done_at && (!area || r.area === area))
    .sort((a, b) => a.remind_on.localeCompare(b.remind_on));
}

export type WeekEvent = {
  id: string;
  kind: "task" | "reminder" | "calendar";
  area: Area | null;
  time: string;
  title: string;
  done: boolean;
  link?: string | null;
};

/** Siete días a partir de hoy: eventos del calendario, tareas y recordatorios.
 *  Orden del día: lo que tiene hora (por hora), luego lo de todo el día, luego recordatorios. */
export function weekAhead(tasks: Task[], reminders: Reminder[], today: string, calendar: CalEvent[] = []) {
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i);
    const timed: (WeekEvent & { key: string })[] = [];
    const allDay: WeekEvent[] = [];
    for (const c of calendar.filter((c) => c.date === day)) {
      const ev: WeekEvent = { id: c.id, kind: "calendar", area: null, time: c.time ? (c.endTime ? `${c.time}–${c.endTime}` : c.time) : "Todo el día", title: c.title, done: false, link: c.link };
      if (c.time) timed.push({ ...ev, key: c.time });
      else allDay.push(ev);
    }
    for (const t of tasks.filter((t) => t.due_date === day).sort(byDue)) {
      const ev: WeekEvent = { id: t.id, kind: "task", area: t.area, time: t.due_time ? t.due_time.slice(0, 5) : "Todo el día", title: t.title, done: !!t.done_at };
      if (t.due_time) timed.push({ ...ev, key: t.due_time.slice(0, 5) });
      else allDay.push(ev);
    }
    timed.sort((a, b) => a.key.localeCompare(b.key));
    const rem: WeekEvent[] = reminders
      .filter((r) => r.remind_on === day && !r.done_at)
      .map((r) => ({ id: r.id, kind: "reminder", area: r.area, time: "—", title: r.title, done: false }));
    return { day, events: [...timed.map(({ key: _key, ...e }) => e), ...allDay, ...rem] };
  });
}

/** Próximas entregas de la universidad (tareas del área uni con fecha ≥ hoy). */
export function upcomingDeadlines(tasks: Task[], today: string, n = 3) {
  return tasks
    .filter((t) => t.area === "uni" && !t.done_at && t.due_date && t.due_date >= today)
    .sort(byDue)
    .slice(0, n)
    .map((t) => ({ task: t, days: daysBetween(today, t.due_date!) }));
}
