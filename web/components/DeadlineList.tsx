"use client";

import { dayNum, monShort, relativeDays, todayISO } from "@/lib/dates";
import type { Deadline } from "@/lib/selectors";

/** Lista de entregas (tareas de la uni + entregas/exámenes del calendario). */
export function DeadlineList({ items, calendarState }: { items: Deadline[]; calendarState?: { loading: boolean; error: string | null; available: boolean } }) {
  const today = todayISO();
  return (
    <>
      {items.map((d) => {
        const row = (
          <>
            <span
              style={{ width: 44, flex: "none", textAlign: "center", borderRadius: "var(--radius-sm)", padding: "4px 0", background: "var(--color-neutral-900)" }}
            >
              <span style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-neutral-500)" }}>
                {monShort(d.date)}
              </span>
              <span style={{ display: "block", fontSize: 17, fontWeight: 500 }}>{dayNum(d.date)}</span>
            </span>
            <span style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 14, overflowWrap: "anywhere" }}>{d.title}</span>
              {(d.meta || d.source === "calendar") && (
                <span style={{ fontSize: 12, color: "var(--color-neutral-500)", display: "flex", alignItems: "center", gap: 4 }}>
                  {d.source === "calendar" && <i className="ph ph-calendar-blank" title="De Google Calendar" />}
                  {d.meta ?? "Google Calendar"}
                </span>
              )}
            </span>
            <span className={d.days <= 3 ? "tag tag-outline" : "tag tag-neutral"} style={{ flex: "none" }}>
              {relativeDays(d.date, today)}
            </span>
          </>
        );
        const style: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "4px 6px", margin: "0 -6px", textDecoration: "none", color: "inherit" };
        return d.link ? (
          <a key={d.key} href={d.link} target="_blank" rel="noopener noreferrer" className="row-btn" style={style} title="Abrir en Google Calendar">
            {row}
          </a>
        ) : (
          <div key={d.key} style={style}>
            {row}
          </div>
        );
      })}
      {calendarState?.available && calendarState.loading && <div className="empty">Buscando entregas en tu calendario…</div>}
      {calendarState?.error && <div className="empty">{calendarState.error}</div>}
      {!items.length && !calendarState?.loading && <div className="empty">Sin entregas próximas.</div>}
    </>
  );
}
