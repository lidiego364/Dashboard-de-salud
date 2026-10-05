"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useData } from "./DataProvider";
import { getBrowserClient } from "@/lib/supabase/client";
import { longToday } from "@/lib/dates";
import { useHealth } from "./useHealth";

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

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportBackup()], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `diego-os-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (confirm("Esto reemplaza todos tus datos actuales por los del respaldo. ¿Continuar?")) await importBackup(await file.text());
    if (fileRef.current) fileRef.current.value = "";
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
        top: 0,
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
          {mode === "demo" ? (
            <>
              {health?.live && (
                <span className="tag tag-neutral" style={{ gap: 6 }} title="Datos de Garmin incluidos al generar este archivo">
                  <i className="ph ph-watch" />
                  Garmin · {health.view.syncedLabel}
                </span>
              )}
              <span className="tag tag-accent" style={{ gap: 6 }} title="Tus tareas se guardan solo en este navegador">
                <i className={standalone ? "ph ph-hard-drives" : "ph ph-flask"} />
                {standalone ? "Local" : "Modo demo"}
              </span>
              <button className="btn btn-secondary btn-icon" aria-label="Descargar respaldo" title="Descargar respaldo (.json)" onClick={download}>
                <i className="ph ph-download-simple" style={{ fontSize: 16 }} />
              </button>
              <button className="btn btn-secondary btn-icon" aria-label="Importar respaldo" title="Importar respaldo (.json)" onClick={() => fileRef.current?.click()}>
                <i className="ph ph-upload-simple" style={{ fontSize: 16 }} />
              </button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => upload(e.target.files?.[0])} />
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
