import { DataProvider } from "@/components/DataProvider";
import { Header } from "@/components/Header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <div className="app-bg">
        <Header />
        <main style={{ maxWidth: 1320, margin: "0 auto", padding: "28px 24px 64px" }}>{children}</main>
      </div>
    </DataProvider>
  );
}
