import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  erro: boolean;
}

// Captura erros de renderização e mostra um ecrã amigável em vez de página em branco.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { erro: false };

  static getDerivedStateFromError(): State {
    return { erro: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("Erro na aplicação:", error, info);
  }

  render() {
    if (!this.state.erro) return this.props.children;

    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="cartao w-full p-8">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-red-500/15 text-red-400">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 8v5M12 16.5h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-slate-100">Algo correu mal</h1>
          <p className="mt-2 text-sm text-slate-400">
            Ocorreu um erro inesperado. Tenta recarregar — os teus dados estão guardados.
          </p>
          <button className="botao-primario mt-5 w-full" onClick={() => location.reload()}>
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
