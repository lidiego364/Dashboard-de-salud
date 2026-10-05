// Si una pestaña falla al dibujarse, muestra el error en vez de dejar la
// pantalla en blanco (React desmonta todo ante un error no atrapado).
import { Component, type ReactNode } from "react";
import { navigate } from "./next-navigation";

type State = { error: Error | null };

export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: { resetKey: string }) {
    // Al cambiar de pestaña se vuelve a intentar.
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <section className="card elev-sm" role="alert" style={{ padding: "18px 20px", gap: 10 }}>
        <div className="card-title">Esta pestaña tuvo un error</div>
        <div style={{ fontSize: 14, color: "var(--color-neutral-400)" }}>
          El resto de Diego OS sigue funcionando. Si me cuentas este mensaje lo puedo arreglar:
        </div>
        <pre style={{ margin: 0, padding: "10px 12px", borderRadius: "var(--radius-md)", background: "var(--color-neutral-900)", fontSize: 12, whiteSpace: "pre-wrap", overflowWrap: "anywhere", userSelect: "text" }}>
          {`${error.name}: ${error.message}\n${(error.stack ?? "").split("\n").slice(1, 4).join("\n")}`}
        </pre>
        <div>
          <button type="button" className="btn btn-secondary" onClick={() => navigate("/")}>
            Volver a Hoy
          </button>
        </div>
      </section>
    );
  }
}
