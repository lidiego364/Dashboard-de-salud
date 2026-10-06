"use client";

import { useState } from "react";
import { Card } from "@/components/Cards";
import { useData } from "@/components/DataProvider";
import { shortDate, todayISO } from "@/lib/dates";
import { categoryDeltas, merchantKey, monthOf, monthStats, prevMonth, recurring, type ViewTx } from "@/lib/finance";
import { FIN_CATEGORIES, FIN_CATEGORY_KEYS, type FinCategory, type Transaction } from "@/lib/types";

export const money = (n: number, cents = false) =>
  `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`;
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const monthName = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1];

/** Presupuesto mensual (se guarda en Ajustes). */
export function useBudget() {
  const { settings, create, patch } = useData();
  const row = settings.find((s) => s.key === "budget");
  const set = (v: number) => (row ? patch("settings", row.id, { value: v }) : create("settings", { key: "budget", value: v }));
  return { budget: row?.value ?? null, setBudget: set };
}

export function Kpis({ txs, ym }: { txs: ViewTx[]; ym: string }) {
  const { budget, setBudget } = useBudget();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const st = monthStats(txs, ym);
  const isCurrent = ym === monthOf(todayISO());
  const left = budget !== null ? budget - st.spent : null;
  const perDay = left !== null && isCurrent && st.daysLeft > 0 ? left / st.daysLeft : null;
  const diff = st.spent - st.prevSameDay;

  const cards = [
    { label: `Gastado en ${monthName(ym)}`, value: money(st.spent), sub: `${st.count} movimientos`, accent: false },
    {
      label: "Presupuesto",
      value: budget !== null ? money(budget) : "—",
      sub: budget !== null ? (left! >= 0 ? `Quedan ${money(left!)}` : `Te pasaste ${money(-left!)}`) : "Toca para fijarlo",
      accent: left !== null && left < 0,
      edit: true,
    },
    {
      label: isCurrent ? "Disponible por día" : "Resultado del mes",
      value: perDay !== null ? money(Math.max(0, perDay)) : left !== null ? money(left) : "—",
      sub: isCurrent ? `${st.daysLeft} días que quedan` : "Presupuesto − gastado",
      accent: perDay !== null && perDay < 0,
    },
    {
      label: `vs ${monthName(prevMonth(ym))} al día ${st.dayOfMonth}`,
      value: st.prevSameDay > 0 ? `${diff >= 0 ? "+" : "−"}${money(Math.abs(diff))}` : "—",
      sub: st.prevSameDay > 0 ? `${money(st.prevSameDay)} a esta altura del mes pasado` : "Sin datos del mes anterior",
      accent: diff > 0 && st.prevSameDay > 0,
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 16 }}>
      {cards.map((c) => (
        <Card key={c.label} style={{ gap: 4 }}>
          <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>{c.label}</div>
          {c.edit && editing ? (
            <form
              style={{ display: "flex", gap: 6 }}
              onSubmit={(e) => {
                e.preventDefault();
                const v = Number(val.replace(/[$,\s]/g, ""));
                if (v > 0) setBudget(Math.round(v));
                setEditing(false);
              }}
            >
              <input id="budget-input" className="input" inputMode="numeric" value={val} onChange={(e) => setVal(e.target.value)} autoFocus style={{ fontSize: 20 }} />
              <button className="btn btn-primary">OK</button>
            </form>
          ) : c.edit ? (
            <button
              className="row-btn"
              style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em", padding: "0 6px" }}
              onClick={() => (setVal(budget ? String(budget) : ""), setEditing(true))}
              title="Cambiar presupuesto mensual"
            >
              {c.value} <i className="ph ph-pencil-simple" style={{ fontSize: 15, color: "var(--color-neutral-500)" }} />
            </button>
          ) : (
            <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em", color: c.accent ? "var(--color-accent-300)" : undefined }}>{c.value}</div>
          )}
          <div style={{ fontSize: 12, color: c.accent ? "var(--color-accent-300)" : "var(--color-neutral-400)" }}>{c.sub}</div>
        </Card>
      ))}
    </div>
  );
}

export function Insights({ txs, stored, ym }: { txs: ViewTx[]; stored: Transaction[]; ym: string }) {
  const st = monthStats(txs, ym);
  const deltas = categoryDeltas(txs, ym).filter((d) => d.category !== "transferencias");
  const up = [...deltas].sort((a, b) => b.amount - b.prev - (a.amount - a.prev))[0];
  const subs = recurring(stored);
  const subsTotal = subs.reduce((a, s) => a + s.amount, 0);
  const items = [
    st.prevSameDay > 0 && {
      icon: st.spent > st.prevSameDay ? "ph ph-trend-up" : "ph ph-trend-down",
      text: `Llevas ${money(Math.abs(st.spent - st.prevSameDay))} ${st.spent > st.prevSameDay ? "más" : "menos"} que en ${monthName(prevMonth(ym))} a esta altura.`,
      sub: `${money(st.spent)} vs ${money(st.prevSameDay)} al día ${st.dayOfMonth}`,
    },
    up &&
      up.amount - up.prev > 0 && {
        icon: FIN_CATEGORIES[up.category].icon,
        text: `Tu mayor aumento es ${FIN_CATEGORIES[up.category].label.toLowerCase()}.`,
        sub: `+${money(up.amount - up.prev)} · ${money(up.amount)} este mes`,
      },
    subs.length > 0 && {
      icon: "ph ph-repeat",
      text: `Pagas ${money(subsTotal, true)} al mes en ${subs.length} ${subs.length === 1 ? "pago que se repite" : "pagos que se repiten"}.`,
      sub: subs.slice(0, 3).map((s) => s.merchant).join(" · "),
    },
  ].filter(Boolean) as { icon: string; text: string; sub: string }[];
  if (!items.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16, marginBottom: 16 }}>
      {items.map((i) => (
        <Card key={i.text} style={{ gap: 8 }}>
          <i className={i.icon} style={{ fontSize: 20, color: "var(--color-accent)" }} />
          <div style={{ fontSize: 16, lineHeight: 1.35, textWrap: "pretty" }}>{i.text}</div>
          <div style={{ fontSize: 12, color: "var(--color-neutral-500)", overflowWrap: "anywhere" }}>{i.sub}</div>
        </Card>
      ))}
    </div>
  );
}

export function ByCategory({ txs, ym, selected, onSelect }: { txs: ViewTx[]; ym: string; selected: FinCategory | null; onSelect: (c: FinCategory | null) => void }) {
  const rows = categoryDeltas(txs, ym);
  const max = Math.max(1, ...rows.map((r) => r.amount));
  const st = monthStats(txs, ym);
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div className="card-title">Por categoría</div>
        <div style={{ fontSize: 12, color: "var(--color-neutral-500)", marginLeft: "auto" }}>
          {monthName(ym)} {money(st.spent)} · {monthName(prevMonth(ym))} al día {st.dayOfMonth}: {money(st.prevSameDay)}
        </div>
      </div>
      {rows.map(({ category, amount, prev }) => {
        const d = amount - prev;
        const on = selected === category;
        return (
          <button
            key={category}
            className="row-btn"
            aria-pressed={on}
            onClick={() => onSelect(on ? null : category)}
            style={{ display: "grid", gridTemplateColumns: "minmax(110px,170px) minmax(0,1fr) 64px 56px", gap: 12, alignItems: "center", fontSize: 13, background: on ? "var(--color-neutral-900)" : undefined }}
            title="Ver solo esta categoría"
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <i className={FIN_CATEGORIES[category].icon} style={{ color: "var(--color-neutral-400)", fontSize: 15 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{FIN_CATEGORIES[category].label}</span>
            </span>
            <span style={{ height: 8, borderRadius: 4, background: "var(--color-neutral-900)", overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${(amount / max) * 100}%`, background: on || rows[0].category === category ? "var(--color-accent)" : "var(--color-neutral-600)", borderRadius: 4 }} />
            </span>
            <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{money(amount)}</span>
            <span style={{ textAlign: "right", fontSize: 12, fontVariantNumeric: "tabular-nums", color: d > 50 ? "var(--color-accent-300)" : "var(--color-neutral-500)" }}>
              {prev === 0 && amount === 0 ? "—" : d === 0 ? "=" : `${d > 0 ? "+" : "−"}${money(Math.abs(d))}`}
            </span>
          </button>
        );
      })}
      {!rows.length && <div className="empty">Sin gastos en {monthName(ym)}.</div>}
    </Card>
  );
}

export function Subscriptions({ stored }: { stored: Transaction[] }) {
  const subs = recurring(stored);
  return (
    <Card>
      <div className="card-kicker">Pagos que se repiten</div>
      {subs.map((s) => (
        <div key={s.merchant} style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 12px", borderRadius: "var(--radius-md)", background: "var(--color-neutral-900)" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14 }}>{s.merchant}</div>
            <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
              {s.months} meses seguidos · último {shortDate(s.last)}
            </div>
          </div>
          <div style={{ fontSize: 14, color: "var(--color-accent-300)", fontVariantNumeric: "tabular-nums" }}>{money(s.amount, true)}/mes</div>
        </div>
      ))}
      {!subs.length && <div className="empty">Con 2 meses importados detecto suscripciones y pagos fijos.</div>}
    </Card>
  );
}

export function TransactionsTable({ txs, ym, filter, onClearFilter }: { txs: ViewTx[]; ym: string; filter: FinCategory | null; onClearFilter: () => void }) {
  const { transactions, fin_rules, patch, create, remove } = useData();
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const list = txs.filter((t) => monthOf(t.date) === ym && (!filter || t.category === filter));
  const shown = showAll ? list : list.slice(0, 25);

  // Corregir la categoría también la recuerda para ese comercio (y la aplica a los demás).
  const recategorize = (t: ViewTx, category: FinCategory) => {
    const key = merchantKey(t.merchant);
    for (const x of transactions) if (x.id === t.id || (key && merchantKey(x.merchant) === key && x.category !== category)) patch("transactions", x.id, { category });
    if (!key) return;
    const rule = fin_rules.find((r) => r.merchant_key === key);
    if (rule) patch("fin_rules", rule.id, { category });
    else create("fin_rules", { merchant_key: key, category });
  };

  return (
    <Card style={{ gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
        <div className="card-title">Movimientos de {monthName(ym)}</div>
        <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>Toca la categoría para corregirla: lo recuerdo para ese comercio.</div>
        {filter && (
          <button className="btn btn-ghost" style={{ marginLeft: "auto", fontSize: 12 }} onClick={onClearFilter}>
            {FIN_CATEGORIES[filter].label} <i className="ph ph-x" />
          </button>
        )}
      </div>
      <div className="scroll-x">
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Comercio</th>
              <th>Categoría</th>
              <th style={{ textAlign: "right" }}>Monto</th>
              <th style={{ width: 32 }} />
            </tr>
          </thead>
          <tbody>
            {shown.map((t) => (
              <tr key={t.id}>
                <td style={{ color: "var(--color-neutral-400)", whiteSpace: "nowrap" }}>{shortDate(t.date)}</td>
                <td style={{ minWidth: 140 }}>
                  <div title={t.description}>{t.merchant}</div>
                  {t.source !== "csv" && (
                    <div style={{ fontSize: 11, color: "var(--color-neutral-500)" }}>{t.source === "gmail" ? "Zelle · alerta de Gmail" : t.source === "manual" ? "anotado a mano" : "del PDF"}</div>
                  )}
                </td>
                <td>
                  {t.source === "gmail" ? (
                    <span className="tag tag-neutral">{FIN_CATEGORIES[t.category].label}</span>
                  ) : (
                    <select
                      aria-label={`Categoría de ${t.merchant}`}
                      className="tag tag-accent"
                      value={t.category}
                      onChange={(e) => recategorize(t, e.target.value as FinCategory)}
                      style={{ border: 0, font: "inherit", fontSize: 11, cursor: "pointer" }}
                    >
                      {FIN_CATEGORY_KEYS.map((k) => (
                        <option key={k} value={k}>
                          {FIN_CATEGORIES[k].label}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: t.amount > 0 ? "var(--color-accent-300)" : undefined }}>
                  {t.amount > 0 ? "+" : ""}
                  {money(t.amount, true)}
                </td>
                <td>
                  {t.source === "manual" &&
                    (confirmDel === t.id ? (
                      <button className="btn btn-ghost btn-danger" style={{ fontSize: 11, padding: "2px 4px" }} onClick={() => remove("transactions", t.id)}>
                        Borrar
                      </button>
                    ) : (
                      <button className="btn btn-ghost btn-icon" aria-label="Borrar gasto anotado" style={{ width: 26, height: 26 }} onClick={() => setConfirmDel(t.id)}>
                        <i className="ph ph-trash" />
                      </button>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length > shown.length && (
        <button className="btn btn-ghost" style={{ alignSelf: "flex-start", fontSize: 12 }} onClick={() => setShowAll(true)}>
          Ver los {list.length} movimientos
        </button>
      )}
      {!list.length && <div className="empty">Sin movimientos{filter ? " en esta categoría" : ""} en {monthName(ym)}.</div>}
    </Card>
  );
}

/** Tarjeta de Hoy: presupuesto del mes con lo importado + Zelle de Gmail. */
export function BudgetCard({ txs, imported }: { txs: ViewTx[]; imported: boolean }) {
  const { budget } = useBudget();
  const ym = monthOf(todayISO());
  const st = monthStats(txs, ym);
  const left = budget !== null ? budget - st.spent : null;
  const perDay = left !== null && st.daysLeft > 0 ? left / st.daysLeft : null;
  if (!imported)
    return <div className="empty">Importa el CSV de Wells Fargo en Finanzas y aquí verás cuánto te queda del mes.</div>;
  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em", color: left !== null && left < 0 ? "var(--color-accent-300)" : undefined }}>
          {left !== null ? money(left) : money(st.spent)}
        </span>
        <span style={{ fontSize: 13, color: "var(--color-neutral-400)" }}>{budget !== null ? `restantes de ${money(budget)}` : "gastado este mes · fija un presupuesto en Finanzas"}</span>
      </div>
      {budget !== null && (
        <div style={{ height: 6, borderRadius: 3, background: "var(--color-neutral-800)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, (st.spent / Math.max(1, budget)) * 100)}%`, background: "var(--color-accent)" }} />
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: "var(--color-neutral-500)" }}>
        <span>Gastado {money(st.spent)}</span>
        {perDay !== null && <span>≈ {money(Math.max(0, perDay))}/día disponible</span>}
      </div>
    </>
  );
}
