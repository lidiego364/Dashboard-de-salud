"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Cards";
import { useData } from "@/components/DataProvider";
import { relativeDays, shortDate, todayISO } from "@/lib/dates";
import { explainSampleError, getCapability, type Sample } from "@/lib/claude-runtime";
import { checklistPrompt, fmtWeight, parseChecklist, studyPlan, type RankedItem } from "@/lib/uni";
import type { AssignmentMeta } from "@/lib/types";

const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m} min`);

/** Guarda lo propio de una entrega (hecha, checklist, tiempo) creando la fila si no existe. */
function useMeta() {
  const { create, patch, tasks } = useData();
  const upsert = (item: RankedItem, p: Partial<Omit<AssignmentMeta, "id" | "key" | "created_at">>) => {
    if (item.metaRow) patch("assignment_meta", item.metaRow.id, p);
    else create("assignment_meta", { key: item.key, done_at: null, checklist: null, minutes: null, ...p });
  };
  const markDone = (item: RankedItem) => {
    // Una tarea de la uni se marca como hecha en Tareas; una de Calendar, en sus datos.
    const task = item.source === "task" ? tasks.find((t) => `task:${t.id}` === item.key) : null;
    if (task) patch("tasks", task.id, { done_at: new Date().toISOString() });
    else upsert(item, { done_at: new Date().toISOString() });
  };
  return { upsert, markDone };
}

function Row({ item, rank, sample }: { item: RankedItem; rank: number; sample: Sample | null }) {
  const { upsert, markDone } = useMeta();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const w = fmtWeight(item);
  const checklist = item.metaRow?.checklist ?? null;
  const done = checklist?.filter((c) => c.done).length ?? 0;

  const makeChecklist = async () => {
    if (!sample) return;
    setBusy(true);
    setErr(null);
    try {
      const { minutes, steps } = parseChecklist(await sample.json(checklistPrompt(item, item.courseRow, item.component), { modelTier: "quick" }));
      upsert(item, { checklist: steps.map((label) => ({ label, done: false })), minutes });
    } catch (e) {
      setErr((e as { code?: string })?.code ? explainSampleError(e) : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", borderRadius: "var(--radius-md)", background: open ? "var(--color-neutral-900)" : "transparent" }}>
      <button
        className="row-btn"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{ display: "grid", gridTemplateColumns: "28px minmax(0,1fr) auto", gap: 12, alignItems: "center", padding: 10, margin: 0, width: "100%", borderRadius: "var(--radius-md)" }}
      >
        <span style={{ fontSize: 13, color: "var(--color-neutral-500)", textAlign: "center" }}>{rank}</span>
        <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 14, overflowWrap: "anywhere" }}>{item.title}</span>
          <span style={{ fontSize: 12, color: "var(--color-neutral-500)", display: "flex", gap: 12, flexWrap: "wrap" }}>
            {(item.courseRow || item.course) && <span>{item.courseRow ? item.courseRow.code : item.course}</span>}
            <span>
              <i className="ph ph-calendar-blank" /> {relativeDays(item.date, todayISO())}
              {item.days > 1 && ` · ${shortDate(item.date)}`}
            </span>
            <span>
              <i className="ph ph-percent" /> {w ? `${w} de la nota` : "peso desconocido"}
            </span>
            <span>
              <i className="ph ph-timer" /> ~{fmtMin(item.minutes)}
            </span>
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={item.priority === "Alta" ? "tag tag-outline" : item.priority === "Media" ? "tag tag-accent" : "tag tag-neutral"}>{item.priority}</span>
          <i className={open ? "ph ph-caret-up" : "ph ph-caret-down"} style={{ color: "var(--color-neutral-500)" }} />
        </span>
      </button>
      {open && (
        <div style={{ padding: "2px 10px 12px 50px", display: "flex", flexDirection: "column", gap: 6 }}>
          {!w && (
            <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
              {item.courseRow ? `No sé a qué parte de la nota de ${item.courseRow.code} pertenece: revisa las palabras en Canvas del curso.` : "Sube el syllabus de este curso para saber cuánto vale."}
            </div>
          )}
          {item.component && (
            <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
              Parte “{item.component.name}”: {item.component.weight_pct}% de la nota{item.component.count ? ` entre ${item.component.count} entregas` : " (sin cantidad en el syllabus: estimado)"}.
            </div>
          )}
          {checklist ? (
            <>
              <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
                Checklist · {done}/{checklist.length}
              </div>
              {checklist.map((c, i) => (
                <button
                  key={i}
                  onClick={() => upsert(item, { checklist: checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })}
                  style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: 0, padding: "3px 0", cursor: "pointer", font: "inherit", fontSize: 13, color: c.done ? "var(--color-neutral-500)" : "var(--color-text)", textAlign: "left" }}
                >
                  <i className={c.done ? "ph-fill ph-check-square" : "ph ph-square"} style={{ fontSize: 16, color: "var(--color-accent)" }} />
                  <span style={{ textDecoration: c.done ? "line-through" : "none" }}>{c.label}</span>
                </button>
              ))}
            </>
          ) : (
            sample && (
              <button className="btn btn-ghost" style={{ alignSelf: "flex-start", fontSize: 12 }} onClick={makeChecklist} disabled={busy}>
                <i className="ph ph-list-checks" /> {busy ? "Claude está armando el checklist…" : "Armar checklist con Claude"}
              </button>
            )
          )}
          {err && <div role="alert" style={{ fontSize: 12, color: "var(--color-accent-300)" }}>{err}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
            <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => markDone(item)}>
              <i className="ph ph-check" /> Hecho
            </button>
            {item.link && (
              <a className="btn btn-ghost" style={{ fontSize: 13 }} href={item.link} target="_blank" rel="noopener noreferrer">
                <i className="ph ph-arrow-square-out" /> Ver en Calendar
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function PriorityCard({ items, loading }: { items: RankedItem[]; loading: boolean }) {
  const [sample, setSample] = useState<Sample | null>(null);
  const [order, setOrder] = useState<"prio" | "date">("prio");
  useEffect(() => {
    getCapability("sample").then(setSample);
  }, []);
  const list = order === "prio" ? items : [...items].sort((a, b) => `${a.date}${a.time ?? "99"}`.localeCompare(`${b.date}${b.time ?? "99"}`));
  return (
    <Card style={{ gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <div className="card-title">Qué hacer primero</div>
        <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>{order === "prio" ? "% de la nota ÷ días que faltan" : "Por fecha de entrega"}</div>
        <div className="seg" role="radiogroup" aria-label="Orden" style={{ marginLeft: "auto" }}>
          {(
            [
              ["prio", "Prioridad"],
              ["date", "Fecha"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="seg-opt">
              <input type="radio" name="uni-order" checked={order === k} onChange={() => setOrder(k)} />
              {label}
            </label>
          ))}
        </div>
      </div>
      {list.map((x, i) => (
        <Row key={x.key} item={x} rank={i + 1} sample={sample} />
      ))}
      {loading && <div className="empty">Buscando tus entregas en el calendario…</div>}
      {!loading && !list.length && <div className="empty">Sin entregas en las próximas 3 semanas.</div>}
    </Card>
  );
}

export function StudyPlanCard({ items }: { items: RankedItem[] }) {
  const plan = studyPlan(items);
  const total = plan.reduce((a, p) => a + p.minutes, 0);
  return (
    <Card style={{ gap: 12 }}>
      <div className="card-kicker">What should I study today?</div>
      <div style={{ fontSize: 13, color: "var(--color-neutral-400)" }}>
        {plan.length ? `${fmtMin(total)} sugeridas según tus entregas de las próximas 2 semanas.` : "Nada urgente en las próximas 2 semanas."}
      </div>
      {plan.map((s) => (
        <div key={s.key} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 12px", borderRadius: "var(--radius-md)", background: "var(--color-neutral-900)" }}>
          <div style={{ fontSize: 13, color: "var(--color-accent-300)", width: 56, flex: "none" }}>{fmtMin(s.minutes)}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, overflowWrap: "anywhere" }}>{s.title}</div>
            <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
              {s.course ? `${s.course} · ` : ""}
              {s.why}
            </div>
          </div>
        </div>
      ))}
    </Card>
  );
}
