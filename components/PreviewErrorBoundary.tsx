"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type PreviewErrorBoundaryProps = {
  children: ReactNode;
  /** When this changes, a previous render error is cleared. */
  resetKey?: string;
  fallback?: (error: Error, reset: () => void) => ReactNode;
};

type PreviewErrorBoundaryState = {
  error: Error | null;
};

export class PreviewErrorBoundary extends Component<
  PreviewErrorBoundaryProps,
  PreviewErrorBoundaryState
> {
  state: PreviewErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PreviewErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prevProps: PreviewErrorBoundaryProps): void {
    if (
      this.state.error &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Falha ao renderizar o preview:", error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) {
        return this.props.fallback(error, this.reset);
      }
      return (
        <div className="p-4 text-sm text-red-600 dark:text-red-400">
          <p className="font-medium">Erro ao renderizar</p>
          <p className="mt-1 text-muted">{error.message}</p>
          <button
            type="button"
            onClick={this.reset}
            className="ui-pressable mt-3 rounded-md border border-border bg-surface-elevated px-3 py-1 text-xs text-foreground hover:bg-pane-header"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
