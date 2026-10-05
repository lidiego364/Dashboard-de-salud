// Fuente única de los datos de salud para toda la página:
// 1) arranca con la foto incrustada (window.__GARMIN__) o con datos de ejemplo;
// 2) si la página corre en claude.ai, pide los datos frescos al conector de
//    Garmin del propio usuario y reemplaza la foto.
import { todayISO } from "./dates";
import { garminCalls, garminExtraCalls, toSnapshot, type GarminRaw } from "./garmin-raw";
import { getSnapshot, type GarminSnapshot } from "./health";
import { explainMcpError, GARMIN_SERVER, getCapability, readTool, writeTool, type McpError } from "./claude-runtime";

export type HealthState = {
  snap: GarminSnapshot;
  /** "live": recién leído de Garmin · "baked": foto incrustada · "demo": ejemplo */
  source: "live" | "baked" | "demo";
  loading: boolean;
  /** Por qué no se pudo leer Garmin en vivo (texto para mostrar). */
  error: string | null;
};

let state: HealthState | null = null;
const listeners = new Set<(s: HealthState) => void>();
let started = false;

function emit(next: HealthState) {
  state = next;
  listeners.forEach((fn) => fn(next));
}

export function getHealthState(): HealthState {
  if (!state) {
    const { snap, live } = getSnapshot();
    state = { snap, source: live ? "baked" : "demo", loading: false, error: null };
  }
  return state;
}

export function subscribeHealth(fn: (s: HealthState) => void) {
  listeners.add(fn);
  if (!started) {
    started = true;
    void refreshFromGarmin();
  }
  return () => listeners.delete(fn);
}

/** Vuelve a leer Garmin (p. ej. después de registrar un peso). */
export function reloadHealth() {
  return refreshFromGarmin(true);
}

async function refreshFromGarmin(fresh = false) {
  const mcp = await getCapability("mcp");
  if (!mcp) return; // fuera de claude.ai: se queda con la foto o el ejemplo
  emit({ ...getHealthState(), loading: true });

  const calls = garminCalls(todayISO());
  // Cache de 5 min: abrir varias pestañas seguidas no repite las llamadas.
  const call = (tool: string, input: unknown) => readTool(mcp, GARMIN_SERVER, tool, input, fresh ? 0 : undefined);

  try {
    // El resumen va primero: es la llamada que pide el permiso la primera vez.
    const summary = await call(calls.summary.tool, calls.summary.input);
    const extra = garminExtraCalls(todayISO());
    // Los extras de recuperación no son obligatorios: si fallan quedan en undefined.
    const optional = (k: keyof typeof extra) => call(extra[k].tool, extra[k].input).catch(() => undefined);
    const [weighIns, stats, activities, sleep, hrv, training, readiness] = await Promise.all([
      ...(["weighIns", "stats", "activities", "sleep"] as const).map((k) => call(calls[k].tool, calls[k].input)),
      optional("hrv"),
      optional("training"),
      optional("readiness"),
    ]);
    const snap = toSnapshot({ weighIns, stats, activities, sleep, summary, hrv, training, readiness } as GarminRaw);
    emit({ snap, source: "live", loading: false, error: null });
  } catch (err) {
    emit({ ...getHealthState(), loading: false, error: explainMcpError(err, "Garmin") });
  }
}

/** "Registrar peso": guarda un pesaje en Garmin (como la app) y vuelve a leer. */
export async function logWeight(kg: number): Promise<{ ok: true } | { ok: false; message: string }> {
  const mcp = await getCapability("mcp");
  if (!mcp) return { ok: false, message: "Registrar peso funciona en la página de Diego OS dentro de claude.ai." };
  try {
    await writeTool(mcp, GARMIN_SERVER, "add_weigh_in", { weight: kg, unit_key: "kg" });
  } catch (err) {
    const e = err as McpError;
    if (e?.code === "server_unavailable" || e?.code === "upstream_error" || e?.code === "cancelled") {
      return { ok: false, message: "Garmin no confirmó a tiempo. Puede que sí se haya guardado: revisa en Garmin Connect antes de volver a intentarlo." };
    }
    return { ok: false, message: explainMcpError(err, "Garmin") };
  }
  try {
    await mcp.invalidate?.(GARMIN_SERVER);
  } catch {}
  await reloadHealth();
  return { ok: true };
}
