// Texto de un PDF (syllabus) con pdf.js, cargado desde cdnjs solo cuando hace
// falta. El "worker" se carga como <script> normal: la página no puede crear
// workers de otro dominio, y así pdf.js trabaja dentro de la página.
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";

type PdfJs = {
  getDocument(src: { data: ArrayBuffer }): { promise: Promise<PdfDoc> };
};
type PdfDoc = { numPages: number; getPage(n: number): Promise<{ getTextContent(): Promise<{ items: { str?: string; hasEOL?: boolean }[] }> }> };

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(s);
  });
}

let loading: Promise<PdfJs> | null = null;
function pdfjs(): Promise<PdfJs> {
  loading ??= (async () => {
    await loadScript(`${PDFJS}/pdf.min.js`);
    await loadScript(`${PDFJS}/pdf.worker.min.js`);
    const lib = (window as unknown as { pdfjsLib?: PdfJs }).pdfjsLib;
    if (!lib) throw new Error("pdf.js no quedó disponible.");
    return lib;
  })();
  loading.catch(() => (loading = null));
  return loading;
}

/** Texto plano de un PDF, página por página (hasta `maxChars`). */
export async function pdfText(file: Blob, maxChars = 60_000): Promise<string> {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  let out = "";
  for (let n = 1; n <= doc.numPages && out.length < maxChars; n++) {
    const { items } = await (await doc.getPage(n)).getTextContent();
    out += items.map((i) => (i.str ?? "") + (i.hasEOL ? "\n" : " ")).join("") + "\n\n";
  }
  return out.slice(0, maxChars);
}
