"use client";

import { useState } from "react";
import { Card } from "@/components/Cards";
import { useData } from "@/components/DataProvider";
import { CourseEditor } from "./CourseEditor";
import type { Course } from "@/lib/types";

export function CoursesCard({ calendarNames }: { calendarNames: string[] }) {
  const { courses } = useData();
  const [edit, setEdit] = useState<Course | null>(null);
  const list = [...courses].sort((a, b) => a.code.localeCompare(b.code));
  const missing = calendarNames.filter((n) => !courses.some((c) => c.calendar_name === n || c.name.toLowerCase() === n.toLowerCase()));
  return (
    <Card>
      <div className="card-kicker">Cursos</div>
      {list.map((c) => (
        <button key={c.id} className="row-btn" style={{ alignItems: "center", gap: 10, fontSize: 14 }} onClick={() => setEdit(c)} title="Editar curso, partes de la nota y nota actual">
          <span style={{ flex: 1, minWidth: 0 }}>
            <span>{c.code}</span> <span style={{ color: "var(--color-neutral-500)" }}>· {c.name}</span>
          </span>
          <span style={{ fontSize: 13, color: c.grade ? "var(--color-neutral-300)" : "var(--color-neutral-600)" }}>{c.grade ?? "nota —"}</span>
        </button>
      ))}
      {!list.length && <div className="empty">Sube el syllabus de cada curso y aparecen aquí.</div>}
      {missing.length > 0 && (
        <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
          En tu calendario hay entregas de {missing.length === 1 ? "un curso" : `${missing.length} cursos`} sin syllabus: {missing.join(", ")}.
        </div>
      )}
      {edit && <CourseEditor course={edit} calendarNames={calendarNames} onClose={() => setEdit(null)} />}
    </Card>
  );
}
