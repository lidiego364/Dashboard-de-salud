// Reemplazo de next/link para la versión de un solo archivo: un BOTÓN, no un
// enlace. En claude.ai la página vive en un marco y el visor puede interceptar
// los clics en enlaces antes que nuestro código (y sacar al marco de la página).
// Un botón cambia la pestaña en memoria sin que nadie lo trate como navegación.
import type { CSSProperties, ReactNode } from "react";
import { navigate } from "./next-navigation";

type Props = {
  href: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
  children?: ReactNode;
  "aria-current"?: "page" | undefined;
  "aria-label"?: string;
};

export default function Link({ href, className, style, children, ...rest }: Props) {
  return (
    <button type="button" className={className} style={{ textAlign: "left", ...style }} onClick={() => navigate(href)} {...rest}>
      {children}
    </button>
  );
}
