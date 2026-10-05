"use client";

import { Card } from "@/components/Cards";
import { dayNum, dowShort } from "@/lib/dates";
import { fmtHours, type healthView } from "@/lib/health";

type Recovery = ReturnType<typeof healthView>["recovery"];

const STAGE_COLOR: Record<string, string> = {
  deep: "var(--color-accent-200)",
  rem: "var(--color-accent-500)",
  light: "var(--color-accent-700)",
  awake: "var(--color-neutral-700)",
};

function Pill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <span className={ok ? "tag tag-neutral" : "tag tag-outline"}>{children}</span>;
}

/** HRV de cada noche (barras) y su promedio de 7 días (línea). */
function HrvChart({ series }: { series: { date: string; ms: number; weekly: number | null }[] }) {
  const W = 280, H = 70, pad = 2;
  const vals = series.flatMap((d) => [d.ms, d.weekly ?? d.ms]);
  const lo = Math.min(...vals) * 0.85, hi = Math.max(...vals) * 1.05;
  const bw = (W - pad * 2) / series.length;
  const Y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const line = series
    .filter((d) => d.weekly !== null)
    .map((d, i) => `${i ? "L" : "M"}${(pad + series.indexOf(d) * bw + bw / 2).toFixed(1)} ${Y(d.weekly!).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 70, display: "block" }} role="img" aria-label="HRV de las últimas noches">
      {series.map((d, i) => (
        <rect key={d.date} x={pad + i * bw + 2} y={Y(d.ms)} width={Math.max(2, bw - 4)} height={H - Y(d.ms)} rx={2} style={{ fill: i === series.length - 1 ? "var(--color-accent)" : "var(--color-neutral-700)" }}>
          <title>{`${d.date}: ${d.ms} ms${d.weekly ? ` · media 7 días ${d.weekly} ms` : ""}`}</title>
        </rect>
      ))}
      {line && <path d={line} fill="none" style={{ stroke: "var(--color-text)" }} strokeWidth={1.5} strokeDasharray="3 3" />}
    </svg>
  );
}

export function RecoveryRow({ recovery }: { recovery: Recovery }) {
  const { hrv, training, recoveryHours, sleep } = recovery;
  if (!hrv && !training && !sleep) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16, marginBottom: 16 }}>
      {hrv && (
        <Card style={{ gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="card-kicker">HRV nocturno</div>
            {hrv.status && <span style={{ marginLeft: "auto" }}><Pill ok={hrv.status.ok}>{hrv.status.label}</Pill></span>}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 500 }}>{hrv.ms} ms</span>
            {hrv.diff !== null && (
              <span style={{ fontSize: 13, color: hrv.diff < -10 ? "var(--color-accent-300)" : "var(--color-neutral-400)" }}>
                {hrv.diff >= 0 ? "+" : "−"}
                {Math.abs(hrv.diff)} vs media 7 días ({hrv.weekly} ms)
              </span>
            )}
          </div>
          <HrvChart series={hrv.series} />
          <div style={{ fontSize: 12, color: "var(--color-neutral-400)" }}>
            {hrv.diff !== null && hrv.diff < -10
              ? "Más de 10 ms bajo tu media: conviene bajar la carga hoy."
              : "Barras: cada noche · línea: media de 7 días. Mira la tendencia, no una noche suelta."}
          </div>
        </Card>
      )}
      {training && (
        <Card style={{ gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="card-kicker">Estado de entrenamiento</div>
            {training.acwr && <span style={{ marginLeft: "auto" }}><Pill ok={training.acwr.ok}>Carga {training.acwr.label}</Pill></span>}
          </div>
          <div style={{ fontSize: 28, fontWeight: 500 }}>{training.label}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontVariantNumeric: "tabular-nums" }}>
            {[
              ["Aguda (7 d)", training.acute],
              ["Crónica (28 d)", training.chronic],
              ["Relación", training.ratio !== null ? training.ratio.toFixed(1) : null],
            ].map(([label, v]) => (
              <div key={label as string}>
                <div style={{ fontSize: 11, color: "var(--color-neutral-500)" }}>{label}</div>
                <div style={{ fontSize: 16 }}>{v ?? "—"}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-neutral-400)" }}>
            {[training.balance, recoveryHours !== null && `Recuperación pendiente: ${Math.round(recoveryHours)} h`].filter(Boolean).join(" · ")}
          </div>
        </Card>
      )}
      {sleep && (
        <Card style={{ gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="card-kicker">Sueño por fases</div>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-neutral-500)" }}>Anoche · {fmtHours(sleep.total)}</span>
          </div>
          <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden" }} role="img" aria-label="Fases del sueño de anoche">
            {sleep.stages.filter((s) => s.h > 0).map((s) => (
              <div key={s.key} title={`${s.label}: ${fmtHours(s.h)}`} style={{ flex: s.h, background: STAGE_COLOR[s.key] }} />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 12, color: "var(--color-neutral-400)" }}>
            {sleep.stages.map((s) => (
              <span key={s.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: STAGE_COLOR[s.key] }} />
                {s.label} {fmtHours(s.h)}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 64, marginTop: 2 }} aria-label="Últimas 7 noches">
            {sleep.week.map((n) => {
              const max = Math.max(...sleep.week.map((x) => x.total), 8);
              return (
                <div key={n.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }} title={`${n.date}: ${fmtHours(n.total)} · score ${n.score}`}>
                  <div style={{ width: "100%", maxWidth: 22, height: `${(n.total / max) * 48}px`, display: "flex", flexDirection: "column-reverse", borderRadius: 3, overflow: "hidden" }}>
                    {(["deep", "rem", "light", "awake"] as const).map((k) => (
                      <div key={k} style={{ flex: n[k], background: STAGE_COLOR[k] }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 10, color: "var(--color-neutral-500)" }}>
                    {dowShort(n.date).slice(0, 2)} {dayNum(n.date)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
