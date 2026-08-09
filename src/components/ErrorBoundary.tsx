import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  props: Props;
  state: State = {
    hasError: false,
    error: null,
  };

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught Error caught by ErrorBoundary:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearCacheAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn("Erro ao limpar dados locais:", e);
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#040406] text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-zinc-900/90 border border-red-500/30 rounded-2xl p-6 shadow-2xl backdrop-blur-xl text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle size={32} />
            </div>
            
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">Ops! Ocorreu um erro na aplicação</h2>
              <p className="text-xs text-zinc-400">
                O aplicativo encontrou uma exceção inesperada ao renderizar a interface.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800 text-left overflow-auto max-h-32">
                <code className="text-xs text-red-300 font-mono break-words">
                  {this.state.error?.message || String(this.state.error)}
                </code>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-cyan-950/50"
              >
                <RotateCcw size={16} />
                <span>Recarregar Aplicação</span>
              </button>

              <button
                onClick={this.handleClearCacheAndReload}
                className="w-full py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer border border-zinc-700"
              >
                <Trash2 size={14} />
                <span>Restaurar Dados Locais e Recarregar</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
