// Punto de entrada de la versión de un solo archivo (diego-os.html).
// Reutiliza las mismas páginas y componentes de la app Next.js.
import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { DataProvider } from "@/components/DataProvider";
import { Header } from "@/components/Header";
import HoyPage from "@/app/(app)/page";
import UniPage from "@/app/(app)/uni/page";
import SaludPage from "@/app/(app)/salud/page";
import FinanzasPage from "@/app/(app)/finanzas/page";
import TrabajoPage from "@/app/(app)/trabajo/page";
import PersonalPage from "@/app/(app)/personal/page";
import { usePathname } from "next/navigation";

const PAGES: Record<string, () => React.ReactNode> = {
  "/": HoyPage,
  "/uni": UniPage,
  "/salud": SaludPage,
  "/finanzas": FinanzasPage,
  "/trabajo": TrabajoPage,
  "/personal": PersonalPage,
};

function App() {
  const path = usePathname();
  const Page = PAGES[path] ?? HoyPage;
  useEffect(() => window.scrollTo({ top: 0 }), [path]);
  return (
    <DataProvider>
      <div className="app-bg">
        <Header />
        <main style={{ maxWidth: 1320, margin: "0 auto", padding: "28px 24px 64px" }}>
          <Page />
        </main>
      </div>
    </DataProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
