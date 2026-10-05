"use client";

import { AreaTasksCard, Card, DemoTag, Loading, PageTitle } from "@/components/Cards";
import { useHealth } from "@/components/useHealth";
import { WeightChart } from "@/components/WeightChart";
import { DEMO } from "@/lib/demo";

export default function SaludPage() {
  const health = useHealth();
  if (!health) return <Loading />;
  const { view: h, live } = health;

  return (
    <>
      <PageTitle title="Salud · Weight cut" sub={h.subtitle}>
        {!live && <DemoTag phase="fase 2" />}
      </PageTitle>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 16 }}>
        {h.weightStats.map((s) => (
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
              Pesaje
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, height: 2, background: "var(--color-accent)" }} />
              Tendencia 7 días
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, borderTop: "1px dashed var(--color-neutral-500)" }} />
              Meta {h.chart.goal} kg
            </span>
          </div>
        </div>
        {h.chart.points.length ? <WeightChart {...h.chart} /> : <div className="empty">Sin pesajes en los últimos 28 días.</div>}
        <div style={{ fontSize: 13, color: "var(--color-neutral-400)" }}>
          La tendencia suaviza agua y sodio: el peso de un día puede variar ±0.8 kg; la media de 7 días es la que cuenta.
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 16, marginBottom: 16 }}>
        {h.metrics.map((m) => (
          <Card key={m.label} style={{ padding: "14px 16px", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--color-neutral-500)" }}>
              <i className={m.icon} style={{ fontSize: 15 }} />
              {m.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 500 }}>{m.value}</div>
            <div style={{ height: 3, borderRadius: 2, background: m.pct === null ? "transparent" : "var(--color-neutral-800)", overflow: "hidden" }}>
              {m.pct !== null && <div style={{ height: "100%", width: `${m.pct}%`, background: "var(--color-accent-500)" }} />}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-neutral-400)" }}>{m.sub}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        <Card style={{ flex: "2 1 520px", minWidth: 0, gap: 6 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
            <div className="card-title">Entrenamientos · últimos 7 días</div>
            <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>{h.workouts.length} sesiones</div>
          </div>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Sesión</th>
                  <th>Duración</th>
                  <th>FC media</th>
                  <th style={{ textAlign: "right" }}>kcal</th>
                </tr>
              </thead>
              <tbody>
                {h.workouts.map((w) => (
                  <tr key={w.key}>
                    <td style={{ color: "var(--color-neutral-400)", whiteSpace: "nowrap" }}>{w.day}</td>
                    <td>{w.name}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{w.dur}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{w.hr}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{w.kcal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!h.workouts.length && <div className="empty">Sin entrenamientos registrados esta semana.</div>}
          </div>
        </Card>
        <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <AreaTasksCard area="salud" title="Tareas de salud" compact />
          <Card style={{ gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div className="card-title">Fotos de progreso</div>
              <button className="btn btn-ghost" style={{ marginLeft: "auto", fontSize: 12 }} disabled title="Próximamente">
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
