"use client";

import { useTheme } from "@/components/ThemeProvider";

type ToolbarProps = {
  onClear: () => void;
};

export function Toolbar({ onClear }: ToolbarProps) {
  const { mode, toggleMode } = useTheme();

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
      <h1 className="text-sm font-semibold tracking-tight">mdPreviewPortal</h1>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleMode}
          className="rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1 text-xs text-[var(--foreground)] transition hover:bg-[var(--pane-header)]"
          aria-label="Alternar tema"
        >
          Tema: {mode === "dark" ? "Escuro" : "Claro"}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1 text-xs text-[var(--foreground)] transition hover:bg-[var(--pane-header)]"
        >
          Limpar
        </button>
      </div>
    </header>
  );
}
