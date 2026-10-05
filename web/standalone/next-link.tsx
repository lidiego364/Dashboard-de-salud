// Reemplazo de next/link para la versión de un solo archivo: rutas con "#".
import type { AnchorHTMLAttributes } from "react";
import { toHash } from "./next-navigation";

export default function Link({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={toHash(href)} {...rest} />;
}
