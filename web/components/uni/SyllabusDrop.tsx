"use client";

import { useEffect, useRef, useState } from "react";
import { CourseEditor } from "./CourseEditor";
import { explainSampleError, getCapability, type Sample } from "@/lib/claude-runtime";
import { pdfText } from "@/lib/pdf";
import { parseCourseExtraction, syllabusPrompt, type CourseExtraction } from "@/lib/uni";

/** Subir un syllabus (PDF, foto o texto): Claude saca cuánto vale cada parte de la nota. */
export function SyllabusDrop({ calendarNames }: { calendarNames: string[] }) {
  const [sample, setSample] = useState<Sample | null | undefined>(undefined);
  const [acceptsImages, setAcceptsImages] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<CourseExtraction | null>(null);
  const [over, setOver] = useState(false);
  const ctl = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const s = await getCapability("sample");
      setSample(s);
      if (s) setAcceptsImages(!!(await s.limits().catch(() => null))?.images);
    })();
  }, []);

  const read = async (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file || !sample) return;
    setErr(null);
    ctl.current = new AbortController();
    try {
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const isImage = file.type.startsWith("image/");
      let text = "";
      let images: Blob[] | undefined;
      if (isPdf) {
        setStatus("Leyendo el PDF…");
        text = await pdfText(file);
        if (text.replace(/\s/g, "").length < 200) throw new Error("Ese PDF no tiene texto que se pueda leer (¿es un escaneo?). Sube una captura de la parte de evaluación.");
      } else if (isImage) {
        if (!acceptsImages) throw new Error("Esta vista no acepta imágenes. Sube el syllabus en PDF.");
        images = [file];
        text = "(El syllabus va en la imagen adjunta.)";
      } else {
        text = await file.text();
      }
      setStatus("Claude está leyendo el syllabus… (puede tardar hasta un minuto)");
      const raw = await sample.json(syllabusPrompt(text, calendarNames), { signal: ctl.current.signal, images, modelTier: "default" });
      setDraft(parseCourseExtraction(raw, calendarNames));
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setErr(code ? explainSampleError(e) : (e as Error).message);
    } finally {
      setStatus(null);
      ctl.current = null;
    }
  };

  const busy = status !== null;
  return (
    <section
      onDragOver={(e) => {
        e.preventDefault();
        if (sample) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!busy) read(e.dataTransfer.files?.[0]);
      }}
      style={{
        border: `1px dashed ${over ? "var(--color-accent)" : "var(--color-neutral-700)"}`,
        background: over ? "color-mix(in srgb, var(--color-accent) 6%, transparent)" : "transparent",
        borderRadius: "var(--radius-lg)",
        padding: "18px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <i className={busy ? "ph ph-spinner-gap" : "ph ph-file-arrow-up"} style={{ fontSize: 28, color: "var(--color-accent)" }} />
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 15 }}>{status ?? "Arrastra el syllabus de un curso (PDF, captura o texto)"}</div>
        <div style={{ fontSize: 13, color: "var(--color-neutral-500)" }}>
          {sample === null
            ? "Esto funciona en la página de Diego OS dentro de claude.ai."
            : "Claude saca cuánto vale cada parte de la nota; lo revisas antes de guardar. Así sé cuánto pesa cada entrega de Canvas."}
        </div>
        {err && <div role="alert" style={{ fontSize: 13, color: "var(--color-accent-300)", marginTop: 4 }}>{err}</div>}
      </div>
      {busy ? (
        <button className="btn btn-secondary" onClick={() => ctl.current?.abort()}>
          Cancelar
        </button>
      ) : (
        <button className="btn btn-primary" disabled={!sample} onClick={() => input.current?.click()}>
          <i className="ph ph-upload-simple" style={{ fontSize: 16 }} />
          Subir syllabus
        </button>
      )}
      <input ref={input} id="syllabus-input" type="file" hidden accept=".pdf,application/pdf,image/*,.txt,.md,text/plain" onChange={(e) => read(e.target.files?.[0])} />
      {draft && <CourseEditor draft={draft} calendarNames={calendarNames} onClose={() => setDraft(null)} />}
    </section>
  );
}
