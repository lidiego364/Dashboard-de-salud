"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/Cards";
import { getCapability, type Assets, type Db } from "@/lib/claude-runtime";
import { shortDate, todayISO } from "@/lib/dates";
import { newId } from "@/lib/id";

type Photo = { id: string; date: string; asset_id: string; created_at: string };

/** Reduce a JPEG de hasta 1600 px (pesa menos y quita los datos de ubicación). */
async function toJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.85));
}

/** Fotos de progreso: la imagen va al almacenamiento de la página y su id a la base de datos. */
export function PhotosCard() {
  const [caps, setCaps] = useState<{ db: Db; assets: Assets } | null | undefined>(undefined);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState<Photo | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const [db, assets] = await Promise.all([getCapability("db"), getCapability("assets")]);
      if (!db || !assets) return setCaps(null);
      setCaps({ db, assets });
      try {
        const { docs } = await db.collection("photos").get();
        setPhotos(docs.filter((d) => d.exists).map((d) => ({ ...(d.data() as Omit<Photo, "id">), id: d.id })));
      } catch {
        setMsg("No pude leer tus fotos guardadas.");
      }
    })();
  }, []);

  const add = async (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file || !caps) return;
    setBusy(true);
    setMsg(null);
    try {
      let jpeg: Blob;
      try {
        jpeg = await toJpeg(file);
      } catch {
        throw new Error("No pude leer esa foto. Si es del iPhone (HEIC), envíala como JPG o activa Ajustes → Cámara → Formatos → Más compatible.");
      }
      const up = await caps.assets.upload(jpeg, { type: "image/jpeg" });
      const row = { date: todayISO(), asset_id: up.id, created_at: new Date().toISOString() };
      const id = newId();
      await caps.db.doc(`photos/${id}`).set(row);
      setPhotos((p) => [...p, { ...row, id }]);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setMsg(code === "quota_exceeded" ? "Se llenó el espacio de fotos de la página. Borra alguna antigua." : (e as Error)?.message || "No se pudo subir la foto.");
    } finally {
      setBusy(false);
    }
  };

  const del = async (p: Photo) => {
    if (!caps) return;
    try {
      await caps.db.doc(`photos/${p.id}`).delete();
      setPhotos((list) => list.filter((x) => x.id !== p.id));
      setView(null);
      await caps.assets.delete(p.asset_id).catch(() => {});
    } catch {
      setMsg("No se pudo borrar la foto.");
    }
  };

  const sorted = [...photos].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <Card style={{ gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div className="card-title">Fotos de progreso</div>
        {caps && (
          <button className="btn btn-ghost" style={{ marginLeft: "auto", fontSize: 12 }} onClick={() => input.current?.click()} disabled={busy}>
            <i className="ph ph-camera" />
            {busy ? "Subiendo…" : "Añadir"}
          </button>
        )}
        <input ref={input} id="photo-input" type="file" accept="image/*" hidden onChange={(e) => add(e.target.files?.[0])} />
      </div>
      {caps === null && <div className="empty">Las fotos se guardan en la página de Diego OS dentro de claude.ai.</div>}
      {caps && !sorted.length && <div className="empty">Sube una foto cada 2–4 semanas, con la misma luz y la misma pose: el cambio se ve mejor que en la báscula.</div>}
      {sorted.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {sorted.slice(0, 6).map((p) => (
            <button key={p.id} type="button" onClick={() => (setConfirmDel(false), setView(p))} style={{ display: "flex", flexDirection: "column", gap: 4, background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit", color: "inherit", textAlign: "left" }}>
              <img src={`/_blob/${p.asset_id}`} alt={`Foto del ${shortDate(p.date)}`} style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: "var(--radius-md)", background: "var(--color-neutral-900)" }} />
              <span style={{ fontSize: 11, color: "var(--color-neutral-500)" }}>{shortDate(p.date)}</span>
            </button>
          ))}
        </div>
      )}
      {msg && <div role="alert" style={{ fontSize: 13, color: "var(--color-accent-300)" }}>{msg}</div>}
      {view && (
        <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setView(null)}>
          <div className="dialog" role="dialog" aria-label={`Foto del ${shortDate(view.date)}`} style={{ width: "min(520px, 100%)" }}>
            <div className="dialog-title">Foto del {shortDate(view.date)}</div>
            <img src={`/_blob/${view.asset_id}`} alt="" style={{ width: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: "var(--radius-md)" }} />
            <div className="dialog-actions">
              {confirmDel ? (
                <button className="btn btn-secondary btn-danger" onClick={() => del(view)}>
                  Sí, borrar foto
                </button>
              ) : (
                <button className="btn btn-ghost btn-danger" onClick={() => setConfirmDel(true)}>
                  <i className="ph ph-trash" /> Borrar
                </button>
              )}
              <span style={{ flex: 1 }} />
              <button className="btn btn-secondary" onClick={() => setView(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
