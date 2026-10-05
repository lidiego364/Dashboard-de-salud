// Genera ../diego-os.html: la app entera en un solo archivo (JS, CSS, fuentes
// e íconos incluidos), sin servidor ni Supabase. Uso: npm run standalone
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "..");
const out = resolve(web, "..", "diego-os.html");

const js = await build({
  entryPoints: [resolve(here, "entry.tsx")],
  bundle: true,
  minify: true,
  write: false,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  tsconfig: resolve(web, "tsconfig.json"),
  alias: {
    "next/link": resolve(here, "next-link.tsx"),
    "next/navigation": resolve(here, "next-navigation.ts"),
    "@supabase/ssr": resolve(here, "supabase-stub.ts"),
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_SUPABASE_URL": '""',
    "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": '""',
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": '""',
    "process.env.NEXT_PUBLIC_STANDALONE": '"1"',
  },
  logLevel: "warning",
});

// Fuentes: solo woff2, incrustadas como data URL.
const mod = (p) => resolve(web, "node_modules", p);
const inlineWoff2 = (cssPath) => {
  const css = readFileSync(cssPath, "utf8");
  return css.replace(/src:[^;]+;/g, (src) => {
    const m = src.match(/url\(["']?([^"')]+\.woff2)["']?\)/);
    if (!m) throw new Error(`Sin woff2 en ${cssPath}`);
    const data = readFileSync(resolve(dirname(cssPath), m[1])).toString("base64");
    return `src: url(data:font/woff2;base64,${data}) format("woff2");`;
  });
};

const css = [
  inlineWoff2(mod("@fontsource/inter/latin-400.css")),
  inlineWoff2(mod("@fontsource/inter/latin-500.css")),
  inlineWoff2(mod("@phosphor-icons/web/src/regular/style.css")),
  inlineWoff2(mod("@phosphor-icons/web/src/fill/style.css")),
  readFileSync(resolve(web, "app/globals.css"), "utf8"),
].join("\n");

const icon = readFileSync(resolve(web, "app/icon.svg"), "utf8");

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#f4f4f2">
<title>Diego OS</title>
<link rel="icon" href="data:image/svg+xml;base64,${Buffer.from(icon).toString("base64")}">
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script")}</script>
</body>
</html>
`;

writeFileSync(out, html);
console.log(`${out} · ${(html.length / 1024).toFixed(0)} KB`);
