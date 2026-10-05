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

/** Creatina: una fila por día. */
export type Creatine = {
  id: string;
  date: string; // YYYY-MM-DD
  grams: number;
  created_at: string;
};

/** Parte de la nota de un curso (sale del syllabus): "Quizzes · 20% · 10 quizzes". */
export type GradeComponent = {
  name: string;
  weight_pct: number;
  /** Cuántas entregas reparten ese %, si el syllabus lo dice. */
  count: number | null;
  /** Palabras que identifican sus entregas en el calendario ("quiz", "exam"…). */
  keywords: string[];
};

export type Course = {
  id: string;
  code: string; // "ISM 4210"
  name: string; // "Database Applications"
  /** Nombre del curso tal como Canvas lo pone entre corchetes en el calendario. */
  calendar_name: string | null;
  components: GradeComponent[];
  grade: string | null; // lo anota Diego: "A− · 91%"
  created_at: string;
};

/** Lo que Diego agrega a una entrega (de Calendar o una tarea): hecha, checklist, tiempo. */
export type AssignmentMeta = {
  id: string;
  key: string; // "cal:<id de Google>" o "task:<id>"
  done_at: string | null;
  checklist: { label: string; done: boolean }[] | null;
  minutes: number | null; // tiempo total estimado
  created_at: string;
};

export type Tables = {
  tasks: Task;
  goals: Goal;
  reminders: Reminder;
  creatine: Creatine;
  courses: Course;
  assignment_meta: AssignmentMeta;
};
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
