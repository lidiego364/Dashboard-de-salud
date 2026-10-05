"use client";

import { useState } from "react";
import { useData } from "./DataProvider";
import { GoalDialog, ReminderDialog, TaskDialog } from "./forms";
import { hhmm, relativeDays, shortDate, todayISO } from "@/lib/dates";
import type { Goal, Reminder, Task } from "@/lib/types";

function taskMeta(t: Task, today: string) {
  const bits: string[] = [];
  if (t.meta) bits.push(t.meta);
  if (t.due_date && t.due_date !== today) {
    const rel = relativeDays(t.due_date, today);
    bits.push(t.due_date < today ? `vencida · ${shortDate(t.due_date)}` : rel === "Mañana" ? "vence mañana" : `${shortDate(t.due_date)}`);
  }
  if (t.due_time) bits.push(hhmm(t.due_time)!);
  return bits.join(" · ");
}

export function TaskItem({ task }: { task: Task }) {
  const { patch } = useData();
  const [editing, setEditing] = useState(false);
  const done = !!task.done_at;
  const today = todayISO();
  const overdue = !done && task.due_date !== null && task.due_date < today;
  const meta = taskMeta(task, today);

  return (
    <div className="row">
      <button
        className="row-btn"
        style={{ paddingRight: 36 }}
        onClick={() => patch("tasks", task.id, { done_at: done ? null : new Date().toISOString() })}
        aria-pressed={done}
      >
        {done ? (
          <i className="ph-fill ph-check-circle" style={{ fontSize: 18, color: "var(--color-accent)", marginTop: 1 }} />
        ) : (
          <i className="ph ph-circle" style={{ fontSize: 18, color: "var(--color-neutral-600)", marginTop: 1 }} />
        )}
        <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: 14,
              textDecoration: done ? "line-through" : "none",
              color: done ? "var(--color-neutral-500)" : "var(--color-text)",
            }}
          >
            {task.title}
          </span>
          {meta && (
            <span style={{ fontSize: 12, color: overdue ? "var(--color-accent-300)" : "var(--color-neutral-500)" }}>{meta}</span>
          )}
        </span>
      </button>
      <button className="btn btn-icon row-edit" style={{ width: 28, height: 28 }} aria-label="Editar tarea" onClick={() => setEditing(true)}>
        <i className="ph ph-pencil-simple" style={{ fontSize: 15 }} />
      </button>
      {editing && <TaskDialog task={task} onClose={() => setEditing(false)} />}
    </div>
  );
}

export function GoalItem({ goal }: { goal: Goal }) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <button
        className="row-btn"
        style={{ flexDirection: "column", alignItems: "stretch", gap: 5 }}
        onClick={() => setEditing(true)}
        aria-label={`Editar objetivo ${goal.title}`}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>{goal.title}</span>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-neutral-400)" }}>{goal.status}</span>
        </span>
        <span style={{ height: 4, borderRadius: 2, background: "var(--color-neutral-800)", overflow: "hidden" }}>
          <span style={{ display: "block", height: "100%", width: `${goal.progress}%`, background: "var(--color-accent-500)" }} />
        </span>
      </button>
      {editing && <GoalDialog goal={goal} onClose={() => setEditing(false)} />}
    </>
  );
}

export function ReminderItem({ reminder }: { reminder: Reminder }) {
  const [editing, setEditing] = useState(false);
  const today = todayISO();
  const when = reminder.remind_on <= today ? relativeDays(reminder.remind_on, today) : shortDate(reminder.remind_on);
  return (
    <>
      <button className="row-btn" style={{ alignItems: "center", fontSize: 14 }} onClick={() => setEditing(true)}>
        <i className={reminder.icon} style={{ color: "var(--color-neutral-500)", fontSize: 16 }} />
        <span style={{ flex: 1 }}>{reminder.title}</span>
        <span style={{ fontSize: 12, color: reminder.remind_on <= today ? "var(--color-accent-300)" : "var(--color-neutral-400)" }}>
          {when}
        </span>
      </button>
      {editing && <ReminderDialog reminder={reminder} onClose={() => setEditing(false)} />}
    </>
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="btn btn-ghost" style={{ marginLeft: "auto", fontSize: 12 }} onClick={onClick}>
      <i className="ph ph-plus" /> {label}
    </button>
  );
}
