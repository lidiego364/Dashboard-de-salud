// Zelle en vivo: las alertas de Wells Fargo que llegan a Gmail ("Usted envió
// $30.00 a …", "… le envió $35.00"). Solo se busca ese remitente y esos asuntos;
// se usa para lo que pasó DESPUÉS del último estado de cuenta importado.
import { addDays, todayISO } from "./dates";
import { explainMcpError, getCapability, readTool } from "./claude-runtime";
import { zelleFromGmail, type ZelleTx } from "./finance";

export const GMAIL_SERVER = "Gmail";

export type ZelleState = { available: boolean; loading: boolean; items: ZelleTx[]; error: string | null };

let state: ZelleState = { available: false, loading: false, items: [], error: null };
const listeners = new Set<(s: ZelleState) => void>();
let started = false;
const emit = (s: ZelleState) => {
  state = s;
  listeners.forEach((fn) => fn(s));
};

export const getZelleState = () => state;

export function subscribeZelle(fn: (s: ZelleState) => void) {
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
  emit({ available: true, loading: true, items: [], error: null });
  const after = addDays(todayISO(), -60).replace(/-/g, "/");
  try {
    const payload = await readTool(mcp, GMAIL_SERVER, "search_threads", {
      query: `from:alerts@notify.wellsfargo.com subject:(Zelle OR ExpressSend) after:${after}`,
      pageSize: 50,
      view: "THREAD_VIEW_MINIMAL",
    });
    emit({ available: true, loading: false, items: zelleFromGmail(payload), error: null });
  } catch (err) {
    emit({ available: true, loading: false, items: [], error: explainMcpError(err, "Gmail") });
  }
}
