"use client";

import { useState } from "react";
import { AreaTasksCard, Card, Columns, DemoTag, PageTitle } from "@/components/Cards";
import { useData } from "@/components/DataProvider";
import { DeadlineList } from "@/components/DeadlineList";
import { useCalendar } from "@/components/useCalendar";
import { nowHM, todayISO } from "@/lib/dates";
import { upcomingDeadlines } from "@/lib/selectors";
import { DEMO } from "@/lib/demo";

export default function UniPage() {
  const { tasks } = useData();
  const cal = useCalendar();
  const deadlines = upcomingDeadlines(tasks, todayISO(), 50, cal.events, nowHM());
  const [open, setOpen] = useState<string | null>("a1");
  const [checks, setChecks] = useState<Record<string, boolean>>({ "a1-0": true, "a2-0": true });

  const ranked = DEMO.assignments.map((a) => ({ ...a, score: a.weight / a.days })).sort((a, b) => b.score - a.score);

  return (
    <>
      <PageTitle
        title="Universidad"
        sub={`Fall 2026 · ${deadlines.length} ${deadlines.length === 1 ? "entrega próxima" : "entregas próximas"}${cal.available ? " en las próximas 3 semanas" : ""}`}
      >
        <DemoTag phase="fase 3" />
        <button className="btn btn-primary" disabled title="Llega en la fase 3">
          <i className="ph ph-upload-simple" style={{ fontSize: 16 }} />
          Subir syllabus o screenshot
        </button>
      </PageTitle>
      <Columns
        mainBasis={600}
        main={
          <>
            <section
              style={{
                border: "1px dashed var(--color-neutral-700)",
                borderRadius: "var(--radius-lg)",
                padding: "18px 20px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <i className="ph ph-file-arrow-up" style={{ fontSize: 28, color: "var(--color-accent)" }} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 15 }}>Arrastra syllabus, screenshots o instrucciones de Canvas</div>
                <div style={{ fontSize: 13, color: "var(--color-neutral-500)" }}>
                  Se extrae deadline, % de la nota, tiempo estimado y checklist. Recordatorio automático 2 días antes.
                </div>
              </div>
              <span className="tag tag-neutral">Disponible en la fase 3</span>
            </section>

            <Card style={{ gap: 6 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                <div className="card-title">Próximas entregas</div>
                <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
                  {cal.available ? "Tus tareas de la uni y lo que Canvas puso en tu calendario · próximas 3 semanas" : "Tus tareas del área Universidad"}
                </div>
              </div>
              <DeadlineList items={deadlines} calendarState={cal} />
            </Card>

            <Card style={{ gap: 4 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                <div className="card-title">Qué hacer primero</div>
                <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>Ordenado por % de la nota ÷ días restantes</div>
                <span style={{ marginLeft: "auto" }}>
                  <DemoTag phase="fase 3" />
                </span>
              </div>
              {ranked.map((a, i) => {
                const expanded = open === a.id;
                const pr = a.score >= 3 ? "Alta" : a.score >= 1.5 ? "Media" : "Baja";
                const cl = a.checklist.map((label, j) => ({ label, key: `${a.id}-${j}`, on: !!checks[`${a.id}-${j}`] }));
                return (
                  <div key={a.id} style={{ display: "flex", flexDirection: "column", borderRadius: "var(--radius-md)", background: expanded ? "var(--color-neutral-900)" : "transparent" }}>
                    <button
                      className="row-btn"
                      onClick={() => setOpen(expanded ? null : a.id)}
                      aria-expanded={expanded}
                      style={{ display: "grid", gridTemplateColumns: "28px minmax(0,1fr) auto", gap: 12, alignItems: "center", padding: 10, margin: 0, width: "100%", borderRadius: "var(--radius-md)" }}
                    >
                      <span style={{ fontSize: 13, color: "var(--color-neutral-500)", textAlign: "center" }}>{i + 1}</span>
                      <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 14 }}>{a.title}</span>
                        <span style={{ fontSize: 12, color: "var(--color-neutral-500)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                          <span>{a.course}</span>
                          <span><i className="ph ph-calendar-blank" /> en {a.days} {a.days === 1 ? "día" : "días"}</span>
                          <span><i className="ph ph-percent" /> {a.weight}% de la nota</span>
                          <span><i className="ph ph-timer" /> ~{a.time}</span>
                        </span>
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className={pr === "Alta" ? "tag tag-outline" : pr === "Media" ? "tag tag-accent" : "tag tag-neutral"}>{pr}</span>
                        <i className={expanded ? "ph ph-caret-up" : "ph ph-caret-down"} style={{ color: "var(--color-neutral-500)" }} />
                      </span>
                    </button>
                    {expanded && (
                      <div style={{ padding: "2px 10px 12px 50px", display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ fontSize: 12, color: "var(--color-neutral-500)", marginBottom: 2 }}>
                          Checklist · {cl.filter((c) => c.on).length}/{cl.length}
                        </div>
                        {cl.map((c) => (
                          <button
                            key={c.key}
                            onClick={() => setChecks((s) => ({ ...s, [c.key]: !s[c.key] }))}
                            style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: 0, padding: "3px 0", cursor: "pointer", font: "inherit", fontSize: 13, color: c.on ? "var(--color-neutral-500)" : "var(--color-text)", textAlign: "left" }}
                          >
                            <i className={c.on ? "ph-fill ph-check-square" : "ph ph-square"} style={{ fontSize: 16, color: "var(--color-accent)" }} />
                            <span style={{ textDecoration: c.on ? "line-through" : "none" }}>{c.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          </>
        }
        side={
          <>
            <AreaTasksCard area="uni" title="Mis tareas de la uni" compact />
            <Card style={{ gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="card-kicker">What should I study today?</div>
                <span style={{ marginLeft: "auto" }}><DemoTag phase="fase 3" /></span>
              </div>
              <div style={{ fontSize: 13, color: "var(--color-neutral-400)" }}>2h 15m sugeridas según deadlines y exámenes.</div>
              {DEMO.study.map((s) => (
                <div key={s.subject} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 12px", borderRadius: "var(--radius-md)", background: "var(--color-neutral-900)" }}>
                  <div style={{ fontSize: 13, color: "var(--color-accent-300)", width: 52, flex: "none" }}>{s.mins}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14 }}>{s.subject}</div>
                    <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>{s.why}</div>
                  </div>
                </div>
              ))}
            </Card>
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="card-kicker">Cursos</div>
                <span style={{ marginLeft: "auto" }}><DemoTag phase="fase 3" /></span>
              </div>
              {DEMO.courses.map((c) => (
                <div key={c.code} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span>{c.code}</span> <span style={{ color: "var(--color-neutral-500)" }}>· {c.name}</span>
                  </span>
                  <span style={{ fontSize: 13, color: "var(--color-neutral-300)" }}>{c.grade}</span>
                </div>
              ))}
            </Card>
          </>
        }
      />
    </>
  );
}
