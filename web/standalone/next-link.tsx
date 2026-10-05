// Reemplazo de next/link para la versión de un solo archivo: rutas con "#".
import type { AnchorHTMLAttributes } from "react";

export default function Link({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={`#${href}`} {...rest} />;
}
