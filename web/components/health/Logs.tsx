"use client";

import { useState } from "react";
import { Card } from "@/components/Cards";
import { useData } from "@/components/DataProvider";
import { addDays, dayNum, dowShort, todayISO } from "@/lib/dates";

export function CreatineCard() {
  const { creatine, create, patch, remove } = useData();
  const [custom, setCustom] = useState(false);
  const [grams, setGrams] = useState("");
  const today = todayISO();
  const byDate = new Map(creatine.map((c) => [c.date, c]));
  const todayRow = byDate.get(today);
  const usual = [...creatine].sort((a, b) => b.date.localeCompare(a.date))[0]?.grams ?? 5;

  // Racha: días seguidos con creatina, contando desde hoy (o desde ayer si hoy aún no).
  let streak = 0;
  for (let d = todayRow ? today : addDays(today, -1); byDate.has(d); d = addDays(d, -1)) streak++;
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));

  const take = (g: number) => {
    if (!(g > 0)) return;
    if (todayRow) patch("creatine", todayRow.id, { grams: g });
    else create("creatine", { date: today, grams: g });
  };

  return (
    <Card style={{ gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="card-kicker">Creatina</div>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-neutral-500)" }}>
          {streak > 0 ? `Racha: ${streak} ${streak === 1 ? "día" : "días"}` : "Sin racha"}
        </span>
      </div>
      {todayRow ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <i className="ph-fill ph-check-circle" style={{ fontSize: 20, color: "var(--color-accent)" }} />
          <span style={{ fontSize: 15 }}>Hoy: {todayRow.grams} g</span>
          <button className="btn btn-ghost" style={{ marginLeft: "auto", fontSize: 12 }} onClick={() => remove("creatine", todayRow.id)}>
            Deshacer
          </button>
        </div>
      ) : custom ? (
        <form
          style={{ display: "flex", gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            take(Number(grams.replace(",", ".")));
            setCustom(false);
          }}
        >
          <input id="creatine-grams" className="input" type="number" inputMode="decimal" min="0" step="0.5" placeholder="g" value={grams} onChange={(e) => setGrams(e.target.value)} style={{ width: 90 }} autoFocus />
          <button className="btn btn-primary">Guardar</button>
          <button type="button" className="btn btn-ghost" onClick={() => setCustom(false)}>
            Cancelar
          </button>
        </form>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={() => take(usual)}>
            <i className="ph ph-check" /> Tomé {usual} g hoy
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => (setGrams(String(usual)), setCustom(true))}>
            Otra cantidad
          </button>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(14, 1fr)", gap: 3 }} aria-label="Creatina de los últimos 14 días">
        {last14.map((d) => {
          const on = byDate.has(d);
          return (
            <div key={d} title={`${dowShort(d)} ${dayNum(d)}: ${on ? `${byDate.get(d)!.grams} g` : "sin registro"}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ width: "100%", maxWidth: 14, aspectRatio: "1", borderRadius: 3, background: on ? "var(--color-accent-500)" : "var(--color-neutral-800)", outline: d === today ? "1px solid var(--color-accent)" : "none", outlineOffset: 1 }} />
              <span style={{ fontSize: 9, color: "var(--color-neutral-500)" }}>{dowShort(d).slice(0, 1)}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
