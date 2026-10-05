export type Area = "uni" | "salud" | "fin" | "trabajo" | "personal";

export const AREAS: Record<Area, { label: string; icon: string }> = {
  uni: { label: "Universidad", icon: "ph ph-graduation-cap" },
  salud: { label: "Salud", icon: "ph ph-heartbeat" },
  fin: { label: "Finanzas", icon: "ph ph-wallet" },
  trabajo: { label: "Trabajo", icon: "ph ph-briefcase" },
  personal: { label: "Personal", icon: "ph ph-user" },
};

export const AREA_KEYS = Object.keys(AREAS) as Area[];

export type Task = {
  id: string;
  area: Area;
  title: string;
  meta: string | null;
  due_date: string | null; // YYYY-MM-DD
  due_time: string | null; // HH:MM[:SS]
  done_at: string | null;
  created_at: string;
};

export type Goal = {
  id: string;
  area: Area;
  title: string;
  status: string | null;
  progress: number; // 0–100
  created_at: string;
};

export type Reminder = {
  id: string;
  area: Area;
  title: string;
  icon: string;
  remind_on: string; // YYYY-MM-DD
  done_at: string | null;
  created_at: string;
};

export type Tables = { tasks: Task; goals: Goal; reminders: Reminder };
export type TableName = keyof Tables;
export type NewRow<T extends TableName> = Omit<Tables[T], "id" | "created_at">;
export type RowPatch<T extends TableName> = Partial<NewRow<T>>;

export const REMINDER_ICONS = [
  "ph ph-bell",
  "ph ph-credit-card",
  "ph ph-first-aid",
  "ph ph-car",
  "ph ph-calendar-check",
  "ph ph-clock",
  "ph ph-gift",
  "ph ph-phone",
  "ph ph-house",
];
