"use client";

import { Card, Columns, DemoTag, Loading, PageTitle } from "@/components/Cards";
import { CreatineCard } from "@/components/health/Logs";
import { useHealth } from "@/components/useHealth";
import { WeightChart } from "@/components/WeightChart";

// Salud: solo la tendencia del peso y la creatina. Lo demás (sueño, pasos,
// entrenamientos) se ve en la app de Garmin.
export default function SaludPage() {
  const health = useHealth();
  if (!health || (health.source === "demo" && health.loading)) return <Loading />;
  if (health.unavailable)
    return (
      <>
        <PageTitle title="Salud · Weight cut" />
        <Columns
          main={
            <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <i className="ph ph-watch" style={{ fontSize: 22, color: "var(--color-accent)" }} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 15 }}>No pude leer tus pesajes de Garmin</div>
                <div style={{ fontSize: 13, color: "var(--color-neutral-400)" }}>{health.error}</div>
              </div>
            </Card>
          }
          side={<CreatineCard />}
        />
      </>
    );
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

      <Columns
        main={
          <Card style={{ padding: "18px 20px", gap: 12 }}>
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
        }
        side={<CreatineCard />}
      />
    </>
  );
}
