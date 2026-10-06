"use client";

import { Card, KickerRow } from "@/components/Cards";
import { useData } from "@/components/DataProvider";
import { NOTIFY } from "@/lib/notify";

/** Avisos al celular: los mandan dos rutinas de Claude; aquí se prenden y apagan. */
export function NotifyCard() {
  const { settings, create, patch, mode } = useData();
  if (mode !== "claude") return null;
  const isOn = (key: string) => settings.find((s) => s.key === key)?.value !== 0;
  const toggle = (key: string) => {
    const row = settings.find((s) => s.key === key);
    const value = isOn(key) ? 0 : 1;
    if (row) patch("settings", row.id, { value });
    else create("settings", { key, value });
  };
  return (
    <Card style={{ gap: 10 }}>
      <KickerRow kicker="Avisos al celular" />
      {NOTIFY.map((n) => {
        const on = isOn(n.key);
        return (
          <label key={n.key} style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
            <input type="checkbox" checked={on} onChange={() => toggle(n.key)} aria-label={n.title} style={{ marginTop: 4, accentColor: "var(--color-accent)" }} />
            <span style={{ minWidth: 0 }}>
              <span style={{ fontSize: 14 }}>
                {n.title} <span style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>· {n.time}</span>
              </span>
              <span style={{ display: "block", fontSize: 12, color: "var(--color-neutral-500)", lineHeight: 1.4 }}>{n.detail}</span>
            </span>
          </label>
        );
      })}
      <div style={{ fontSize: 11, color: "var(--color-neutral-500)" }}>Llegan como notificación de la app de Claude en tu celular.</div>
    </Card>
  );
}
