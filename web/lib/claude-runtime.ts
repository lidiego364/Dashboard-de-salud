// Acceso mínimo a las capacidades de la página cuando se publica en claude.ai
// (window.claude solo existe ahí). Fuera de claude.ai todo devuelve null.

export const GARMIN_SERVER = "Garmin connection";

export type McpError = { code: string; message: string; server?: string; retryable?: boolean; retryAfterMs?: number };
export type CallResult = { payload?: unknown; cache?: { storedAt: number } };
export type Mcp = {
  callTool(server: string, tool: string, input?: unknown, options?: { cache?: false | { staleTime?: number; refresh?: boolean } }): Promise<CallResult>;
};

export type DbDoc = { id: string; exists: boolean; data(): Record<string, unknown> | undefined };
export type DbDocRef = {
  get(): Promise<DbDoc>;
  set(data: Record<string, unknown>): Promise<void>;
  update(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
};
export type Db = {
  doc(path: string): DbDocRef;
  collection(path: string): { get(): Promise<{ docs: DbDoc[] }> };
};
export type Downloads = { save(req: { filename: string; data: string }): Promise<unknown> };

export type SampleOptions = { signal?: AbortSignal; images?: Blob[]; modelTier?: "quick" | "default" | "complex"; cache?: boolean };
export type Sample = {
  json<T = unknown>(input: string, options?: SampleOptions): Promise<T>;
  limits(): Promise<{ images?: { maxCount: number; mediaTypes: string[] } }>;
};

type Caps = { mcp: Mcp; db: Db; downloads: Downloads; sample: Sample };
type ClaudeGlobal = { use<K extends keyof Caps>(name: K): Promise<Caps[K] | null> };

export function inClaude(): boolean {
  return typeof window !== "undefined" && typeof (window as unknown as { claude?: ClaudeGlobal }).claude?.use === "function";
}

export async function getCapability<K extends keyof Caps>(name: K): Promise<Caps[K] | null> {
  if (!inClaude()) return null;
  try {
    return await (window as unknown as { claude: ClaudeGlobal }).claude.use(name);
  } catch {
    return null;
  }
}

export const CALENDAR_SERVER = "Google Calendar";

/** Mensaje claro según el código de error del conector (`label`: "Garmin", "Google Calendar"). */
export function explainMcpError(e: unknown, label: string): string {
  const err = e as McpError;
  if (!err || typeof err !== "object" || !("code" in err)) return `No se pudieron leer tus datos de ${label}.`;
  switch (err.code) {
    case "needs_reauth":
      return `Tu conexión con ${label} venció. Reconéctala en claude.ai → Configuración → Conectores.`;
    case "server_not_connected":
    case "server_not_found":
      return `No encuentro tu conector de ${label}. Agrégalo en claude.ai → Configuración → Conectores.`;
    case "selection_required":
      return `Tienes más de un conector de ${label}: elige cuál usar en el aviso de claude.ai.`;
    case "not_in_manifest":
    case "consent_required":
      return `Esta página no tiene permiso para leer ${label}. Actívalo en el menú Permisos de la página.`;
    case "blocked_by_policy":
    case "approval_required":
      return `Tu organización bloquea el conector de ${label} para páginas.`;
    case "server_unavailable":
    case "rate_limited":
      return `${label} no respondió a tiempo. Vuelve a abrir la página en un rato.`;
    case "tool_error":
      return /scope/i.test(err.message)
        ? `${label} no dio permiso de lectura. Reconéctalo marcando todas las casillas de permisos.`
        : `${label} respondió con un error: ${err.message}`;
    default:
      return `No se pudieron leer tus datos de ${label}.`;
  }
}

/** Llamada de solo lectura con un reintento si el error lo permite. */
export async function readTool(mcp: Mcp, server: string, tool: string, input: unknown, staleMs = 5 * 60_000, retried = false): Promise<unknown> {
  try {
    return (await mcp.callTool(server, tool, input, { cache: { staleTime: staleMs } })).payload;
  } catch (err) {
    const e = err as McpError;
    if (e?.retryable && !retried) {
      await new Promise((r) => setTimeout(r, (e.retryAfterMs ?? 1500) + Math.random() * 1000));
      return readTool(mcp, server, tool, input, staleMs, true);
    }
    throw e;
  }
}

/** Mensaje claro según el código de error al pedirle algo a Claude desde la página. */
export function explainSampleError(e: unknown): string | null {
  const code = (e as { code?: string })?.code;
  switch (code) {
    case "cancelled":
      return null;
    case "not_granted":
      return "Diste que no al permiso para que la página use Claude. Recarga la página y acéptalo para leer syllabus.";
    case "rate_limited":
      return "Claude está ocupado con otras consultas. Espera un minuto y vuelve a intentar.";
    case "prompt_too_large":
      return "El syllabus es demasiado largo. Sube solo la parte de evaluación (Grading / Evaluation).";
    case "invalid_json":
      return "Claude no respondió en el formato esperado. Vuelve a intentar.";
    case "images_unavailable":
    case "image_rejected":
      return "Esta vista no acepta imágenes. Sube el syllabus en PDF o pega el texto.";
    default:
      return `No se pudo leer con Claude${(e as Error)?.message ? `: ${(e as Error).message}` : "."}`;
  }
}
