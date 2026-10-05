"use client";

import { useEffect, useState } from "react";
import { getCalendarState, subscribeCalendar, type CalendarState } from "@/lib/calendar";

/** Eventos de Google Calendar compartidos por toda la página (solo en claude.ai). */
export function useCalendar(): CalendarState {
  const [s, setS] = useState<CalendarState>(getCalendarState);
  useEffect(() => {
    setS(getCalendarState());
    const off = subscribeCalendar(setS);
    return () => {
      off();
    };
  }, []);
  return s;
}
