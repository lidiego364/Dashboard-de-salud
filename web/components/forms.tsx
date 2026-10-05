"use client";

import { useState } from "react";
import { Dialog, Field } from "./Dialog";
import { useData } from "./DataProvider";
import { todayISO } from "@/lib/dates";
import { AREA_KEYS, AREAS, REMINDER_ICONS, type Area, type Goal, type Reminder, type Task } from "@/lib/types";

function AreaSelect({ value, onChange }: { value: Area; onChange: (a: Area) => void }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value as Area)}>
      {AREA_KEYS.map((a) => (
        <option key={a} value={a}>
          {AREAS[a].label}
        </option>
      ))}
    </select>
  );
}

const orNull = (s: string) => (s.trim() ? s.trim() : null);

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-danger"
      onClick={() => confirm("¿Eliminar definitivamente?") && onClick()}
    >
      <i className="ph ph-trash" /> Eliminar
    </button>
  );
}

export function TaskDialog({
  task,
  defaultArea = "personal",
  defaultDate,
  onClose,
}: {
  task?: Task;
  defaultArea?: Area;
  defaultDate?: string | null;
  onClose: () => void;
}) {
  const { create, patch, remove } = useData();
  const [title, setTitle] = useState(task?.title ?? "");
  const [area, setArea] = useState<Area>(task?.area ?? defaultArea);
  const [meta, setMeta] = useState(task?.meta ?? "");
  const [date, setDate] = useState(task ? (task.due_date ?? "") : (defaultDate === undefined ? todayISO() : (defaultDate ?? "")));
  const [time, setTime] = useState(task?.due_time?.slice(0, 5) ?? "");

  const save = () => {
    if (!title.trim()) return;
    const row = { title: title.trim(), area, meta: orNull(meta), due_date: orNull(date), due_time: date ? orNull(time) : null };
    if (task) patch("tasks", task.id, row);
    else create("tasks", { ...row, done_at: null });
    onClose();
  };

  return (
    <Dialog
      title={task ? "Editar tarea" : "Nueva tarea"}
      onClose={onClose}
      onSubmit={save}
      actions={task && <DeleteButton onClick={() => (remove("tasks", task.id), onClose())} />}
    >
      <Field label="Qué hay que hacer">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </Field>
      <Field label="Detalle (opcional)">
        <input className="input" value={meta} onChange={(e) => setMeta(e.target.value)} placeholder="Curso, duración, nota…" />
      </Field>
      <div className="field-row" style={{ marginTop: 10 }}>
        <Field label="Área">
          <AreaSelect value={area} onChange={setArea} />
        </Field>
        <Field label="Fecha">
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Hora">
          <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!date} />
        </Field>
      </div>
    </Dialog>
  );
}

export function GoalDialog({ goal, defaultArea = "personal", onClose }: { goal?: Goal; defaultArea?: Area; onClose: () => void }) {
  const { create, patch, remove } = useData();
  const [title, setTitle] = useState(goal?.title ?? "");
  const [area, setArea] = useState<Area>(goal?.area ?? defaultArea);
  const [status, setStatus] = useState(goal?.status ?? "");
  const [progress, setProgress] = useState(goal?.progress ?? 0);

  const save = () => {
    if (!title.trim()) return;
    const row = { title: title.trim(), area, status: orNull(status), progress: Math.max(0, Math.min(100, progress)) };
    if (goal) patch("goals", goal.id, row);
    else create("goals", row);
    onClose();
  };

  return (
    <Dialog
      title={goal ? "Editar objetivo" : "Nuevo objetivo"}
      onClose={onClose}
      onSubmit={save}
      actions={goal && <DeleteButton onClick={() => (remove("goals", goal.id), onClose())} />}
    >
      <Field label="Objetivo">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </Field>
      <Field label="Estado actual">
        <input className="input" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="6 / 20 aplicaciones" />
      </Field>
      <div className="field-row" style={{ marginTop: 10 }}>
        <Field label="Área">
          <AreaSelect value={area} onChange={setArea} />
        </Field>
        <Field label={`Progreso · ${Math.round(progress)}%`}>
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--color-accent)", marginTop: 10 }}
          />
        </Field>
      </div>
    </Dialog>
  );
}

export function ReminderDialog({
  reminder,
  defaultArea = "personal",
  onClose,
}: {
  reminder?: Reminder;
  defaultArea?: Area;
  onClose: () => void;
}) {
  const { create, patch, remove } = useData();
  const [title, setTitle] = useState(reminder?.title ?? "");
  const [area, setArea] = useState<Area>(reminder?.area ?? defaultArea);
  const [date, setDate] = useState(reminder?.remind_on ?? todayISO());
  const [icon, setIcon] = useState(reminder?.icon ?? "ph ph-bell");

  const save = () => {
    if (!title.trim() || !date) return;
    const row = { title: title.trim(), area, remind_on: date, icon };
    if (reminder) patch("reminders", reminder.id, row);
    else create("reminders", { ...row, done_at: null });
    onClose();
  };

  return (
    <Dialog
      title={reminder ? "Editar recordatorio" : "Nuevo recordatorio"}
      onClose={onClose}
      onSubmit={save}
      actions={
        reminder && (
          <>
            <DeleteButton onClick={() => (remove("reminders", reminder.id), onClose())} />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => (patch("reminders", reminder.id, { done_at: new Date().toISOString() }), onClose())}
            >
              <i className="ph ph-check" /> Hecho
            </button>
          </>
        )
      }
    >
      <Field label="Recordatorio">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </Field>
      <div className="field-row" style={{ marginTop: 10 }}>
        <Field label="Área">
          <AreaSelect value={area} onChange={setArea} />
        </Field>
        <Field label="Fecha">
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
      </div>
      <div className="field" style={{ marginTop: 10 }}>
        <label>Ícono</label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {REMINDER_ICONS.map((ic) => (
            <button
              key={ic}
              type="button"
              aria-label={ic}
              aria-pressed={icon === ic}
              className={icon === ic ? "btn btn-primary btn-icon" : "btn btn-secondary btn-icon"}
              onClick={() => setIcon(ic)}
            >
              <i className={ic} style={{ fontSize: 16 }} />
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
