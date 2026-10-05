// Convierte respuestas crudas del conector de Garmin en standalone/garmin-snapshot.json
// (la foto que se incrusta en diego-os.html). Uso:
//   node standalone/make-snapshot.mjs <carpeta>
// La carpeta tiene, tal cual las devuelven las herramientas de Garmin:
//   weigh_ins.json ← get_weigh_ins · stats.json ← get_stats_range
//   activities.json ← get_activities_by_date · sleep.json ← get_sleep_summary_range
//   summary.json ← get_user_summary
// La conversión vive en lib/garmin-raw.ts (la misma que usa la página en vivo).
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = process.argv[2];
if (!dir) {
  console.error("Uso: node standalone/make-snapshot.mjs <carpeta>");
  process.exit(1);
}

const bundled = await build({
  entryPoints: [resolve(here, "../lib/garmin-raw.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  tsconfig: resolve(here, "../tsconfig.json"),
});
const { toSnapshot } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

const load = (f) => JSON.parse(readFileSync(join(dir, f), "utf8"));
const snap = toSnapshot({
  weighIns: load("weigh_ins.json"),
  stats: load("stats.json"),
  activities: load("activities.json"),
  sleep: load("sleep.json"),
  summary: load("summary.json"),
});
if (!snap.weights.length) throw new Error("No hay pesajes en weigh_ins.json.");

const out = resolve(here, "garmin-snapshot.json");
writeFileSync(out, JSON.stringify(snap, null, 1));
console.log(`${out}: ${snap.weights.length} pesajes, ${snap.days.length} días, ${snap.sleep.length} noches, ${snap.activities.length} actividades (hoy ${snap.today.date})`);
