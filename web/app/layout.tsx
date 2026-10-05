import type { Metadata, Viewport } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@phosphor-icons/web/regular";
import "@phosphor-icons/web/fill";
import "./globals.css";

export const metadata: Metadata = {
  title: "Diego OS",
  description: "Universidad, salud, finanzas y pendientes en un solo lugar.",
  appleWebApp: { capable: true, title: "Diego OS", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f4f4f2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
