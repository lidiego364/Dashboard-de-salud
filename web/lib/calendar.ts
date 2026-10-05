// Eventos de Google Calendar: conversión de la respuesta de list_events y
// lectura en vivo desde la página publicada en claude.ai.
import { addDays, todayISO, TZ } from "./dates";
import { CALENDAR_SERVER, explainMcpError, getCapability, readTool } from "./claude-runtime";

export type CalEvent = {
  id: string;
  title: string;
  date: string; // día local (YYYY-MM-DD) en que aparece
  time: string | null; // "14:00"; null = todo el día
  endTime: string | null;
  location: string | null;
  link: string | null;
};

const hm = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Respuesta de list_events → un CalEvent por día (los de varios días se repiten en cada uno). */
export function parseEvents(payload: any): CalEvent[] {
  const out: CalEvent[] = [];
  for (const e of payload?.events ?? []) {
    if (!e || e.status === "cancelled" || e.eventType === "WORKING_LOCATION") continue;
    const base = { title: e.summary || "(Sin título)", location: e.location || null, link: e.htmlLink || null };
    if (e.start?.dateTime) {
      const start = new Date(e.start.dateTime);
      const end = e.end?.dateTime ? new Date(e.end.dateTime) : null;
      out.push({ ...base, id: e.id, date: todayISO(start), time: hm(start), endTime: end ? hm(end) : null });
    } else if (e.start?.date) {
      // Todo el día: la fecha final es exclusiva. Google a veces la manda con "T00:00:00Z".
      const first = String(e.start.date).slice(0, 10);
      const last = e.end?.date ? addDays(String(e.end.date).slice(0, 10), -1) : first;
      for (let d = first, i = 0; d <= last && i < 31; d = addDays(d, 1), i++) {
        out.push({ ...base, id: `${e.id}:${d}`, date: d, time: null, endTime: null });
      }
    }
  }
  return out;
}

/** "2026-10-05T00:00:00-04:00": medianoche de Miami para ese día. */
function midnightIn(dateISO: string) {
  try {
    const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
      .formatToParts(new Date(`${dateISO}T12:00:00Z`))
      .find((p) => p.type === "timeZoneName")?.value; // "GMT-04:00"
    const off = name?.replace("GMT", "") || "Z";
    return `${dateISO}T00:00:00${off === "" ? "Z" : off}`;
  } catch {
    return `${dateISO}T00:00:00`;
  }
}

export type CalendarState = {
  /** false fuera de claude.ai: no hay conector que leer. */
  available: boolean;
  loading: boolean;
  events: CalEvent[];
  error: string | null;
};

let state: CalendarState = { available: false, loading: false, events: [], error: null };
const listeners = new Set<(s: CalendarState) => void>();
let started = false;

const emit = (next: CalendarState) => {
  state = next;
  listeners.forEach((fn) => fn(next));
};

export const getCalendarState = () => state;

export function subscribeCalendar(fn: (s: CalendarState) => void) {
  listeners.add(fn);
  if (!started) {
    started = true;
    void load();
  }
  return () => listeners.delete(fn);
}

async function load() {
  const mcp = await getCapability("mcp");
  if (!mcp) return;
  emit({ available: true, loading: true, events: [], error: null });
  const today = todayISO();
  try {
    const payload = await readTool(mcp, CALENDAR_SERVER, "list_events", {
      startTime: midnightIn(today),
      endTime: midnightIn(addDays(today, 7)),
      timeZone: TZ,
      orderBy: "startTime",
      pageSize: 250,
    });
    emit({ available: true, loading: false, events: parseEvents(payload), error: null });
  } catch (err) {
    emit({ available: true, loading: false, events: [], error: explainMcpError(err, "Google Calendar") });
  }
}
