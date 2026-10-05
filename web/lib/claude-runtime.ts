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

type Caps = { mcp: Mcp; db: Db; downloads: Downloads };
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
