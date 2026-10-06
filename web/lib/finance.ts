// Finanzas: importar movimientos (CSV de Wells Fargo o genérico, PDF vía Claude),
// limpiar comercios, evitar duplicados, Zelle desde las alertas de Gmail y los
// números del mes. Todos los regex son ASCII: el texto se normaliza antes
// (sin acentos) porque la página debe ser solo ASCII.
import { daysBetween, todayISO } from "./dates";
import { FIN_CATEGORY_KEYS, type FinCategory, type FinRule, type Transaction } from "./types";

const ACCENTS = new RegExp("[\\u0300-\\u036f]", "g");
export const plain = (s: string) => s.normalize("NFD").replace(ACCENTS, "");

// ── CSV ──────────────────────────────────────────────────────────────────

/** CSV con comillas ("a, b") y comillas escapadas (""). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") row.push(cell), (cell = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}

/** "10/01/2026", "2026-10-01", "10/1/26" → "2026-10-01" (o null). */
export function toISODate(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return null;
}

/** "$1,234.56", "(24.80)", "-24.80" → número (o null). */
export function toAmount(s: string): number | null {
  const t = s.replace(/[$\s,]/g, "");
  if (!t) return null;
  const neg = /^\(.*\)$/.test(t);
  const n = Number(t.replace(/[()]/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round((neg ? -Math.abs(n) : n) * 100) / 100;
}

export type RawTx = { date: string; amount: number; description: string };

/** Lee un CSV de banco. Wells Fargo: sin encabezado, 5 columnas
 *  ("10/01/2026","-24.80","*","","PURCHASE AUTHORIZED ON 09/30 UBER *EATS …").
 *  Genérico: encabezado con fecha, descripción y monto (o débito/crédito). */
export function parseBankCsv(text: string): { rows: RawTx[]; format: "wellsfargo" | "generic" } {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error("El archivo está vacío.");
  const looksWF = rows.slice(0, 5).every((r) => r.length >= 5 && toISODate(r[0]) && toAmount(r[1]) !== null);
  if (looksWF) {
    return {
      format: "wellsfargo",
      rows: rows.filter((r) => toISODate(r[0]) && toAmount(r[1]) !== null).map((r) => ({ date: toISODate(r[0])!, amount: toAmount(r[1])!, description: r[4] || r[3] || r[2] })),
    };
  }
  const head = rows[0].map((h) => plain(h).toLowerCase());
  const col = (...names: string[]) => head.findIndex((h) => names.some((n) => h.includes(n)));
  const iDate = col("date", "fecha");
  const iDesc = col("description", "descripcion", "merchant", "payee", "detalle", "name");
  const iAmt = col("amount", "monto", "importe");
  const iDebit = col("debit", "debito", "cargo", "withdrawal");
  const iCredit = col("credit", "credito", "abono", "deposit");
  if (iDate < 0 || iDesc < 0 || (iAmt < 0 && iDebit < 0)) {
    throw new Error("No reconozco las columnas de este CSV. Necesito fecha, descripción y monto (o débito/crédito).");
  }
  const out: RawTx[] = [];
  for (const r of rows.slice(1)) {
    const date = toISODate(r[iDate] ?? "");
    if (!date) continue;
    let amount: number | null;
    if (iAmt >= 0) amount = toAmount(r[iAmt] ?? "");
    else {
      const d = toAmount(r[iDebit] ?? "") ?? 0;
      const c = iCredit >= 0 ? toAmount(r[iCredit] ?? "") ?? 0 : 0;
      amount = c - Math.abs(d);
    }
    if (amount === null || amount === 0) continue;
    out.push({ date, amount, description: r[iDesc] ?? "" });
  }
  return { format: "generic", rows: out };
}

// ── Comercios ────────────────────────────────────────────────────────────

/** Quita el ruido típico del banco: "PURCHASE AUTHORIZED ON 09/30", tarjeta, referencias. */
export function cleanMerchant(desc: string): string {
  let s = plain(desc).toUpperCase();
  s = s.replace(/\b(PURCHASE|RECURRING PAYMENT|PAYMENT|POS PURCHASE|DEBIT CARD PURCHASE)( RETURN)? AUTHORIZED ON \d{2}\/\d{2}\b/g, " ");
  s = s.replace(/\bON \d{2}\/\d{2}\b/g, " ");
  s = s.replace(/\b[SP]\d{9,}\b/g, " ").replace(/\bCARD \d{4}\b/g, " ");
  s = s.replace(/\bREF ?#?\s*[A-Z0-9]+\b/g, " ").replace(/\b(CONF|CONFIRMATION)#?\s*[A-Z0-9]+\b/g, " ");
  s = s.replace(/\*/g, " ").replace(/#\s*\d+/g, " ").replace(/\b\d{5,}\b/g, " ");
  s = s.replace(/\s{2,}/g, " ").trim();
  const z = s.match(/^ZELLE (FROM|TO) (.+)$/);
  if (z) return `Zelle ${z[1] === "FROM" ? "de" : "a"} ${z[2].toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}`;
  return s || plain(desc).trim();
}

/** Clave de comercio para recordar correcciones ("UBER EATS" ← "UBER *EATS HELP.UBER.COM CA"). */
export function merchantKey(merchant: string) {
  const w = plain(merchant).toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !/^\d+$/.test(w));
  // Cada persona de Zelle es su propio "comercio" (corregir una no cambia las demás).
  return w.slice(0, w[0] === "ZELLE" ? 4 : 2).join(" ");
}

export function txHash(t: RawTx) {
  return `${t.date}|${t.amount.toFixed(2)}|${plain(t.description).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 60)}`;
}

/** Categoría sin preguntarle a Claude: primero tus correcciones; luego reglas obvias. */
export function quickCategory(t: RawTx, merchant: string, rules: FinRule[]): FinCategory | null {
  const key = merchantKey(merchant);
  const rule = rules.find((r) => r.merchant_key === key);
  if (rule) return rule.category;
  const d = plain(t.description).toUpperCase();
  if (/\bZELLE\b|\bEXPRESSSEND\b|\bTRANSFER\b|\bVENMO\b|\bCASH APP\b/.test(d)) return t.amount > 0 ? "ingreso" : "transferencias";
  if (t.amount > 0 && /\b(PAYROLL|DIRECT DEP|DEPOSIT|REFUND|INTEREST)\b/.test(d)) return "ingreso";
  return null;
}

// ── Zelle desde las alertas de Wells Fargo en Gmail ──────────────────────

export type ZelleTx = { date: string; amount: number; who: string; id: string };

/** Alertas "Usted envió $30.00 a FRANK PINERO Fecha: 09/26/2026", "X le envió $35.00 …",
 *  "Está enviando $500.00 a Christopher Li … Fecha de envío: 09/20/2026" (y en inglés). */
export function parseZelleAlert(snippet: string, id: string): ZelleTx | null {
  const s = plain(snippet).replace(/^Pagina principal de Wells Fargo\s*/i, "").replace(/\s+/g, " ");
  const date = (txt: string) => {
    const m = txt.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
  };
  let m = s.match(/(?:Usted envio|Esta enviando|You sent|You're sending) \$([\d,]+\.\d{2}) (?:a|to) (.+?) (?:Fecha|Date|Vea|See)/i);
  if (m) {
    const d = date(s);
    return d ? { id, date: d, amount: -Number(m[1].replace(/,/g, "")), who: m[2].trim() } : null;
  }
  m = s.match(/^(.+?) (?:le envio|sent you) \$([\d,]+\.\d{2})/i);
  if (m) {
    const d = date(s);
    return d ? { id, date: d, amount: Number(m[2].replace(/,/g, "")), who: m[1].trim() } : null;
  }
  return null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function zelleFromGmail(payload: any): ZelleTx[] {
  const out: ZelleTx[] = [];
  for (const th of payload?.threads ?? []) for (const msg of th.messages ?? []) {
    const z = parseZelleAlert(String(msg.snippet ?? ""), String(msg.id ?? th.id));
    if (z) out.push(z);
  }
  return out;
}

// ── Números del mes ──────────────────────────────────────────────────────

export const monthOf = (iso: string) => iso.slice(0, 7);
export function prevMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
const daysInMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/** Lo que cuenta como gasto: salidas que no son ingresos. */
export const isSpend = (t: Pick<Transaction, "amount" | "category">) => t.amount < 0 && t.category !== "ingreso";

export function monthStats(txs: Pick<Transaction, "date" | "amount" | "category">[], ym: string, today = todayISO()) {
  const inMonth = txs.filter((t) => monthOf(t.date) === ym);
  const spent = -inMonth.filter(isSpend).reduce((a, t) => a + t.amount, 0);
  const income = inMonth.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
  const byCat = new Map<FinCategory, number>();
  for (const t of inMonth.filter(isSpend)) byCat.set(t.category, (byCat.get(t.category) ?? 0) - t.amount);
  // Mismo punto del mes anterior (para comparar justo a mitad de mes).
  const isCurrent = ym === monthOf(today);
  const dayOfMonth = isCurrent ? Number(today.slice(8, 10)) : daysInMonth(ym);
  const prev = prevMonth(ym);
  const prevSameDay = -txs
    .filter((t) => monthOf(t.date) === prev && Number(t.date.slice(8, 10)) <= dayOfMonth && isSpend(t))
    .reduce((a, t) => a + t.amount, 0);
  const daysLeft = isCurrent ? daysInMonth(ym) - dayOfMonth + 1 : 0;
  return { ym, spent, income, byCat, prevSameDay, dayOfMonth, daysLeft, count: inMonth.length };
}

/** Pagos que se repiten cada mes (suscripciones): mismo comercio, monto parecido, ~30 días. */
export function recurring(txs: Transaction[], today = todayISO()) {
  const groups = new Map<string, Transaction[]>();
  for (const t of txs.filter(isSpend)) {
    const k = merchantKey(t.merchant);
    if (!k) continue;
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const out: { merchant: string; amount: number; last: string; months: number; category: FinCategory }[] = [];
  for (const list of groups.values()) {
    const s = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const months = new Set(s.map((t) => monthOf(t.date))).size;
    if (months < 2) continue;
    const amounts = s.map((t) => -t.amount);
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const similar = amounts.every((a) => Math.abs(a - avg) <= Math.max(2, avg * 0.15));
    const gaps = s.slice(1).map((t, i) => daysBetween(s[i].date, t.date));
    const monthly = gaps.length > 0 && gaps.every((g) => g >= 25 && g <= 35);
    const last = s.at(-1)!;
    if (similar && monthly && daysBetween(last.date, today) <= 40) out.push({ merchant: last.merchant, amount: Math.round(avg * 100) / 100, last: last.date, months, category: last.category });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

export function lastImported(txs: Transaction[]) {
  const imported = txs.filter((t) => t.source !== "manual").map((t) => t.date).sort();
  return imported.at(-1) ?? null;
}

// ── Instrucciones para Claude ────────────────────────────────────────────

const CAT_LIST = FIN_CATEGORY_KEYS.filter((k) => k !== "ingreso").join(", ");

export function categorizePrompt(items: { i: number; desc: string; amount: number }[]) {
  return `Clasifica movimientos de la cuenta bancaria de un estudiante en Miami.

Responde SOLO con un JSON array, un objeto por movimiento y en el mismo orden:
[{"i": 0, "merchant": "Uber Eats", "category": "comida"}]

- "merchant": nombre corto y legible del comercio o persona (ej. "Uber Eats", "Publix", "FIU Bookstore", "Zelle a Frank Pinero").
- "category": una de: ${CAT_LIST}, o "ingreso" si el monto es positivo y es dinero que entra.
  comida = restaurantes, cafés y delivery; super = supermercado; servicios = renta, luz, internet, teléfono, seguros;
  salud = gym, farmacia, médico; transferencias = Zelle/Venmo/transferencias entre personas o cuentas.

Movimientos:
${JSON.stringify(items)}`;
}

export function parseCategorized(raw: unknown, n: number): { merchant: string; category: FinCategory }[] {
  if (!Array.isArray(raw)) throw new Error("Claude no devolvió la lista de categorías.");
  const out: { merchant: string; category: FinCategory }[] = Array.from({ length: n }, () => ({ merchant: "", category: "otros" }));
  for (const r of raw as { i?: unknown; merchant?: unknown; category?: unknown }[]) {
    const i = Number(r?.i);
    if (!(i >= 0 && i < n)) continue;
    const cat = String(r?.category ?? "") as FinCategory;
    out[i] = { merchant: String(r?.merchant ?? "").trim().slice(0, 60), category: FIN_CATEGORY_KEYS.includes(cat) ? cat : "otros" };
  }
  return out;
}

export function statementPrompt(text: string) {
  return `Extrae TODOS los movimientos de este estado de cuenta bancario (texto sacado de un PDF).

Responde SOLO con un JSON array: [{"date": "2026-09-30", "amount": -24.80, "description": "UBER *EATS"}]
- "date": fecha del movimiento en formato YYYY-MM-DD (el año está en el encabezado del estado de cuenta).
- "amount": negativo para cargos, compras, pagos y retiros; positivo para depósitos y abonos.
- "description": la descripción tal como aparece.
- No incluyas saldos, totales ni resúmenes. Si no es un estado de cuenta, responde [].

Texto:
"""
${text.slice(0, 120_000)}
"""`;
}

export function parseStatement(raw: unknown): RawTx[] {
  if (!Array.isArray(raw)) throw new Error("Claude no devolvió la lista de movimientos.");
  return (raw as { date?: unknown; amount?: unknown; description?: unknown }[])
    .map((r) => ({ date: toISODate(String(r?.date ?? "")) ?? "", amount: Number(r?.amount), description: String(r?.description ?? "").trim() }))
    .filter((r) => r.date && Number.isFinite(r.amount) && r.amount !== 0 && r.description)
    .map((r) => ({ ...r, amount: Math.round(r.amount * 100) / 100 }));
}

/** Días desde la última importación (para recordar que toca importar). */
export function staleDays(txs: Transaction[], today = todayISO()) {
  const last = lastImported(txs);
  return last ? daysBetween(last, today) : null;
}

// ── Vista combinada ──────────────────────────────────────────────────────

/** Movimiento para mostrar: los guardados + los Zelle de Gmail (sin guardar). */
export type ViewTx = Omit<Transaction, "source"> & { source: Transaction["source"] | "gmail" };

/** Suma los Zelle de Gmail posteriores al último estado importado (los anteriores ya
 *  vienen en el estado de cuenta) y que no estén ya guardados con la misma fecha y monto. */
export function withZelle(txs: Transaction[], zelle: ZelleTx[]): ViewTx[] {
  const last = lastImported(txs);
  const extra: ViewTx[] = zelle
    .filter((z) => !last || z.date > last)
    .filter((z) => !txs.some((t) => t.date === z.date && Math.abs(t.amount - z.amount) < 0.005))
    .map((z) => ({
      id: `gmail:${z.id}`,
      date: z.date,
      amount: z.amount,
      description: `Zelle ${z.amount < 0 ? "a" : "de"} ${z.who}`,
      merchant: `Zelle ${z.amount < 0 ? "a" : "de"} ${z.who}`,
      category: z.amount < 0 ? "transferencias" : "ingreso",
      source: "gmail",
      hash: `gmail:${z.id}`,
      created_at: z.date,
    }));
  return [...txs, ...extra].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
}

/** Gasto por categoría en el mes y en el mes anterior hasta el mismo día. */
export function categoryDeltas(txs: Pick<Transaction, "date" | "amount" | "category">[], ym: string, today = todayISO()) {
  const cur = monthStats(txs, ym, today);
  const prev = prevMonth(ym);
  const prevBy = new Map<FinCategory, number>();
  for (const t of txs) {
    if (monthOf(t.date) !== prev || Number(t.date.slice(8, 10)) > cur.dayOfMonth || !isSpend(t)) continue;
    prevBy.set(t.category, (prevBy.get(t.category) ?? 0) - t.amount);
  }
  const keys = new Set<FinCategory>([...cur.byCat.keys(), ...prevBy.keys()]);
  return [...keys]
    .map((k) => ({ category: k, amount: cur.byCat.get(k) ?? 0, prev: prevBy.get(k) ?? 0 }))
    .filter((x) => x.amount > 0 || x.prev > 0)
    .sort((a, b) => b.amount - a.amount);
}
