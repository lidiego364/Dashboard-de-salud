"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getBrowserClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : error.message);
    router.replace("/");
    router.refresh();
  };

  return (
    <div className="app-bg" style={{ display: "grid", placeItems: "center", padding: 16 }}>
      <form className="card elev-md" onSubmit={submit} style={{ width: "min(380px, 100%)", padding: 24, gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{ width: 28, height: 28, borderRadius: "var(--radius-md)", border: "1px solid var(--color-accent)", display: "grid", placeItems: "center", color: "var(--color-accent)", fontSize: 13, fontWeight: 500 }}
          >
            D
          </div>
          <div style={{ fontSize: 17, fontWeight: 500 }}>Diego OS</div>
        </div>
        {!isSupabaseConfigured ? (
          <div style={{ fontSize: 14, color: "var(--color-neutral-400)" }}>
            Supabase no está configurado, así que la app corre en modo demo sin login.{" "}
            <a href="/">Entrar</a>
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="email">Correo</label>
              <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div role="alert" style={{ fontSize: 13, color: "var(--color-accent-300)" }}>
                {error}
              </div>
            )}
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? "Entrando…" : "Entrar"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
