"use client";

import { useEffect, useState } from "react";
import { getSnapshot, healthView } from "@/lib/health";

/** Vista de salud calculada en el cliente (depende de "hoy" y de window.__GARMIN__). */
export function useHealth() {
  const [state, setState] = useState<{ view: ReturnType<typeof healthView>; live: boolean } | null>(null);
  useEffect(() => {
    const { snap, live } = getSnapshot();
    setState({ view: healthView(snap), live });
  }, []);
  return state;
}
