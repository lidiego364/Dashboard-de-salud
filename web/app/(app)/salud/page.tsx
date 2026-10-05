"use client";

import { useEffect, useState } from "react";
import { AreaTasksCard, Card, DemoTag, PageTitle } from "@/components/Cards";
import { WeightChart } from "@/components/WeightChart";
import { addDays, todayISO } from "@/lib/dates";
import { DEMO } from "@/lib/demo";

export default function SaludPage() {
  // Las etiquetas del eje dependen de "hoy": se calculan en el cliente, no en el build.
  const [start, setStart] = useState<Date | null>(null);
  useEffect(() => setStart(new Date(`${addDays(todayISO(), -(DEMO.weights.length - 1))}T00:00:00Z`)), []);
  return (
    <>
      <PageTitle title="Salud · Weight cut" sub={`Meta ${DEMO.goalKg} kg · empezaste en 90.0 kg el 1 de agosto`}>
        <DemoTag phase="fase 2" />
        <button className="btn btn-primary" disabled title="Llega en la fase 2, con Garmin">
          <i className="ph ph-plus" style={{ fontSize: 15 }} />
          Registrar hoy
        </button>
      </PageTitle>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 16 }}>
        {DEMO.weightStats.map((s) => (
          <Card key={s.label} style={{ gap: 4 }}>
            <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>{s.label}</div>
            <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em", color: s.accent ? "var(--color-accent-300)" : undefined }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "var(--color-neutral-400)" }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      <Card style={{ padding: "18px 20px", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div className="card-title">Peso · últimos 28 días</div>
          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--color-neutral-400)", marginLeft: "auto", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-neutral-500)" }} />
              Peso diario
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, height: 2, background: "var(--color-accent)" }} />
              Tendencia 7 días
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, borderTop: "1px dashed var(--color-neutral-500)" }} />
              Meta {DEMO.goalKg} kg
            </span>
          </div>
        </div>
        {start ? <WeightChart weights={DEMO.weights} goal={DEMO.goalKg} start={start} /> : <div style={{ aspectRatio: "640 / 220" }} />}
        <div style={{ fontSize: 13, color: "var(--color-neutral-400)" }}>
          La tendencia suaviza agua y sodio: el peso de un día puede variar ±0.8 kg; la media de 7 días es la que cuenta.
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 16, marginBottom: 16 }}>
        {DEMO.healthMetrics.map((m) => (
          <Card key={m.label} style={{ padding: "14px 16px", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--color-neutral-500)" }}>
              <i className={m.icon} style={{ fontSize: 15 }} />
              {m.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 500 }}>{m.value}</div>
            <div style={{ height: 3, borderRadius: 2, background: "var(--color-neutral-800)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${m.pct}%`, background: "var(--color-accent-500)" }} />
            </div>
            <div style={{ fontSize: 12, color: "var(--color-neutral-400)" }}>{m.sub}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        <Card style={{ flex: "2 1 520px", minWidth: 0, gap: 6 }}>
          <div className="card-title" style={{ marginBottom: 4 }}>
            Entrenamientos · esta semana
          </div>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Sesión</th>
                  <th>Duración</th>
                  <th>Fuente</th>
                </tr>
              </thead>
              <tbody>
                {DEMO.workouts.map((w) => (
                  <tr key={w.day + w.name}>
                    <td style={{ color: "var(--color-neutral-400)" }}>{w.day}</td>
                    <td>{w.name}</td>
                    <td>{w.dur}</td>
                    <td>
                      <span className="tag tag-neutral">{w.src}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <AreaTasksCard area="salud" title="Tareas de salud" compact />
          <Card style={{ gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div className="card-title">Fotos de progreso</div>
              <button className="btn btn-ghost" style={{ marginLeft: "auto", fontSize: 12 }} disabled>
                <i className="ph ph-camera" />
                Añadir
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {DEMO.photos.map((p) => (
                <div key={p} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ aspectRatio: "3/4", borderRadius: "var(--radius-md)", border: "1px dashed var(--color-neutral-700)", display: "grid", placeItems: "center", color: "var(--color-neutral-600)" }}>
                    <i className="ph ph-image" style={{ fontSize: 20 }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-neutral-500)" }}>{p}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
