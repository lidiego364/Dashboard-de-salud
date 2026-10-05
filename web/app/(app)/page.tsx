"use client";

import { useState } from "react";
import { useData } from "@/components/DataProvider";
import { TaskDialog } from "@/components/forms";
import { AddButton, TaskItem } from "@/components/items";
import { Card, Columns, DemoTag, GoalsCard, GoToButton, KickerRow, Loading, RemindersCard } from "@/components/Cards";
import { dayNum, dowShort, greeting, nowHM, relativeDays, shortDate, todayISO } from "@/lib/dates";
import { tasksForToday, upcomingDeadlines, weekAhead } from "@/lib/selectors";
import { AREA_KEYS, AREAS, type Area } from "@/lib/types";
import { DEMO } from "@/lib/demo";
import { useHealth } from "@/components/useHealth";
import { useCalendar } from "@/components/useCalendar";
import { DeadlineList } from "@/components/DeadlineList";
import { withWeights } from "@/lib/uni";
import { CreatineToday } from "@/components/health/Logs";

export default function HoyPage() {
  const { tasks, reminders, courses, assignment_meta, loading, mode, loadExample } = useData();
  const [adding, setAdding] = useState<{ date: string | null } | null>(null);
  const health = useHealth();
  const cal = useCalendar();
  if (loading || !health) return <Loading />;

  const today = todayISO();
  const todays = tasksForToday(tasks, today, todayISO);
  const doneCount = todays.filter((t) => t.done_at).length;
  const pending = todays.length - doneCount;
  const groups = AREA_KEYS.map((a) => ({ area: a, ...AREAS[a], tasks: todays.filter((t) => t.area === a) })).filter((g) => g.tasks.length);
  const week = weekAhead(tasks, reminders, today, cal.events);
  const agenda = cal.events.filter((e) => e.date === today).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  const now = nowHM();
  const nextEvent = agenda.find((e) => e.time && (e.endTime ?? e.time) > now);
  // % de la nota según los syllabus; las marcadas como hechas en Universidad no aparecen.
  const deadlines = withWeights(upcomingDeadlines(tasks, today, 200, cal.events, now), courses, assignment_meta).slice(0, 5);
  const empty = !tasks.length && mode !== "demo";

  const summary = [
    pending === 0 ? "Nada pendiente hoy" : `${pending} ${pending === 1 ? "tarea pendiente" : "tareas pendientes"} hoy`,
    nextEvent
      ? nextEvent.time! <= now
        ? `Ahora: ${nextEvent.title} (hasta las ${nextEvent.endTime})`
        : `Próximo: ${nextEvent.title} a las ${nextEvent.time}`
      : agenda.length > 0 && `${agenda.length} ${agenda.length === 1 ? "evento" : "eventos"} hoy en tu calendario`,
    deadlines[0] && `${deadlines[0].title} vence ${relativeDays(deadlines[0].date, today).toLowerCase()}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
        <h1 style={{ fontSize: 34, margin: 0 }}>{greeting()}, Diego</h1>
        <div style={{ fontSize: 14, color: "var(--color-neutral-400)" }}>{summary}</div>
      </div>

      {empty && (
        <Card style={{ marginBottom: 16, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <i className="ph ph-sparkle" style={{ fontSize: 22, color: "var(--color-accent)" }} />
          <div style={{ flex: 1, minWidth: 220, fontSize: 14 }}>
            Tu cuenta está vacía. Puedes empezar a agregar tareas o cargar las del prototipo para probar.
          </div>
          <button className="btn btn-secondary" onClick={loadExample}>
            Cargar ejemplo
          </button>
        </Card>
      )}

      <Columns
        main={
          <>
            <Card style={{ padding: "18px 20px", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <div className="card-title" style={{ fontSize: 19 }}>
                  ¿Qué tengo que hacer hoy?
                </div>
                <div style={{ fontSize: 12, color: "var(--color-neutral-500)", marginLeft: "auto" }}>
                  {doneCount} de {todays.length} hechas
                </div>
                <AddButton label="Tarea" onClick={() => setAdding({ date: today })} />
              </div>
              <div style={{ height: 3, borderRadius: 2, background: "var(--color-neutral-800)", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${todays.length ? (doneCount / todays.length) * 100 : 0}%`,
                    background: "var(--color-accent)",
                    transition: "width .2s",
                  }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "18px 24px", marginTop: 4 }}>
                {groups.map((g) => (
                  <div key={g.area} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        fontSize: 11,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "var(--color-accent-300)",
                      }}
                    >
                      <i className={g.icon} style={{ fontSize: 14 }} />
                      {g.label}
                    </div>
                    {g.tasks.map((t) => (
                      <TaskItem key={t.id} task={t} />
                    ))}
                  </div>
                ))}
                {!groups.length && <div className="empty">No hay nada para hoy. Agrega una tarea con “+ Tarea”.</div>}
              </div>
            </Card>

            <Card style={{ padding: "18px 20px", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <div className="card-title">Esta semana</div>
                <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
                  {shortDate(week[0].day)} – {shortDate(week[6].day)}
                </div>
              </div>
              <div className="scroll-x" style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(92px,1fr))", gap: 6 }}>
                {week.map(({ day, events }, i) => (
                  <div
                    key={day}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      padding: "10px 8px",
                      borderRadius: "var(--radius-md)",
                      minHeight: 170,
                      background: i === 0 ? "color-mix(in srgb, var(--color-accent) 8%, transparent)" : "transparent",
                      boxShadow: i === 0 ? "inset 0 0 0 1px var(--color-accent-700)" : "inset 0 0 0 1px var(--color-neutral-900)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-neutral-500)" }}>
                        {dowShort(day)}
                      </span>
                      <span style={{ fontSize: 17, fontWeight: 500, color: i === 0 ? "var(--color-accent-300)" : "var(--color-text)" }}>
                        {dayNum(day)}
                      </span>
                      <button
                        className="btn btn-ghost"
                        style={{ marginLeft: "auto", padding: "0 4px", fontSize: 13, color: "var(--color-neutral-600)" }}
                        aria-label={`Agregar tarea el ${shortDate(day)}`}
                        onClick={() => setAdding({ date: day })}
                      >
                        <i className="ph ph-plus" />
                      </button>
                    </div>
                    {events.map((e) => {
                      const isCal = e.kind === "calendar";
                      const body = (
                        <>
                          <span style={{ fontSize: 11, color: "var(--color-neutral-400)", display: "flex", alignItems: "center", gap: 4 }}>
                            {e.kind === "reminder" ? <i className="ph ph-bell" /> : isCal ? <i className="ph ph-calendar-blank" /> : null}
                            {e.kind !== "reminder" && e.time}
                          </span>
                          <span style={{ fontSize: 12, lineHeight: 1.3, textDecoration: e.done ? "line-through" : "none" }}>{e.title}</span>
                        </>
                      );
                      const style: React.CSSProperties = {
                        display: "flex",
                        flexDirection: "column",
                        padding: "5px 7px",
                        borderRadius: "var(--radius-sm)",
                        background: isCal ? "var(--color-surface)" : e.area === "uni" ? "var(--color-accent-900)" : "var(--color-neutral-900)",
                        boxShadow: isCal ? "inset 0 0 0 1px var(--color-neutral-800)" : undefined,
                        borderLeft: `2px solid ${isCal ? "var(--color-neutral-400)" : eventLine(e.area)}`,
                        opacity: e.done ? 0.55 : 1,
                        color: "inherit",
                        textDecoration: "none",
                      };
                      return isCal && e.link ? (
                        <a key={e.kind + e.id} href={e.link} target="_blank" rel="noopener noreferrer" style={style} title="Abrir en Google Calendar">
                          {body}
                        </a>
                      ) : (
                        <div key={e.kind + e.id} style={style}>
                          {body}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </Card>
          </>
        }
        side={
          <>
            {cal.available && (
              <Card>
                <KickerRow kicker="Hoy en tu calendario">
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-neutral-500)" }}>Google Calendar</span>
                </KickerRow>
                {cal.loading && <div className="empty">Leyendo tu calendario…</div>}
                {cal.error && <div className="empty">{cal.error}</div>}
                {!cal.loading && !cal.error && !agenda.length && <div className="empty">Nada en tu calendario hoy.</div>}
                {agenda.map((e) => {
                  const past = !!e.time && (e.endTime ?? e.time) <= now;
                  return (
                    <a
                      key={e.id}
                      href={e.link ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="row-btn"
                      style={{ alignItems: "baseline", gap: 12, textDecoration: "none", opacity: past ? 0.55 : 1 }}
                    >
                      <span style={{ width: 82, flex: "none", fontSize: 12, color: e === nextEvent ? "var(--color-accent-300)" : "var(--color-neutral-500)", fontVariantNumeric: "tabular-nums" }}>
                        {e.time ? `${e.time}${e.endTime ? `–${e.endTime}` : ""}` : "Todo el día"}
                      </span>
                      <span style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 14 }}>{e.title}</span>
                        {e.location && <span style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>{e.location}</span>}
                      </span>
                    </a>
                  );
                })}
              </Card>
            )}

            <Card>
              <KickerRow kicker="Deadlines FIU">
                <GoToButton href="/uni" label="Ver todo" />
              </KickerRow>
              <DeadlineList items={deadlines} calendarState={cal} />
            </Card>

            <Card style={{ gap: 8 }}>
              <KickerRow kicker={`Presupuesto · ${DEMO.budget.month}`}>
                <DemoTag phase="fase 4" />
                <GoToButton href="/finanzas" label="Finanzas" />
              </KickerRow>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em" }}>${(DEMO.budget.total - DEMO.budget.spent).toLocaleString("en-US")}</span>
                <span style={{ fontSize: 13, color: "var(--color-neutral-400)" }}>restantes de ${DEMO.budget.total.toLocaleString("en-US")}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "var(--color-neutral-800)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(DEMO.budget.spent / DEMO.budget.total) * 100}%`, background: "var(--color-accent)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-neutral-500)" }}>
                <span>Gastado ${DEMO.budget.spent}</span>
                <span>≈ ${DEMO.budget.perDay}/día disponible</span>
              </div>
            </Card>

            <Card>
              <KickerRow kicker="Salud">
                {health.live ? (
                  <span style={{ fontSize: 11, color: "var(--color-neutral-500)" }}>Garmin · {health.view.syncedLabel}</span>
                ) : health.loading ? (
                  <span style={{ fontSize: 11, color: "var(--color-neutral-500)" }}>Leyendo Garmin…</span>
                ) : (
                  !health.unavailable && <DemoTag phase="fase 2" />
                )}
                <GoToButton href="/salud" label="Detalle" />
              </KickerRow>
              {health.unavailable ? (
                <>
                  <div className="empty">{health.error}</div>
                  <CreatineToday />
                </>
              ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
                <Stat label="Peso" value={health.view.hoy.weight} unit="kg" big />
                <Stat label="Tendencia 7 días" value={health.view.hoy.trend} unit="kg" big accent />
                <Stat label="Ritmo semanal" value={health.view.hoy.weekly} />
                <CreatineToday />
              </div>
              )}
            </Card>

            <GoalsCard />
            <RemindersCard limit={5} />
          </>
        }
      />
      {adding && <TaskDialog defaultDate={adding.date} onClose={() => setAdding(null)} />}
    </>
  );
}

function eventLine(area: Area | null) {
  if (area === "uni") return "var(--color-accent)";
  if (area === "salud") return "var(--color-accent-300)";
  return "var(--color-neutral-600)";
}

function Stat({ label, value, unit, big, accent }: { label: string; value: string; unit?: string; big?: boolean; accent?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>{label}</div>
      <div style={{ fontSize: big ? 22 : 16, fontWeight: big ? 500 : 400, color: accent ? "var(--color-accent-300)" : undefined }}>
        {value} {unit && <span style={{ fontSize: big ? 13 : 12, color: "var(--color-neutral-500)" }}>{unit}</span>}
      </div>
    </div>
  );
}
