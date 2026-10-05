// Todo se calcula en la zona horaria de Miami, no en la del servidor.
export const TZ = "America/New_York";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Fecha local de hoy como YYYY-MM-DD. */
export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
}

export function currentHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now));
}

/** Parte un YYYY-MM-DD sin pasar por zonas horarias. */
function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

export function addDays(iso: string, n: number): string {
  const { y, m, d } = parts(iso);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = parts(fromISO);
  const b = parts(toISO);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

export function dayOfWeek(iso: string): number {
  const { y, m, d } = parts(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function dowShort(iso: string) {
  return DOW[dayOfWeek(iso)];
}

export function dayNum(iso: string) {
  return parts(iso).d;
}

export function monShort(iso: string) {
  return MONTHS[parts(iso).m - 1];
}

/** "8 oct" */
export function shortDate(iso: string) {
  return `${dayNum(iso)} ${monShort(iso)}`;
}

/** "Domingo, 4 de octubre" */
export function longToday(now = new Date()) {
  const s = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(now);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Mañana", "Hoy", "en 3 días", "hace 2 días" */
export function relativeDays(iso: string, today = todayISO()) {
  const n = daysBetween(today, iso);
  if (n === 0) return "Hoy";
  if (n === 1) return "Mañana";
  if (n === -1) return "Ayer";
  return n > 0 ? `en ${n} días` : `hace ${-n} días`;
}

/** "18:00" a partir de "18:00:00" */
export function hhmm(time: string | null) {
  return time ? time.slice(0, 5) : null;
}

export function greeting(now = new Date()) {
  const h = currentHour(now);
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** Hora actual en Miami como "HH:MM". */
export function nowHM(now = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
}
