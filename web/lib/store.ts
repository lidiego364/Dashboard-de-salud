import type { NewRow, RowPatch, TableName, Tables } from "./types";
import { getBrowserClient } from "./supabase/client";
import { exampleData } from "./example-data";
import { newId } from "./id";

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

export type Backup = { [K in TableName]: Tables[K][] };

/** Modo local: todo vive en localStorage de este navegador. Se mantiene una
 *  copia en memoria para que la app funcione aunque el navegador bloquee el
 *  almacenamiento (en ese caso los cambios duran solo mientras esté abierta). */
export function localStore(): Store & { replaceAll(db: Backup): Promise<void> } {
  const KEY = "diego-os:v1";
  let mem: Backup | null = null;

  const read = (): Backup => {
    if (mem) return mem;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return (mem = JSON.parse(raw) as Backup);
    } catch {}
    const seeded = exampleData();
    write(seeded);
    return seeded;
  };
  const write = (db: Backup) => {
    mem = db;
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {}
  };

  return {
    // Siempre copias: React no debe compartir arreglos con el almacenamiento.
    async list(table) {
      return read()[table].map((r) => ({ ...r })) as never;
    },
    async insert(table, row) {
      const db = read();
      const full = { ...row, id: newId(), created_at: new Date().toISOString() } as Tables[typeof table];
      (db[table] as Tables[typeof table][]).push(full);
      write(db);
      return { ...full } as never;
    },
    async update(table, id, patch) {
      const db = read();
      const rows = db[table] as Tables[typeof table][];
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) throw new Error("No existe");
      rows[i] = { ...rows[i], ...patch };
      write(db);
      return { ...rows[i] } as never;
    },
    async remove(table, id) {
      const db = read();
      (db as Record<TableName, { id: string }[]>)[table] = db[table].filter((r) => r.id !== id);
      write(db);
    },
    async replaceAll(db) {
      write(structuredClone(db));
    },
  };
}

/** Valida un respaldo JSON antes de importarlo. */
export function parseBackup(text: string): Backup {
  const data = JSON.parse(text);
  for (const t of ["tasks", "goals", "reminders"] as const) {
    if (!Array.isArray(data?.[t]) || data[t].some((r: unknown) => typeof (r as { id?: unknown })?.id !== "string")) {
      throw new Error(`El archivo no es un respaldo de Diego OS (falta "${t}").`);
    }
  }
  return { tasks: data.tasks, goals: data.goals, reminders: data.reminders };
}
