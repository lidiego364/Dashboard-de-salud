"use client";

import { useEffect, useState } from "react";
import { Dialog, Field } from "@/components/Dialog";
import { inClaude } from "@/lib/claude-runtime";
import { logWeight } from "@/lib/health-live";

/** "Registrar peso": guarda el pesaje en Garmin Connect (con la hora actual). */
export function WeightLogButton({ lastKg }: { lastKg: number | null }) {
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => setAvailable(inClaude()), []);

  return (
    <>
      {done && <span style={{ fontSize: 13, color: "var(--color-neutral-400)" }}>{done}</span>}
      <button
        className="btn btn-primary"
        disabled={!available}
        title={available ? "Se guarda en Garmin Connect" : "Disponible en la página de Diego OS dentro de claude.ai"}
        onClick={() => (setDone(null), setOpen(true))}
      >
        <i className="ph ph-plus" style={{ fontSize: 15 }} />
        Registrar peso
      </button>
      {open && <WeightDialog lastKg={lastKg} onClose={() => setOpen(false)} onDone={(kg) => setDone(`Guardado en Garmin: ${kg} kg`)} />}
    </>
  );
}

function WeightDialog({ lastKg, onClose, onDone }: { lastKg: number | null; onClose: () => void; onDone: (kg: number) => void }) {
  const [kg, setKg] = useState(lastKg ? lastKg.toFixed(1) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (busy) return;
    const v = Math.round(Number(kg.replace(",", ".")) * 10) / 10;
    if (!(v >= 30 && v <= 250)) return setErr("Escribe tu peso en kg (entre 30 y 250).");
    if (lastKg && Math.abs(v - lastKg) > 5 && err !== "confirm-jump") {
      return setErr("confirm-jump");
    }
    setBusy(true);
    setErr(null);
    const res = await logWeight(v);
    setBusy(false);
    if (res.ok) {
      onDone(v);
      onClose();
    } else setErr(res.message);
  };

  return (
    <Dialog title="Registrar peso" onClose={onClose} onSubmit={save}>
      <Field label="Peso de hoy (kg)">
        <input id="weight-kg" className="input" type="number" inputMode="decimal" step="0.1" min="30" max="250" value={kg} onChange={(e) => (setKg(e.target.value), setErr(null))} required disabled={busy} />
      </Field>
      <div style={{ fontSize: 12, color: "var(--color-neutral-500)", marginTop: 8 }}>Se guarda en Garmin Connect con la hora de ahora, como si lo anotaras en la app.</div>
      {err === "confirm-jump" ? (
        <div role="alert" style={{ fontSize: 13, color: "var(--color-accent-300)", marginTop: 8 }}>
          Es más de 5 kg distinto de tu último pesaje ({lastKg} kg). Si está bien, toca Guardar otra vez.
        </div>
      ) : (
        err && <div role="alert" style={{ fontSize: 13, color: "var(--color-accent-300)", marginTop: 8 }}>{err}</div>
      )}
      {busy && <div style={{ fontSize: 13, marginTop: 8 }}>Guardando en Garmin…</div>}
    </Dialog>
  );
}
