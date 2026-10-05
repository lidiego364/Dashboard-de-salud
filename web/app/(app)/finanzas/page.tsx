"use client";

import { AreaTasksCard, Card, DemoTag, PageTitle } from "@/components/Cards";
import { DEMO } from "@/lib/demo";

export default function FinanzasPage() {
  const max = Math.max(...DEMO.categories.map((c) => c[2]));
  return (
    <>
      <PageTitle title="Finanzas" sub="Septiembre 2026 · estado de cuenta importado · 64 transacciones clasificadas">
        <DemoTag phase="fase 4" />
        <button className="btn btn-primary" disabled title="Llega en la fase 4">
          <i className="ph ph-file-csv" style={{ fontSize: 16 }} />
          Importar estado de cuenta
        </button>
      </PageTitle>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16, marginBottom: 16 }}>
        {DEMO.insights.map((i) => (
          <Card key={i.text} style={{ gap: 8 }}>
            <i className={i.icon} style={{ fontSize: 20, color: "var(--color-accent)" }} />
            <div style={{ fontSize: 16, lineHeight: 1.35, textWrap: "pretty" }}>{i.text}</div>
            <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>{i.sub}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", marginBottom: 16 }}>
        <Card style={{ flex: "2 1 520px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div className="card-title">Por categoría</div>
            <div style={{ fontSize: 12, color: "var(--color-neutral-500)", marginLeft: "auto" }}>Sep $1,550 · Ago $1,238</div>
          </div>
          {DEMO.categories.map(([name, icon, a, b]) => {
            const d = a - b;
            return (
              <div key={name} style={{ display: "grid", gridTemplateColumns: "minmax(90px,130px) minmax(0,1fr) 56px 52px", gap: 12, alignItems: "center", fontSize: 13 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <i className={icon} style={{ color: "var(--color-neutral-400)", fontSize: 15 }} />
                  {name}
                </span>
                <div style={{ height: 8, borderRadius: 4, background: "var(--color-neutral-900)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(a / max) * 100}%`, background: name === "Food" ? "var(--color-accent)" : "var(--color-neutral-600)", borderRadius: 4 }} />
                </div>
                <span style={{ textAlign: "right" }}>${a}</span>
                <span style={{ textAlign: "right", fontSize: 12, color: d > 50 ? "var(--color-accent-300)" : "var(--color-neutral-500)" }}>
                  {d === 0 ? "—" : `${d > 0 ? "+$" : "−$"}${Math.abs(d)}`}
                </span>
              </div>
            );
          })}
        </Card>
        <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <div className="card-kicker">Puedes ahorrar ≈ $140/mes</div>
            {DEMO.savings.map((s) => (
              <div key={s.title} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 12px", borderRadius: "var(--radius-md)", background: "var(--color-neutral-900)" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>{s.detail}</div>
                </div>
                <div style={{ fontSize: 14, color: "var(--color-accent-300)" }}>{s.amt}</div>
              </div>
            ))}
          </Card>
          <AreaTasksCard area="fin" title="Pendientes de dinero" compact />
        </div>
      </div>

      <Card style={{ gap: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
          <div className="card-title">Transacciones recientes</div>
          <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>Clasificadas automáticamente · haz clic en la categoría para corregir</div>
        </div>
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Comercio</th>
                <th>Categoría</th>
                <th style={{ textAlign: "right" }}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {DEMO.transactions.map((t) => (
                <tr key={t.date + t.merchant}>
                  <td style={{ color: "var(--color-neutral-400)", whiteSpace: "nowrap" }}>{t.date}</td>
                  <td>{t.merchant}</td>
                  <td>
                    <span className="tag tag-accent">{t.cat}</span>
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{t.amt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
