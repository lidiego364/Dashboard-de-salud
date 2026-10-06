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

/** Categorías de gasto (las mismas para todo: CSV, PDF, Zelle y gastos a mano). */
export const FIN_CATEGORIES = {
  comida: { label: "Restaurantes y delivery", icon: "ph ph-fork-knife" },
  super: { label: "Supermercado", icon: "ph ph-shopping-cart" },
  transporte: { label: "Transporte", icon: "ph ph-car" },
  educacion: { label: "Educación", icon: "ph ph-books" },
  compras: { label: "Compras", icon: "ph ph-shopping-bag" },
  entretenimiento: { label: "Entretenimiento", icon: "ph ph-film-slate" },
  suscripciones: { label: "Suscripciones", icon: "ph ph-repeat" },
  salud: { label: "Salud y gym", icon: "ph ph-barbell" },
  servicios: { label: "Casa y servicios", icon: "ph ph-house" },
  transferencias: { label: "Zelle y transferencias", icon: "ph ph-arrows-left-right" },
  otros: { label: "Otros", icon: "ph ph-dots-three" },
  ingreso: { label: "Ingresos", icon: "ph ph-arrow-down-left" },
} as const;
export type FinCategory = keyof typeof FIN_CATEGORIES;
export const FIN_CATEGORY_KEYS = Object.keys(FIN_CATEGORIES) as FinCategory[];

/** Un movimiento de dinero. amount < 0 = gasto, > 0 = ingreso. */
export type Transaction = {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  description: string; // texto original del banco
  merchant: string; // nombre limpio
  category: FinCategory;
  source: "csv" | "pdf" | "manual";
  /** Para no duplicar al importar dos veces: fecha|monto|descripción normalizada. */
  hash: string;
  created_at: string;
};

/** Corrección de categoría que Diego hizo para un comercio: se aplica a futuras importaciones. */
export type FinRule = { id: string; merchant_key: string; category: FinCategory; created_at: string };

/** Ajustes sueltos (p. ej. presupuesto mensual). */
export type Setting = { id: string; key: string; value: number; created_at: string };

export type Tables = {
  tasks: Task;
  goals: Goal;
  reminders: Reminder;
  creatine: Creatine;
  courses: Course;
  assignment_meta: AssignmentMeta;
  transactions: Transaction;
  fin_rules: FinRule;
  settings: Setting;
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
