import type { NewRow, RowPatch, TableName, Tables } from "./types";
import { getBrowserClient } from "./supabase/client";
import { exampleData } from "./example-data";
import { newId } from "./id";
import type { Db } from "./claude-runtime";

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

/** Página publicada en claude.ai: base de datos de la propia página, la misma
 *  en el celular y en la compu. Un documento por fila: tasks/<id>, etc. */
export function claudeDbStore(db: Db): Store & { replaceAll(data: Backup): Promise<void> } {
  const strip = <T,>(d: { id: string; data(): Record<string, unknown> | undefined }) => ({ ...(d.data() ?? {}), id: d.id }) as T;
  const store: Store & { replaceAll(data: Backup): Promise<void> } = {
    async list(table) {
      const { docs } = await db.collection(table).get();
      return docs
        .filter((d) => d.exists)
        .map((d) => strip(d))
        .sort((a, b) => String((a as { created_at?: string }).created_at).localeCompare(String((b as { created_at?: string }).created_at))) as never;
    },
    async insert(table, row) {
      const id = newId();
      const full = { ...row, created_at: new Date().toISOString() };
      await db.doc(`${table}/${id}`).set(full as Record<string, unknown>);
      return { ...full, id } as never;
    },
    async update(table, id, patch) {
      const ref = db.doc(`${table}/${id}`);
      await ref.update(patch as Record<string, unknown>);
      return strip(await ref.get()) as never;
    },
    async remove(table, id) {
      await db.doc(`${table}/${id}`).delete();
    },
    async replaceAll(data) {
      for (const t of ["tasks", "goals", "reminders"] as const) {
        for (const r of await store.list(t)) await store.remove(t, r.id);
        // Una escritura a la vez: el store pide no solapar escrituras.
        for (const r of data[t]) {
          const { id, ...rest } = r as { id: string };
          await db.doc(`${t}/${id}`).set(rest);
        }
      }
    },
  };
  return store;
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
      if (raw) return (mem = migrate(JSON.parse(raw) as Backup));
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

// El objetivo de peso del ejemplo ("Llegar a 85 kg") ahora se calcula con
// Garmin; se quita solo si sigue idéntico al sembrado (nunca uno del usuario).
function migrate(db: Backup): Backup {
  const goals = db.goals.filter((g) => !(g.title === "Llegar a 85 kg" && g.status === "86.8 kg · faltan 1.8"));
  if (goals.length === db.goals.length) return db;
  const next = { ...db, goals };
  try {
    localStorage.setItem("diego-os:v1", JSON.stringify(next));
  } catch {}
  return next;
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
