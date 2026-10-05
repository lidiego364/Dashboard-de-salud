// Registro de diagnóstico TEMPORAL (solo en claude.ai): anota en la base de
// datos de la página qué pasa al cambiar de pestaña, para que Claude lo lea
// con ArtifactData si la pantalla queda en blanco. Una entrada por apertura:
// diag/<id> = { started, events: [...] }. Se quita cuando el problema esté resuelto.
import { getCapability } from "@/lib/claude-runtime";
import { newId } from "@/lib/id";

type Ev = { t: number; kind: string; detail?: string };

const id = `${new Date().toISOString().replace(/[:.]/g, "-")}_${newId().slice(0, 8)}`;
const started = Date.now();
const events: Ev[] = [];
let writing: Promise<void> = Promise.resolve();
let dirty = false;
let db: Awaited<ReturnType<typeof getCapability<"db">>> = null;

export function diag(kind: string, detail?: unknown) {
  if (events.length >= 200) return;
  events.push({ t: Date.now() - started, kind, detail: detail === undefined ? undefined : String(detail).slice(0, 500) });
  dirty = true;
  return flush();
}

/** Escribe el registro (una escritura a la vez sobre el mismo documento). */
export function flush(): Promise<void> {
  writing = writing.then(async () => {
    if (!db || !dirty) return;
    dirty = false;
    try {
      await db.doc(`diag/${id}`).set({ started: new Date(started).toISOString(), events: events.map((e) => ({ ...e })) });
    } catch {}
  });
  return writing;
}

export async function startDiag() {
  db = await getCapability("db");
  if (!db) return;
  let framed = "?";
  try {
    framed = String(window.self !== window.top);
  } catch {
    framed = "cross-origin";
  }
  diag("load", `href=${location.href.slice(0, 120)} framed=${framed} ua=${navigator.userAgent.slice(0, 120)}`);
  window.addEventListener("error", (e) => void diag("window-error", `${e.message} @ ${e.filename}:${e.lineno}`));
  window.addEventListener("unhandledrejection", (e) => void diag("unhandled-rejection", (e.reason as Error)?.message ?? e.reason));
  window.addEventListener("pagehide", () => void diag("pagehide"));
  window.addEventListener("beforeunload", () => void diag("beforeunload"));
  document.addEventListener("visibilitychange", () => void diag("visibility", document.visibilityState));
  window.addEventListener("hashchange", () => void diag("hashchange", location.hash));
}
