"use client";

import { useEffect, useRef, useState } from "react";
import { useData } from "@/components/DataProvider";
import { explainSampleError, getCapability, type Sample } from "@/lib/claude-runtime";
import { categorizePrompt, cleanMerchant, parseBankCsv, parseCategorized, parseStatement, quickCategory, statementPrompt, txHash, type RawTx } from "@/lib/finance";
import { pdfText } from "@/lib/pdf";
import type { FinCategory, NewRow } from "@/lib/types";

const BATCH = 80;

/** "Importar estado de cuenta": CSV de Wells Fargo (o genérico) o PDF del estado. */
export function ImportButton() {
  const { transactions, fin_rules, create } = useData();
  const [sample, setSample] = useState<Sample | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    getCapability("sample").then(setSample);
  }, []);

  const run = async (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    setMsg(null);
    try {
      // 1) Leer movimientos.
      let raw: RawTx[];
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      if (isPdf) {
        if (!sample) throw new Error("Para leer un PDF necesito Claude: abre Diego OS dentro de claude.ai, o importa el CSV.");
        setStatus("Leyendo el PDF…");
        const text = await pdfText(file, 120_000);
        setStatus("Claude está sacando los movimientos del estado de cuenta…");
        raw = parseStatement(await sample.json(statementPrompt(text), { modelTier: "default" }));
      } else {
        raw = parseBankCsv(await file.text()).rows;
      }
      if (!raw.length) throw new Error("No encontré movimientos en ese archivo.");

      // 2) Sin duplicados (ni con lo ya importado ni dentro del archivo).
      const seen = new Set(transactions.map((t) => t.hash));
      const fresh: (RawTx & { hash: string })[] = [];
      for (const r of raw) {
        const hash = txHash(r);
        if (!seen.has(hash)) seen.add(hash), fresh.push({ ...r, hash });
      }
      const dupes = raw.length - fresh.length;

      // 3) Categoría: tus correcciones y reglas obvias primero; el resto, Claude.
      const out: NewRow<"transactions">[] = fresh.map((r) => {
        const merchant = cleanMerchant(r.description);
        return { date: r.date, amount: r.amount, description: r.description, merchant, category: quickCategory(r, merchant, fin_rules) ?? ("" as FinCategory), source: isPdf ? "pdf" : "csv", hash: r.hash };
      });
      const pending = out.map((t, i) => ({ t, i })).filter(({ t }) => !t.category);
      if (pending.length && sample) {
        for (let b = 0; b < pending.length; b += BATCH) {
          const chunk = pending.slice(b, b + BATCH);
          setStatus(`Claude está clasificando ${b + 1}–${b + chunk.length} de ${pending.length}…`);
          const res = parseCategorized(await sample.json(categorizePrompt(chunk.map(({ t }, j) => ({ i: j, desc: t.description, amount: t.amount }))), { modelTier: "quick" }), chunk.length);
          chunk.forEach(({ i }, j) => {
            out[i].category = out[i].amount > 0 && res[j].category !== "ingreso" ? "ingreso" : res[j].category;
            if (res[j].merchant) out[i].merchant = res[j].merchant;
          });
        }
      }
      for (const t of out) if (!t.category) t.category = t.amount > 0 ? "ingreso" : "otros";

      // 4) Guardar (uno a la vez).
      for (let i = 0; i < out.length; i++) {
        if (i % 10 === 0) setStatus(`Guardando ${i + 1} de ${out.length}…`);
        await create("transactions", out[i]);
      }
      if (!out.length) return setMsg({ ok: true, text: `Nada nuevo: los ${dupes} movimientos de ese archivo ya estaban importados.` });
      setMsg({ ok: true, text: `Importé ${out.length} movimientos${dupes ? ` (${dupes} ya estaban)` : ""}.${!sample && pending.length ? " Sin Claude quedaron en “Otros”: corrígelos tocando la categoría." : ""}` });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setMsg({ ok: false, text: (code ? explainSampleError(e) : (e as Error).message) ?? "Importación cancelada." });
    } finally {
      setStatus(null);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
      {status && <span style={{ fontSize: 13, color: "var(--color-neutral-400)" }}>{status}</span>}
      {msg && (
        <span role={msg.ok ? "status" : "alert"} style={{ fontSize: 13, color: msg.ok ? "var(--color-neutral-400)" : "var(--color-accent-300)" }}>
          {msg.text}
        </span>
      )}
      <button className="btn btn-primary" disabled={!!status} onClick={() => input.current?.click()}>
        <i className="ph ph-file-csv" style={{ fontSize: 16 }} />
        Importar estado de cuenta
      </button>
      <input ref={input} id="statement-input" type="file" hidden accept=".csv,text/csv,.pdf,application/pdf" onChange={(e) => run(e.target.files?.[0])} />
    </div>
  );
}
