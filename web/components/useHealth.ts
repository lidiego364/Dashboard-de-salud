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
  return {
    view: healthView(hs.snap),
    live: hs.source !== "demo",
    source: hs.source,
    loading: hs.loading,
    error: hs.error,
    /** Falló la lectura de Garmin y no hay foto: no mostrar números de ejemplo como si fueran reales. */
    unavailable: hs.source === "demo" && hs.error !== null,
  };
}
