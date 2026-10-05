// Reemplazo de next/navigation basado en el hash de la URL (#uni, #salud…).
// Solo tokens simples: claude.ai no deja pasar "/" ni "=" en el hash.
import { useEffect, useState } from "react";

const current = () => {
  const token = location.hash.slice(1).replace(/^\//, "");
  return !token || token === "hoy" ? "/" : `/${token}`;
};
export const toHash = (href: string) => `#${href === "/" ? "hoy" : href.replace(/^\//, "")}`;

export function usePathname() {
  const [path, setPath] = useState(current);
  useEffect(() => {
    const onChange = () => setPath(current());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return path;
}

export function useRouter() {
  return {
    push: (href: string) => (location.hash = toHash(href)),
    replace: (href: string) => location.replace(toHash(href)),
    refresh: () => {},
  };
}
