"use client";

import { useEffect, useState } from "react";
import { healthView } from "@/lib/health";
import { getHealthState, subscribeHealth, type HealthState } from "@/lib/health-live";

/** Vista de salud compartida por toda la página. Se calcula en el cliente
 *  (depende de "hoy", de la foto incrustada y, en claude.ai, de Garmin en vivo). */
export function useHealth() {
  const [hs, setHs] = useState<HealthState | null>(null);
  useEffect(() => {
    setHs(getHealthState());
    const off = subscribeHealth(setHs);
    return () => {
      off();
    };
  }, []);
  if (!hs) return null;
  const view = hs.snap ? healthView(hs.snap) : null;
  return {
    /** null = todavía no hay pesajes reales (nunca se muestran números inventados). */
    view,
    live: view !== null,
    source: hs.source,
    loading: hs.loading,
    error: hs.error,
    /** Sin pesajes y sin lectura en curso: se explica por qué. */
    unavailable: view === null && !hs.loading,
    reason: hs.error ?? "Todavía no hay pesajes de Garmin. Abre Diego OS en claude.ai para leerlos.",
  };
}
