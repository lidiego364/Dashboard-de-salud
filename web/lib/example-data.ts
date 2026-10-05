import { addDays, todayISO } from "./dates";
import type { Goal, NewRow, Reminder, Task } from "./types";
import { newId } from "./id";

/** Datos del prototipo, con fechas relativas a hoy. Se usan en modo demo
 *  y en el botón "Cargar ejemplo" cuando la cuenta está vacía. */
export function exampleRows() {
  const t = todayISO();
  const d = (n: number) => addDays(t, n);

  const tasks: NewRow<"tasks">[] = [
    { area: "uni", title: "SQL Lab 3 · Joins", meta: "ISM 4212 · ~2h", due_date: d(1), due_time: null, done_at: null },
    { area: "uni", title: "Repasar capítulo 6 de estadística", meta: "QMB 3200 · 45 min", due_date: t, due_time: null, done_at: new Date().toISOString() },
    { area: "salud", title: "Gym · Upper A", meta: "60 min", due_date: t, due_time: "18:00", done_at: null },
    { area: "salud", title: "Llegar a 10k pasos", meta: null, due_date: t, due_time: null, done_at: null },
    { area: "salud", title: "Gym · Lower A", meta: "60 min", due_date: d(2), due_time: "18:00", done_at: null },
    { area: "fin", title: "Cancelar prueba de Max", meta: "Se cobra en 2 días · $16.99", due_date: t, due_time: null, done_at: null },
    { area: "trabajo", title: "Enviar disponibilidad de la semana", meta: "Antes de las 20:00", due_date: t, due_time: "20:00", done_at: null },
    { area: "trabajo", title: "Aplicar a 2 internships de data analytics", meta: "LinkedIn · Handshake", due_date: null, due_time: null, done_at: null },
    { area: "personal", title: "Meal prep para lunes a miércoles", meta: "2,200 kcal · 180 g proteína", due_date: t, due_time: "20:00", done_at: null },
    { area: "personal", title: "Llamar a mamá", meta: null, due_date: t, due_time: null, done_at: null },
  ];
  const goals: NewRow<"goals">[] = [
    { area: "uni", title: "GPA 3.7 este semestre", status: "Promedio actual 3.62", progress: 82 },
    { area: "trabajo", title: "Internship de data analytics", status: "6 / 20 aplicaciones", progress: 30 },
    { area: "personal", title: "Leer 1 libro al mes", status: "40 / 280 páginas", progress: 14 },
  ];
  const reminders: NewRow<"reminders">[] = [
    { area: "fin", title: "Pagar tarjeta de crédito", icon: "ph ph-credit-card", remind_on: d(4), done_at: null },
    { area: "personal", title: "Cita con el dentista", icon: "ph ph-first-aid", remind_on: d(8), done_at: null },
    { area: "uni", title: "Renovar parking FIU", icon: "ph ph-car", remind_on: d(11), done_at: null },
    { area: "trabajo", title: "Enviar horas de la quincena", icon: "ph ph-clock", remind_on: d(5), done_at: null },
    { area: "trabajo", title: "Entrevista con Ryder (tentativa)", icon: "ph ph-calendar-check", remind_on: d(10), done_at: null },
    { area: "personal", title: "Cumpleaños de Andrés", icon: "ph ph-gift", remind_on: d(14), done_at: null },
  ];
  return { tasks, goals, reminders, creatine: [] as NewRow<"creatine">[] };
}

export function exampleData() {
  const rows = exampleRows();
  const now = new Date().toISOString();
  const withId = <T,>(r: T) => ({ ...r, id: newId(), created_at: now });
  return {
    tasks: rows.tasks.map(withId) as Task[],
    goals: rows.goals.map(withId) as Goal[],
    reminders: rows.reminders.map(withId) as Reminder[],
    creatine: [],
  };
}
