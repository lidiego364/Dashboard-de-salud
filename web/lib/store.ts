import type { NewRow, RowPatch, TableName, Tables } from "./types";
import { getBrowserClient } from "./supabase/client";
import { exampleData } from "./example-data";

export interface Store {
  list<T extends TableName>(table: T): Promise<Tables[T][]>;
  insert<T extends TableName>(table: T, row: NewRow<T>): Promise<Tables[T]>;
  update<T extends TableName>(table: T, id: string, patch: RowPatch<T>): Promise<Tables[T]>;
  remove(table: TableName, id: string): Promise<void>;
}

/** Datos reales: Supabase con RLS (cada usuario solo ve sus filas). */
export function supabaseStore(): Store {
  const db = getBrowserClient();
  return {
    async list(table) {
      const { data, error } = await db.from(table).select("*").order("created_at");
      if (error) throw error;
      return (table === "goals" ? data.map(normalizeGoal) : data) as never;
    },
    async insert(table, row) {
      const { data, error } = await db.from(table).insert(row).select().single();
      if (error) throw error;
      return (table === "goals" ? normalizeGoal(data) : data) as never;
    },
    async update(table, id, patch) {
      const { data, error } = await db.from(table).update(patch).eq("id", id).select().single();
      if (error) throw error;
      return (table === "goals" ? normalizeGoal(data) : data) as never;
    },
    async remove(table, id) {
      const { error } = await db.from(table).delete().eq("id", id);
      if (error) throw error;
    },
  };
}

// Postgres devuelve numeric como string.
function normalizeGoal<G extends { progress: unknown }>(g: G) {
  return { ...g, progress: Number(g.progress) };
}

/** Modo demo: todo vive en localStorage de este navegador. */
export function localStore(): Store {
  const KEY = "diego-os:v1";
  type Db = { [K in TableName]: Tables[K][] };

  const read = (): Db => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as Db;
    } catch {}
    const seeded = exampleData();
    write(seeded);
    return seeded;
  };
  const write = (db: Db) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {}
  };

  return {
    async list(table) {
      return read()[table] as never;
    },
    async insert(table, row) {
      const db = read();
      const full = { ...row, id: crypto.randomUUID(), created_at: new Date().toISOString() } as Tables[typeof table];
      (db[table] as Tables[typeof table][]).push(full);
      write(db);
      return full as never;
    },
    async update(table, id, patch) {
      const db = read();
      const rows = db[table] as Tables[typeof table][];
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) throw new Error("No existe");
      rows[i] = { ...rows[i], ...patch };
      write(db);
      return rows[i] as never;
    },
    async remove(table, id) {
      const db = read();
      (db as Record<TableName, { id: string }[]>)[table] = db[table].filter((r) => r.id !== id);
      write(db);
    },
  };
}
