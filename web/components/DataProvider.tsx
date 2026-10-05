"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { exampleRows } from "@/lib/example-data";
import { claudeDbStore, localStore, parseBackup, supabaseStore, type Backup, type Store } from "@/lib/store";
import { inClaude, getCapability } from "@/lib/claude-runtime";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { NewRow, RowPatch, TableName, Tables } from "@/lib/types";

type Rows = { [K in TableName]: Tables[K][] };

type DataCtx = Rows & {
  /** demo: navegador sin Supabase · supabase: app en la nube · claude: página en claude.ai (sincronizada) */
  mode: "demo" | "supabase" | "claude";
  loading: boolean;
  error: string | null;
  clearError: () => void;
  create: <T extends TableName>(table: T, row: NewRow<T>) => Promise<void>;
  patch: <T extends TableName>(table: T, id: string, patch: RowPatch<T>) => Promise<void>;
  remove: (table: TableName, id: string) => Promise<void>;
  loadExample: () => Promise<void>;
  /** Solo sin Supabase: respaldo de todos los datos en un JSON. */
  exportBackup: () => string;
  importBackup: (json: string) => Promise<void>;
};

const Ctx = createContext<DataCtx | null>(null);

const EMPTY: Rows = { tasks: [], goals: [], reminders: [] };
const TABLES: TableName[] = ["tasks", "goals", "reminders"];

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<DataCtx["mode"]>(isSupabaseConfigured ? "supabase" : "demo");
  const [store, setStore] = useState<(Store & { replaceAll?(data: Backup): Promise<void> }) | null>(null);
  const [rows, setRows] = useState<Rows>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fail = (e: unknown) =>
    setError(e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e));

  // Elige dónde guardar: Supabase, la base de datos de la página en claude.ai, o el navegador.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isSupabaseConfigured) return setStore(supabaseStore());
      const db = inClaude() ? await getCapability("db") : null;
      if (cancelled) return;
      if (db) {
        setMode("claude");
        setStore(claudeDbStore(db));
      } else setStore(localStore());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!store) return;
    const [tasks, goals, reminders] = await Promise.all(TABLES.map((t) => store.list(t)));
    setRows({ tasks, goals, reminders } as Rows);
  }, [store]);

  useEffect(() => {
    if (!store) return;
    reload()
      .catch(fail)
      .finally(() => setLoading(false));
  }, [store, reload]);

  const setTable = <T extends TableName>(table: T, fn: (list: Tables[T][]) => Tables[T][]) =>
    setRows((r) => ({ ...r, [table]: fn(r[table] as Tables[T][]) }));

  const create: DataCtx["create"] = async (table, row) => {
    if (!store) return;
    try {
      const saved = await store.insert(table, row);
      setTable(table, (l) => [...l, saved]);
    } catch (e) {
      fail(e);
    }
  };

  // Optimista: se aplica al instante y se revierte si el servidor falla.
  const patch: DataCtx["patch"] = async (table, id, p) => {
    if (!store) return;
    const before = rows[table];
    setTable(table, (l) => l.map((r) => (r.id === id ? { ...r, ...p } : r)));
    try {
      const saved = await store.update(table, id, p);
      setTable(table, (l) => l.map((r) => (r.id === id ? saved : r)));
    } catch (e) {
      setTable(table, () => before);
      fail(e);
    }
  };

  const remove: DataCtx["remove"] = async (table, id) => {
    if (!store) return;
    const before = rows[table];
    setTable(table, (l) => l.filter((r) => r.id !== id));
    try {
      await store.remove(table, id);
    } catch (e) {
      setTable(table, () => before as never);
      fail(e);
    }
  };

  const loadExample = async () => {
    if (!store) return;
    const ex = exampleRows();
    try {
      for (const t of TABLES) for (const row of ex[t]) await store.insert(t, row as never);
      await reload();
    } catch (e) {
      fail(e);
    }
  };

  const exportBackup = () => JSON.stringify({ exported_at: new Date().toISOString(), ...rows } satisfies Backup & { exported_at: string }, null, 2);

  const importBackup = async (json: string) => {
    try {
      if (!store?.replaceAll) throw new Error("Importar no está disponible en esta versión.");
      setLoading(true);
      await store.replaceAll(parseBackup(json));
      await reload();
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Ctx.Provider
      value={{
        ...rows,
        mode,
        loading,
        error,
        clearError: () => setError(null),
        create,
        patch,
        remove,
        loadExample,
        exportBackup,
        importBackup,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useData fuera de <DataProvider>");
  return ctx;
}
