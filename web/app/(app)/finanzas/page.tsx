"use client";

import { useState } from "react";
import { AreaTasksCard, Card, Loading, PageTitle } from "@/components/Cards";
import { useData } from "@/components/DataProvider";
import { AddExpenseButton } from "@/components/fin/AddExpense";
import { ByCategory, Insights, Kpis, monthName, Subscriptions, TransactionsTable } from "@/components/fin/Finance";
import { ImportButton } from "@/components/fin/Import";
import { useZelle } from "@/components/useZelle";
import { shortDate, todayISO } from "@/lib/dates";
import { lastImported, monthOf, prevMonth, staleDays, withZelle } from "@/lib/finance";
import type { FinCategory } from "@/lib/types";

const nextMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

// Finanzas: estado de cuenta de Wells Fargo (CSV o PDF) clasificado por Claude,
// los Zelle que llegan a Gmail después del último import y gastos anotados a mano.
export default function FinanzasPage() {
  const { transactions, loading } = useData();
  const zelle = useZelle();
  const current = monthOf(todayISO());
  const [ym, setYm] = useState(current);
  const [filter, setFilter] = useState<FinCategory | null>(null);
  if (loading) return <Loading />;

  const txs = withZelle(transactions, zelle.items);
  const months = new Set(txs.map((t) => monthOf(t.date)));
  const first = [...months].sort()[0] ?? current;
  const last = lastImported(transactions);
  const stale = staleDays(transactions);
  const fromGmail = txs.filter((t) => t.source === "gmail").length;
  const go = (m: string) => (setYm(m), setFilter(null));

  const sub = !transactions.length
    ? "Importa tu estado de cuenta para empezar"
    : [`${transactions.length} movimientos`, last && `importado hasta el ${shortDate(last)}`, fromGmail > 0 && `${fromGmail} ${fromGmail === 1 ? "Zelle nuevo" : "Zelle nuevos"} de Gmail`].filter(Boolean).join(" · ");

  return (
    <>
      <PageTitle title="Finanzas" sub={sub}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
          <AddExpenseButton />
          <ImportButton />
        </div>
      </PageTitle>

      {!transactions.length ? (
        <EmptyState />
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <button className="btn btn-ghost btn-icon" aria-label="Mes anterior" disabled={ym <= first} onClick={() => go(prevMonth(ym))}>
              <i className="ph ph-caret-left" />
            </button>
            <div style={{ fontSize: 15, minWidth: 130, textAlign: "center" }}>
              {monthName(ym)} {ym.slice(0, 4)}
            </div>
            <button className="btn btn-ghost btn-icon" aria-label="Mes siguiente" disabled={ym >= current} onClick={() => go(nextMonth(ym))}>
              <i className="ph ph-caret-right" />
            </button>
            {stale !== null && stale > 10 && ym === current && (
              <span style={{ fontSize: 12, color: "var(--color-accent-300)", marginLeft: 8 }}>
                <i className="ph ph-clock-counter-clockwise" /> El último import es de hace {stale} días: baja el CSV otra vez para ver las compras con tarjeta.
              </span>
            )}
          </div>

          <Kpis txs={txs} ym={ym} />
          <Insights txs={txs} stored={transactions} ym={ym} />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", marginBottom: 16 }}>
            <div style={{ flex: "2 1 520px", minWidth: 0 }}>
              <ByCategory txs={txs} ym={ym} selected={filter} onSelect={setFilter} />
            </div>
            <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
              <Subscriptions stored={transactions} />
              <AreaTasksCard area="fin" title="Pendientes de dinero" compact />
            </div>
          </div>

          <TransactionsTable txs={txs} ym={ym} filter={filter} onClearFilter={() => setFilter(null)} />
        </>
      )}
      <ZelleNote state={zelle} />
    </>
  );
}

function EmptyState() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
      <Card style={{ flex: "2 1 420px", minWidth: 0, gap: 10 }}>
        <div className="card-title">Cómo bajar tus movimientos de Wells Fargo</div>
        <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6, fontSize: 14, lineHeight: 1.45 }}>
          <li>Entra a wellsfargo.com desde la computadora (en la app del celular no se puede).</li>
          <li>Abre tu cuenta y toca <b>Descargar actividad de la cuenta</b> (Download Account Activity).</li>
          <li>Elige las fechas (por ejemplo, los últimos 2 meses) y el formato <b>Separado por comas (CSV)</b>.</li>
          <li>Toca <b>Importar estado de cuenta</b> aquí arriba y elige el archivo. Claude clasifica cada gasto.</li>
        </ol>
        <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
          También sirve el PDF del estado mensual. Si importas el mismo período dos veces no se duplica nada.
        </div>
      </Card>
      <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        <Card style={{ gap: 6 }}>
          <div className="card-kicker">Qué se actualiza solo</div>
          <div style={{ fontSize: 14, lineHeight: 1.45 }}>
            Los Zelle que mandas y recibes: los leo de las alertas de Wells Fargo en tu Gmail. Las compras con tarjeta solo llegan con el CSV, o anótalas a mano con <b>+ Gasto</b>.
          </div>
        </Card>
        <AreaTasksCard area="fin" title="Pendientes de dinero" compact />
      </div>
    </div>
  );
}

function ZelleNote({ state }: { state: ReturnType<typeof useZelle> }) {
  if (!state.available) return null;
  const text = state.loading ? "Leyendo los Zelle de tu Gmail…" : state.error ? state.error : null;
  if (!text) return null;
  return (
    <div style={{ fontSize: 12, color: state.error ? "var(--color-accent-300)" : "var(--color-neutral-500)", marginTop: 12 }}>
      <i className="ph ph-envelope-simple" /> {text}
    </div>
  );
}
