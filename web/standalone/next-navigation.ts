// Reemplazo de next/navigation basado en el hash de la URL (#/uni, #/salud…).
import { useEffect, useState } from "react";

const current = () => location.hash.slice(1) || "/";

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
    push: (href: string) => (location.hash = href),
    replace: (href: string) => location.replace(`#${href}`),
    refresh: () => {},
  };
}
