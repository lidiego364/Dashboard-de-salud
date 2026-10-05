"use client";

import Link from "next/link";
import { useState } from "react";
import { useData } from "./DataProvider";
import { GoalDialog, ReminderDialog, TaskDialog } from "./forms";
import { AddButton, GoalItem, ReminderItem, TaskItem } from "./items";
import { areaTasks, upcomingReminders } from "@/lib/selectors";
import { AREAS, type Area } from "@/lib/types";
import { useHealth } from "./useHealth";

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section className="card elev-sm" style={{ padding: "16px 18px", gap: 10, ...style }}>
      {children}
    </section>
  );
}

export function DemoTag({ phase }: { phase: string }) {
  return (
    <span className="demo-tag" title={`Datos de ejemplo. Se conecta en la ${phase}.`}>
      <i className="ph ph-flask" /> ejemplo · {phase}
    </span>
  );
}

export function KickerRow({ kicker, children }: { kicker: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div className="card-kicker">{kicker}</div>
      {children}
    </div>
  );
}

export function GoToButton({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="btn btn-ghost" style={{ marginLeft: "auto", fontSize: 12 }}>
      {label}
    </Link>
  );
}

export function GoalsCard({ area, kicker = "Objetivos actuales" }: { area?: Area; kicker?: string }) {
  const { goals } = useData();
  const health = useHealth();
  const [adding, setAdding] = useState(false);
  const list = goals.filter((g) => !area || g.area === area);
  const hg = health && !health.unavailable && (!area || area === "salud") ? health.view.goal : null;
  return (
    <Card style={{ gap: 12 }}>
      <KickerRow kicker={kicker}>
        <AddButton label="Objetivo" onClick={() => setAdding(true)} />
      </KickerRow>
      {hg && (
        <Link href="/salud" className="row-btn" style={{ flexDirection: "column", alignItems: "stretch", gap: 5, textDecoration: "none" }} title="Se calcula solo con tus pesajes de Garmin">
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>{hg.title}</span>
            <i className="ph ph-watch" style={{ fontSize: 13, color: "var(--color-neutral-500)" }} />
            <span style={{ marginLeft: "auto", fontSize: 12, color: hg.onTrack ? "var(--color-neutral-400)" : "var(--color-accent-300)" }}>{hg.status}</span>
          </span>
          <span style={{ height: 4, borderRadius: 2, background: "var(--color-neutral-800)", overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: `${hg.progress}%`, background: "var(--color-accent-500)" }} />
          </span>
        </Link>
      )}
      {list.map((g) => (
        <GoalItem key={g.id} goal={g} />
      ))}
      {!list.length && !hg && <div className="empty">Sin objetivos todavía.</div>}
      {adding && <GoalDialog defaultArea={area} onClose={() => setAdding(false)} />}
    </Card>
  );
}

export function RemindersCard({ area, limit = 6 }: { area?: Area; limit?: number }) {
  const { reminders } = useData();
  const [adding, setAdding] = useState(false);
  const list = upcomingReminders(reminders, area).slice(0, limit);
  return (
    <Card style={{ gap: 4 }}>
      <KickerRow kicker="Recordatorios">
        <AddButton label="Recordatorio" onClick={() => setAdding(true)} />
      </KickerRow>
      {list.map((r) => (
        <ReminderItem key={r.id} reminder={r} />
      ))}
      {!list.length && <div className="empty">Nada pendiente.</div>}
      {adding && <ReminderDialog defaultArea={area} onClose={() => setAdding(false)} />}
    </Card>
  );
}

export function AreaTasksCard({ area, title = "Tareas", compact = false }: { area: Area; title?: string; compact?: boolean }) {
  const { tasks, loading } = useData();
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const all = areaTasks(tasks, area);
  const open = all.filter((t) => !t.done_at);
  const done = all.filter((t) => t.done_at);
  return (
    <Card style={{ padding: compact ? "16px 18px" : "18px 20px", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        {compact ? <div className="card-kicker">{title}</div> : <div className="card-title">{title}</div>}
        <span style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>{open.length} pendientes</span>
        <AddButton label="Tarea" onClick={() => setAdding(true)} />
      </div>
      {open.map((t) => (
        <TaskItem key={t.id} task={t} />
      ))}
      {loading && <Loading />}
      {!loading && !open.length && <div className="empty">Todo al día en {AREAS[area].label.toLowerCase()}.</div>}
      {done.length > 0 && (
        <button className="btn btn-ghost" style={{ alignSelf: "flex-start", fontSize: 12, color: "var(--color-neutral-500)" }} onClick={() => setShowDone((s) => !s)}>
          <i className={showDone ? "ph ph-caret-up" : "ph ph-caret-down"} /> {done.length} hechas
        </button>
      )}
      {showDone && done.map((t) => <TaskItem key={t.id} task={t} />)}
      {adding && <TaskDialog defaultArea={area} defaultDate={null} onClose={() => setAdding(false)} />}
    </Card>
  );
}

export function PageTitle({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
      <div>
        <h2 style={{ margin: 0 }}>{title}</h2>
        {sub && <div style={{ fontSize: 14, color: "var(--color-neutral-400)" }}>{sub}</div>}
      </div>
      {children && <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>{children}</div>}
    </div>
  );
}

export function Columns({ main, side, mainBasis = 560 }: { main: React.ReactNode; side: React.ReactNode; mainBasis?: number }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: `2 1 ${mainBasis}px`, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>{main}</div>
      <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>{side}</div>
    </div>
  );
}

export function Loading() {
  return <div className="empty">Cargando…</div>;
}
