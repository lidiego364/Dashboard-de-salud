// Reemplazo de next/link: cambia de pestaña en memoria (ver next-navigation.ts).
import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { navigate, toHash } from "./next-navigation";

export default function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    e.preventDefault();
    navigate(href);
  };
  return <a href={toHash(href)} onClick={go} {...rest} />;
}
