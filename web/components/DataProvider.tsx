"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { exampleRows } from "@/lib/example-data";
import { localStore, supabaseStore, type Store } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { NewRow, RowPatch, TableName, Tables } from "@/lib/types";

type Rows = { [K in TableName]: Tables[K][] };

type DataCtx = Rows & {
  mode: "demo" | "supabase";
  loading: boolean;
  error: string | null;
  clearError: () => void;
  create: <T extends TableName>(table: T, row: NewRow<T>) => Promise<void>;
  patch: <T extends TableName>(table: T, id: string, patch: RowPatch<T>) => Promise<void>;
  remove: (table: TableName, id: string) => Promise<void>;
  loadExample: () => Promise<void>;
};

const Ctx = createContext<DataCtx | null>(null);

const EMPTY: Rows = { tasks: [], goals: [], reminders: [] };
const TABLES: TableName[] = ["tasks", "goals", "reminders"];

export function DataProvider({ children }: { children: React.ReactNode }) {
  const mode = isSupabaseConfigured ? "supabase" : "demo";
  const store = useMemo<Store>(() => (mode === "supabase" ? supabaseStore() : localStore()), [mode]);
  const [rows, setRows] = useState<Rows>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

  const reload = useCallback(async () => {
    const [tasks, goals, reminders] = await Promise.all(TABLES.map((t) => store.list(t)));
    setRows({ tasks, goals, reminders } as Rows);
  }, [store]);

  useEffect(() => {
    reload()
      .catch(fail)
      .finally(() => setLoading(false));
  }, [reload]);

  const setTable = <T extends TableName>(table: T, fn: (list: Tables[T][]) => Tables[T][]) =>
    setRows((r) => ({ ...r, [table]: fn(r[table] as Tables[T][]) }));

  const create: DataCtx["create"] = async (table, row) => {
    try {
      const saved = await store.insert(table, row);
      setTable(table, (l) => [...l, saved]);
    } catch (e) {
      fail(e);
    }
  };

  // Optimista: se aplica al instante y se revierte si el servidor falla.
  const patch: DataCtx["patch"] = async (table, id, p) => {
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
    const ex = exampleRows();
    try {
      for (const t of TABLES) for (const row of ex[t]) await store.insert(t, row as never);
      await reload();
    } catch (e) {
      fail(e);
    }
  };

  return (
    <Ctx.Provider
      value={{ ...rows, mode, loading, error, clearError: () => setError(null), create, patch, remove, loadExample }}
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
