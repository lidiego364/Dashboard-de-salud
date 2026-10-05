// Reemplazo de next/navigation para la versión de un solo archivo.
// Las pestañas cambian en memoria, sin navegar: en claude.ai la página vive en
// un marco aislado. El hash (#uni, #salud…) solo se LEE al abrir, para poder
// abrir una pestaña directo con un link.
// NUNCA se escribe la URL: en el visor de claude.ai (la página corre en su
// propio dominio dentro de un marco) reescribirla con history.replaceState
// dejaba la pantalla en blanco.
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
