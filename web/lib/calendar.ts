// Eventos de Google Calendar: conversión de la respuesta de list_events y
// lectura en vivo desde la página publicada en claude.ai.
import { addDays, todayISO, TZ } from "./dates";
import { CALENDAR_SERVER, explainMcpError, getCapability, readTool, type McpError } from "./claude-runtime";

export type CalEvent = {
  id: string;
  /** id del evento en Google (los de varios días comparten este id). */
  sourceId: string;
  title: string;
  /** Curso que Canvas pone entre corchetes al final: "… [Database Applications]". */
  course: string | null;
  /** Se repite (una clase semanal, no una entrega). */
  recurring: boolean;
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
    const raw = String(e.summary || "").trim();
    const m = raw.match(/\s*\[([^\]]+)\]\s*$/);
    const base = {
      sourceId: String(e.id),
      title: (m ? raw.slice(0, m.index).trim() : raw) || "(Sin título)",
      course: m ? m[1].trim() : null,
      recurring: !!e.recurringEventId,
      location: e.location || null,
      link: e.htmlLink || null,
    };
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

const DEADLINE_WORDS = /\b(exam\w*|quiz\w*|midterm|final|assignment|homework|hw|project|lab|due|deadline|entrega|examen|parcial|tarea)\b/i;

/** ¿Es una entrega o examen (y no una clase)? Canvas exporta las entregas con el
 *  curso entre corchetes; las clases son eventos que se repiten. Las horas de
 *  oficina también traen curso, pero no son entregas. */
const NOT_DEADLINE = /\b(office\s*hours?|horas?\s+de\s+oficina|review\s+session|tutoring)\b|^estudiar:/i;

export function isDeadline(e: CalEvent) {
  if (e.recurring || NOT_DEADLINE.test(e.title)) return false;
  return e.course !== null || DEADLINE_WORDS.test(e.title.replace(/_/g, " "));
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

async function load(refresh = false) {
  const mcp = await getCapability("mcp");
  if (!mcp) return;
  if (!refresh) emit({ available: true, loading: true, events: [], error: null });
  const today = todayISO();
  try {
    const payload = await readTool(mcp, CALENDAR_SERVER, "list_events", {
      startTime: midnightIn(today),
      // 3 semanas: la vista de la semana usa 7 días; Deadlines FIU mira más lejos.
      endTime: midnightIn(addDays(today, 21)),
      timeZone: TZ,
      orderBy: "startTime",
      pageSize: 250,
    }, refresh ? 0 : undefined);
    const events = parseEvents(payload);
    emit({ available: true, loading: false, events, error: null });
    void saveSnapshot(events);
  } catch (err) {
    emit({ available: true, loading: false, events: [], error: explainMcpError(err, "Google Calendar") });
  }
}

/** Crea un evento (un toque del usuario = una llamada; nunca se reintenta) y vuelve a leer. */
export async function createEvent(args: Record<string, unknown>) {
  const mcp = await getCapability("mcp");
  if (!mcp) throw new Error("Abre Diego OS dentro de claude.ai para usar tu Google Calendar.");
  try {
    await mcp.callTool(CALENDAR_SERVER, "create_event", args, { cache: false });
  } catch (err) {
    const e = err as McpError;
    // Sin respuesta no sabemos si se creó: se relee el calendario antes de dejar reintentar.
    if (e?.code === "server_unavailable" || e?.code === "upstream_error") void load(true);
    throw new Error(e?.code === "server_unavailable" || e?.code === "upstream_error" ? "No sé si se creó: revisa tu calendario antes de volver a intentarlo." : explainMcpError(err, "Google Calendar"));
  }
  await load(true);
}

/** Copia compacta de las próximas 3 semanas en la base de la página: la leen los avisos al
 *  celular (rutinas de Claude), que no tienen el conector de Calendar. */
let lastSnapshot = "";
async function saveSnapshot(events: CalEvent[]) {
  const db = await getCapability("db");
  if (!db) return;
  const compact = events.map((e) => ({
    date: e.date,
    time: e.time,
    end: e.endTime,
    title: e.title,
    course: e.course,
    recurring: e.recurring,
    deadline: isDeadline(e),
  }));
  const json = JSON.stringify(compact);
  if (json === lastSnapshot) return;
  try {
    await db.doc("cal_cache/upcoming").set({ synced_at: new Date().toISOString(), events: compact });
    lastSnapshot = json;
  } catch {
    // Solo afecta a los avisos; la página sigue igual.
  }
}
