import { addDays, daysBetween } from "./dates";
import type { Area, Reminder, Task } from "./types";
import { isDeadline, type CalEvent } from "./calendar";

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

export type Deadline = {
  key: string;
  title: string;
  meta: string | null;
  date: string;
  time: string | null;
  days: number;
  source: "task" | "calendar";
  link: string | null;
};

/** Próximas entregas: tareas del área Universidad + entregas/exámenes del
 *  calendario (de Canvas), sin las que ya pasaron. */
export function upcomingDeadlines(tasks: Task[], today: string, n = 5, calendar: CalEvent[] = [], now = "00:00"): Deadline[] {
  const fromTasks: Deadline[] = tasks
    .filter((t) => t.area === "uni" && !t.done_at && t.due_date && t.due_date >= today)
    .map((t) => ({
      key: `task:${t.id}`,
      title: t.title,
      meta: t.meta,
      date: t.due_date!,
      time: t.due_time ? t.due_time.slice(0, 5) : null,
      days: daysBetween(today, t.due_date!),
      source: "task",
      link: null,
    }));
  // Un evento de varios días cuenta una vez, en su último día (el de entrega).
  const lastDay = new Map<string, CalEvent>();
  for (const e of calendar.filter(isDeadline)) {
    const prev = lastDay.get(e.sourceId);
    if (!prev || e.date > prev.date) lastDay.set(e.sourceId, e);
  }
  const fromCal: Deadline[] = [...lastDay.values()]
    .filter((e) => e.date > today || (e.date === today && (!e.time || (e.endTime ?? e.time) > now)))
    .map((e) => ({
      key: `cal:${e.sourceId}`,
      title: e.title,
      meta: [e.course, e.time && `${e.time}${e.endTime ? `–${e.endTime}` : ""}`].filter(Boolean).join(" · ") || null,
      date: e.date,
      time: e.time,
      days: daysBetween(today, e.date),
      source: "calendar",
      link: e.link,
    }));
  return [...fromTasks, ...fromCal]
    .sort((a, b) => `${a.date}${a.time ?? "99"}`.localeCompare(`${b.date}${b.time ?? "99"}`))
    .slice(0, n);
}
