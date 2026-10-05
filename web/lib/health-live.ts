// Fuente única de los datos de salud para toda la página:
// 1) arranca con la foto incrustada (window.__GARMIN__) o con datos de ejemplo;
// 2) si la página corre en claude.ai, pide los datos frescos al conector de
//    Garmin del propio usuario y reemplaza la foto.
import { todayISO } from "./dates";
import { garminCalls, toSnapshot } from "./garmin-raw";
import { getSnapshot, type GarminSnapshot } from "./health";
import { explainMcpError, GARMIN_SERVER, getCapability, readTool } from "./claude-runtime";

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

async function refreshFromGarmin() {
  const mcp = await getCapability("mcp");
  if (!mcp) return; // fuera de claude.ai: se queda con la foto o el ejemplo
  emit({ ...getHealthState(), loading: true });

  const calls = garminCalls(todayISO());
  // Cache de 5 min: abrir varias pestañas seguidas no repite las llamadas.
  const call = (tool: string, input: unknown) => readTool(mcp, GARMIN_SERVER, tool, input);

  try {
    // El resumen va primero: es la llamada que pide el permiso la primera vez.
    const summary = await call(calls.summary.tool, calls.summary.input);
    const weighIns = await call(calls.weighIns.tool, calls.weighIns.input);
    const snap = toSnapshot({ weighIns, summary });
    emit({ snap, source: "live", loading: false, error: null });
  } catch (err) {
    emit({ ...getHealthState(), loading: false, error: explainMcpError(err, "Garmin") });
  }
}
