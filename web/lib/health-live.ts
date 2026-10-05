// Fuente única de los datos de salud para toda la página:
// 1) arranca con la foto incrustada (window.__GARMIN__) o con datos de ejemplo;
// 2) si la página corre en claude.ai, pide los datos frescos al conector de
//    Garmin del propio usuario y reemplaza la foto.
import { todayISO } from "./dates";
import { garminCalls, toSnapshot, type GarminRaw } from "./garmin-raw";
import { getSnapshot, type GarminSnapshot } from "./health";
import { GARMIN_SERVER, getCapability, type McpError } from "./claude-runtime";

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

function explain(e: McpError): string {
  switch (e.code) {
    case "needs_reauth":
      return "Tu conexión con Garmin venció. Reconéctala en claude.ai → Configuración → Conectores.";
    case "server_not_connected":
    case "server_not_found":
      return "No encuentro tu conector de Garmin. Agrégalo en claude.ai → Configuración → Conectores.";
    case "selection_required":
      return "Tienes más de un conector de Garmin: elige cuál usar en el aviso de claude.ai.";
    case "not_in_manifest":
    case "consent_required":
      return "Esta página no tiene permiso para leer Garmin. Actívalo en el menú Permisos de la página.";
    case "blocked_by_policy":
    case "approval_required":
      return "Tu organización bloquea este conector de Garmin para páginas.";
    case "server_unavailable":
    case "rate_limited":
      return "Garmin no respondió a tiempo. Vuelve a abrir la página en un rato.";
    case "tool_error":
      return `Garmin respondió con un error: ${e.message}`;
    default:
      return "No se pudieron leer tus datos de Garmin.";
  }
}

async function refreshFromGarmin() {
  const mcp = await getCapability("mcp");
  if (!mcp) return; // fuera de claude.ai: se queda con la foto o el ejemplo
  emit({ ...getHealthState(), loading: true });

  const calls = garminCalls(todayISO());
  const call = async (tool: string, input: unknown, retried = false): Promise<unknown> => {
    try {
      // Cache de 5 min: abrir varias pestañas seguidas no repite las llamadas.
      return (await mcp.callTool(GARMIN_SERVER, tool, input, { cache: { staleTime: 5 * 60_000 } })).payload;
    } catch (err) {
      const e = err as McpError;
      if (e?.retryable && !retried) {
        await new Promise((r) => setTimeout(r, (e.retryAfterMs ?? 1500) + Math.random() * 1000));
        return call(tool, input, true);
      }
      throw e;
    }
  };

  try {
    // El resumen va primero: es la llamada que pide el permiso la primera vez.
    const summary = await call(calls.summary.tool, calls.summary.input);
    const [weighIns, stats, activities, sleep] = await Promise.all(
      (["weighIns", "stats", "activities", "sleep"] as const).map((k) => call(calls[k].tool, calls[k].input)),
    );
    const snap = toSnapshot({ weighIns, stats, activities, sleep, summary } as GarminRaw);
    emit({ snap, source: "live", loading: false, error: null });
  } catch (err) {
    const e = err as McpError;
    const msg = e && typeof e === "object" && "code" in e ? explain(e) : `No se pudieron leer tus datos de Garmin (${String((err as Error)?.message ?? err)}).`;
    emit({ ...getHealthState(), loading: false, error: msg });
  }
}
