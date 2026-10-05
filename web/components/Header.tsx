"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useData } from "./DataProvider";
import { getBrowserClient } from "@/lib/supabase/client";
import { longToday } from "@/lib/dates";
import { useHealth } from "./useHealth";
import { getCapability } from "@/lib/claude-runtime";

export const TABS = [
  { href: "/", label: "Hoy", icon: "ph ph-sun-horizon" },
  { href: "/uni", label: "Universidad", icon: "ph ph-graduation-cap" },
  { href: "/salud", label: "Salud", icon: "ph ph-heartbeat" },
  { href: "/finanzas", label: "Finanzas", icon: "ph ph-wallet" },
  { href: "/trabajo", label: "Trabajo", icon: "ph ph-briefcase" },
  { href: "/personal", label: "Personal", icon: "ph ph-user" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { mode, error, clearError, exportBackup, importBackup } = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const standalone = process.env.NEXT_PUBLIC_STANDALONE === "1";
  const health = useHealth();

  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const download = async () => {
    const filename = `diego-os-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    const data = exportBackup();
    // En claude.ai las descargas pasan por la confirmación del visor.
    const downloads = await getCapability("downloads");
    if (downloads) {
      try {
        await downloads.save({ filename, data });
      } catch (e) {
        const code = (e as { code?: string })?.code;
        if (code !== "declined") setNote("No se pudo descargar el respaldo en esta vista.");
      }
      return;
    }
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const pickFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = "";
    if (file) setPendingImport(await file.text());
  };
  // La fecha depende de la hora del cliente: se pinta después de hidratar.
  const [date, setDate] = useState("");
  useEffect(() => setDate(longToday()), []);

  const logout = async () => {
    await getBrowserClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <header
      style={{
        position: "sticky",
        top: "env(safe-area-inset-top, 0px)",
        zIndex: 5,
        backdropFilter: "blur(12px)",
        background: "color-mix(in srgb, var(--color-bg) 80%, transparent)",
      }}
    >
      <div
        style={{ maxWidth: 1320, margin: "0 auto", padding: "14px 24px 0", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: "auto" }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-accent)",
              display: "grid",
              placeItems: "center",
              color: "var(--color-accent)",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            D
          </div>
          <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.01em" }}>Diego OS</div>
          <div style={{ fontSize: 13, color: "var(--color-neutral-500)", marginLeft: 6 }}>{date}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {health?.live && (
            <span
              className="tag tag-neutral"
              style={{ gap: 6 }}
              title={health.source === "live" ? "Leído de tu Garmin al abrir la página" : "Foto de Garmin incluida al generar este archivo"}
            >
              <i className={health.loading ? "ph ph-arrows-clockwise" : "ph ph-watch"} />
              {health.loading ? "Actualizando Garmin…" : `Garmin · ${health.view.syncedLabel}`}
            </span>
          )}
          {mode !== "supabase" ? (
            <>
              {mode === "claude" ? (
                <span className="tag tag-accent" style={{ gap: 6 }} title="Tus tareas se guardan en esta página y se ven igual en el celular y en la compu">
                  <i className="ph ph-cloud-check" />
                  Sincronizado
                </span>
              ) : (
                <span className="tag tag-accent" style={{ gap: 6 }} title="Tus tareas se guardan solo en este navegador">
                  <i className={standalone ? "ph ph-hard-drives" : "ph ph-flask"} />
                  {standalone ? "Local" : "Modo demo"}
                </span>
              )}
              <button className="btn btn-secondary btn-icon" aria-label="Descargar respaldo" title="Descargar respaldo (.json)" onClick={download}>
                <i className="ph ph-download-simple" style={{ fontSize: 16 }} />
              </button>
              <button className="btn btn-secondary btn-icon" aria-label="Importar respaldo" title="Importar respaldo (.json)" onClick={() => fileRef.current?.click()}>
                <i className="ph ph-upload-simple" style={{ fontSize: 16 }} />
              </button>
              <input ref={fileRef} id="import-backup" type="file" accept="application/json,.json" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
            </>
          ) : (
            <button className="btn btn-secondary btn-icon" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={logout}>
              <i className="ph ph-sign-out" style={{ fontSize: 16 }} />
            </button>
          )}
        </div>
      </div>
      <nav style={{ maxWidth: 1320, margin: "0 auto", padding: "10px 24px 0", display: "flex", gap: 4, overflowX: "auto" }}>
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="tab-link" aria-current={pathname === t.href ? "page" : undefined}>
            <i className={t.icon} style={{ fontSize: 16 }} />
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="hr" style={{ margin: 0 }} />
      {pendingImport !== null && (
        <div role="alertdialog" aria-label="Confirmar importación" style={{ maxWidth: 1320, margin: "8px auto 0", padding: "0 24px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
          <span>Importar el respaldo reemplaza todas tus tareas, objetivos y recordatorios actuales.</span>
          <button
            className="btn btn-secondary btn-danger"
            onClick={async () => {
              const json = pendingImport;
              setPendingImport(null);
              await importBackup(json);
            }}
          >
            Reemplazar
          </button>
          <button className="btn btn-ghost" onClick={() => setPendingImport(null)}>
            Cancelar
          </button>
        </div>
      )}
      {(note || (health?.error && pathname !== "/salud")) && (
        <div role="status" style={{ maxWidth: 1320, margin: "8px auto 0", padding: "0 24px", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--color-neutral-400)" }}>
          <i className="ph ph-info" />
          <span>{note ?? health?.error}</span>
          {note && (
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setNote(null)}>
              Cerrar
            </button>
          )}
        </div>
      )}
      {error && (
        <div
          role="alert"
          style={{ maxWidth: 1320, margin: "8px auto 0", padding: "0 24px", display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}
        >
          <span className="tag tag-outline" style={{ gap: 6 }}>
            <i className="ph ph-warning" /> No se pudo guardar: {error}
          </span>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={clearError}>
            Cerrar
          </button>
        </div>
      )}
    </header>
  );
}
