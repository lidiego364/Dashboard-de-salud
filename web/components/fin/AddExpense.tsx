"use client";

import { useState } from "react";
import { Dialog, Field } from "@/components/Dialog";
import { useData } from "@/components/DataProvider";
import { todayISO } from "@/lib/dates";
import { txHash } from "@/lib/finance";
import { FIN_CATEGORIES, FIN_CATEGORY_KEYS, type FinCategory } from "@/lib/types";

/** "+ Gasto": efectivo o lo que no está en el banco. */
export function AddExpenseButton() {
  const { create } = useData();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState<FinCategory>("comida");
  const [income, setIncome] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = () => {
    const v = Math.abs(Number(amount.replace(",", ".")));
    if (!(v > 0)) return setErr("Escribe un monto mayor que 0.");
    if (!merchant.trim()) return setErr("¿En qué fue?");
    const signed = income ? v : -v;
    const description = `${merchant.trim()} (a mano)`;
    create("transactions", {
      date,
      amount: signed,
      description,
      merchant: merchant.trim(),
      category: income ? "ingreso" : category,
      source: "manual",
      hash: `${txHash({ date, amount: signed, description })}|${Date.now()}`,
    });
    setOpen(false);
    setAmount("");
    setMerchant("");
    setErr(null);
  };

  return (
    <>
      <button className="btn btn-secondary" onClick={() => setOpen(true)}>
        <i className="ph ph-plus" /> Gasto
      </button>
      {open && (
        <Dialog title={income ? "Anotar ingreso" : "Anotar gasto"} onClose={() => setOpen(false)} onSubmit={save}>
          <div className="field-row">
            <Field label="Monto ($)">
              <input id="exp-amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </Field>
            <Field label="Fecha">
              <input id="exp-date" className="input" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Field label="En qué">
            <input id="exp-merchant" className="input" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Almuerzo en la cafetería" />
          </Field>
          {!income && (
            <Field label="Categoría">
              <select id="exp-category" className="input" value={category} onChange={(e) => setCategory(e.target.value as FinCategory)}>
                {FIN_CATEGORY_KEYS.filter((k) => k !== "ingreso").map((k) => (
                  <option key={k} value={k}>
                    {FIN_CATEGORIES[k].label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 10 }}>
            <input type="checkbox" checked={income} onChange={(e) => setIncome(e.target.checked)} /> Es un ingreso (dinero que entra)
          </label>
          {err && <div role="alert" style={{ fontSize: 13, color: "var(--color-accent-300)", marginTop: 8 }}>{err}</div>}
        </Dialog>
      )}
    </>
  );
}
