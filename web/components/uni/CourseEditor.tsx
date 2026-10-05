"use client";

import { useState } from "react";
import { Dialog, Field } from "@/components/Dialog";
import { useData } from "@/components/DataProvider";
import type { Course, GradeComponent } from "@/lib/types";
import type { CourseExtraction } from "@/lib/uni";

type Row = { name: string; pct: string; count: string; keywords: string };
const toRow = (c: GradeComponent): Row => ({ name: c.name, pct: String(c.weight_pct), count: c.count ? String(c.count) : "", keywords: c.keywords.join(", ") });

/** Revisar lo que Claude sacó del syllabus (o editar un curso guardado) antes de guardarlo. */
export function CourseEditor({
  course,
  draft,
  calendarNames,
  onClose,
}: {
  course?: Course;
  draft?: CourseExtraction;
  calendarNames: string[];
  onClose: () => void;
}) {
  const { courses, create, patch, remove } = useData();
  const src = course ?? draft!;
  const [code, setCode] = useState(src.code);
  const [name, setName] = useState(src.name);
  const [calName, setCalName] = useState(src.calendar_name ?? "");
  const [grade, setGrade] = useState(course?.grade ?? "");
  const [rows, setRows] = useState<Row[]>(src.components.length ? src.components.map(toRow) : [{ name: "", pct: "", count: "", keywords: "" }]);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const sum = rows.reduce((a, r) => a + (Number(r.pct.replace(",", ".")) || 0), 0);
  const setRow = (i: number, patchRow: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patchRow } : r)));
  const options = [...new Set([...calendarNames, ...(src.calendar_name ? [src.calendar_name] : [])])];

  const save = () => {
    const components: GradeComponent[] = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        weight_pct: Number(r.pct.replace(",", ".")),
        count: Number(r.count) > 0 ? Math.round(Number(r.count)) : null,
        keywords: r.keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean),
      }));
    if (!code.trim() || !name.trim()) return setErr("Falta el código o el nombre del curso.");
    if (components.some((c) => !(c.weight_pct > 0 && c.weight_pct <= 100))) return setErr("Cada parte necesita un % entre 0 y 100.");
    const row = { code: code.trim(), name: name.trim(), calendar_name: calName || null, components, grade: grade.trim() || null };
    // Un syllabus nuevo de un curso que ya existe lo actualiza en vez de duplicarlo.
    const existing = course ?? courses.find((c) => c.code.replace(/\s/g, "").toUpperCase() === row.code.replace(/\s/g, "").toUpperCase());
    if (existing) patch("courses", existing.id, existing.grade && !course ? { ...row, grade: existing.grade } : row);
    else create("courses", row);
    onClose();
  };

  return (
    <Dialog
      title={course ? `Editar ${course.code}` : "Revisa lo que leí del syllabus"}
      onClose={onClose}
      onSubmit={save}
      actions={
        course &&
        (confirmDel ? (
          <button type="button" className="btn btn-secondary btn-danger" onClick={() => (remove("courses", course.id), onClose())}>
            Sí, quitar curso
          </button>
        ) : (
          <button type="button" className="btn btn-ghost btn-danger" onClick={() => setConfirmDel(true)}>
            <i className="ph ph-trash" /> Quitar
          </button>
        ))
      }
    >
      <div style={{ maxHeight: "65vh", overflowY: "auto", paddingRight: 4 }}>
        <div className="field-row">
          <Field label="Código">
            <input id="course-code" className="input" value={code} onChange={(e) => setCode(e.target.value)} required />
          </Field>
          <Field label="Nota actual (opcional)">
            <input id="course-grade" className="input" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="A− · 91%" />
          </Field>
        </div>
        <Field label="Nombre">
          <input id="course-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Cómo aparece en tu calendario (Canvas)">
          <select id="course-calendar" className="input" value={calName} onChange={(e) => setCalName(e.target.value)}>
            <option value="">— Ninguno / no sé —</option>
            {options.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <div className="field" style={{ marginTop: 12 }}>
          <label>
            Partes de la nota · suman{" "}
            <b style={{ fontWeight: 500, color: Math.abs(sum - 100) > 1 ? "var(--color-accent-300)" : "var(--color-text)" }}>{Math.round(sum * 10) / 10}%</b>
          </label>
          <div className="scroll-x">
            <table className="table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Parte</th>
                  <th style={{ width: 64 }}>%</th>
                  <th style={{ width: 64 }}>Cuántas</th>
                  <th>Palabras en Canvas</th>
                  <th style={{ width: 28 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <input aria-label="Parte" className="input" value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} />
                    </td>
                    <td>
                      <input aria-label="Porcentaje" className="input" inputMode="decimal" value={r.pct} onChange={(e) => setRow(i, { pct: e.target.value })} />
                    </td>
                    <td>
                      <input aria-label="Cuántas entregas" className="input" inputMode="numeric" value={r.count} onChange={(e) => setRow(i, { count: e.target.value })} placeholder="?" />
                    </td>
                    <td>
                      <input aria-label="Palabras clave" className="input" value={r.keywords} onChange={(e) => setRow(i, { keywords: e.target.value })} placeholder="quiz, q" />
                    </td>
                    <td>
                      <button type="button" className="btn btn-ghost btn-icon" aria-label="Quitar parte" style={{ width: 28, height: 28 }} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                        <i className="ph ph-x" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setRows((rs) => [...rs, { name: "", pct: "", count: "", keywords: "" }])}>
            <i className="ph ph-plus" /> Agregar parte
          </button>
        </div>
        <div style={{ fontSize: 12, color: "var(--color-neutral-500)", marginTop: 6 }}>
          “Palabras en Canvas” son las que aparecen en el título de esas entregas en tu calendario (ej. “quiz, q” para “Q6 - ISM 4210”). Con eso sé cuánto vale cada entrega.
        </div>
        {err && <div role="alert" style={{ fontSize: 13, color: "var(--color-accent-300)", marginTop: 8 }}>{err}</div>}
      </div>
    </Dialog>
  );
}
