// Reemplazo de next/navigation para la versión de un solo archivo.
// Las pestañas cambian en memoria, sin navegar: en claude.ai la página vive en
// un marco aislado y un enlace "#uni" saca al marco de la página (pantalla en
// blanco). El hash (#uni, #salud…) solo se lee al abrir y se actualiza cuando
// el navegador lo permite, para poder abrir una pestaña directo con un link.
import { useEffect, useState } from "react";

const fromHash = () => {
  try {
    const token = location.hash.slice(1).replace(/^\//, "");
    return !token || token === "hoy" ? "/" : `/${token}`;
  } catch {
    return "/";
  }
};
export const toHash = (href: string) => `#${href === "/" ? "hoy" : href.replace(/^\//, "")}`;

let current = typeof window === "undefined" ? "/" : fromHash();
const listeners = new Set<(p: string) => void>();

export function navigate(href: string) {
  current = href;
  listeners.forEach((fn) => fn(href));
  try {
    // En el marco de claude.ai esto puede fallar (otro origen): no importa.
    history.replaceState(null, "", toHash(href));
  } catch {}
}

export function usePathname() {
  const [path, setPath] = useState(current);
  useEffect(() => {
    listeners.add(setPath);
    // Archivo local: los botones atrás/adelante del navegador cambian el hash.
    const onHash = () => {
      current = fromHash();
      listeners.forEach((fn) => fn(current));
    };
    window.addEventListener("hashchange", onHash);
    setPath(current);
    return () => {
      listeners.delete(setPath);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);
  return path;
}

export function useRouter() {
  return {
    push: navigate,
    replace: navigate,
    refresh: () => {},
  };
}
