"use client";

import { useEffect, useState } from "react";
import { getZelleState, subscribeZelle, type ZelleState } from "@/lib/finance-live";

export function useZelle(): ZelleState {
  const [s, setS] = useState<ZelleState>(getZelleState);
  useEffect(() => {
    setS(getZelleState());
    const off = subscribeZelle(setS);
    return () => {
      off();
    };
  }, []);
  return s;
}
