"use client";

import { useTheme } from "@/components/ThemeProvider";

type ToolbarProps = {
  onClear: () => void;
};

export function Toolbar({ onClear }: ToolbarProps) {
  const { mode, toggleMode } = useTheme();

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-4 py-2.5">
      <h1 className="text-sm font-semibold tracking-tight">mdPreviewPortal</h1>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleMode}
          className="rounded-md border border-border bg-surface-elevated px-3 py-1 text-xs text-foreground transition hover:bg-pane-header"
          aria-label="Alternar tema"
        >
          Tema: {mode === "dark" ? "Escuro" : "Claro"}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md border border-border bg-surface-elevated px-3 py-1 text-xs text-foreground transition hover:bg-pane-header"
        >
          Limpar
        </button>
      </div>
    </header>
  );
}
