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
import { ErrorBoundary } from "./ErrorBoundary";
import { diag, startDiag } from "./diag";

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
  useEffect(() => {
    void diag("rendered", path);
    try {
      window.scrollTo(0, 0);
    } catch (e) {
      void diag("scroll-error", (e as Error).message);
    }
  }, [path]);
  return (
    <DataProvider>
      <div className="app-bg">
        <ErrorBoundary resetKey={path}>
          <Header />
        </ErrorBoundary>
        <main style={{ maxWidth: 1320, margin: "0 auto", padding: "28px 24px 64px" }}>
          <ErrorBoundary resetKey={path}>
            <Page />
          </ErrorBoundary>
        </main>
      </div>
    </DataProvider>
  );
}

void startDiag();
createRoot(document.getElementById("root")!).render(<App />);
