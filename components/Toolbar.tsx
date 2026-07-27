"use client";

import { useTheme } from "@/components/ThemeProvider";

const toolbarButtonClass =
  "ui-pressable rounded-md border border-border bg-surface-elevated px-3 py-1 text-xs text-foreground hover:bg-pane-header disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:border-foreground/40 aria-pressed:bg-pane-header";

type ToolbarProps = {
  onClear: () => void;
  scrollSyncEnabled?: boolean;
  scrollSyncDisabled?: boolean;
  onToggleScrollSync?: () => void;
};

export function Toolbar({
  onClear,
  scrollSyncEnabled = false,
  scrollSyncDisabled = false,
  onToggleScrollSync,
}: ToolbarProps) {
  const { mode, toggleMode } = useTheme();

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-4 py-2.5">
      <h1 className="text-sm font-semibold tracking-tight">mdstudio.io</h1>
      <div className="flex items-center gap-2">
        {onToggleScrollSync && (
          <button
            type="button"
            onClick={onToggleScrollSync}
            disabled={scrollSyncDisabled}
            className={toolbarButtonClass}
            aria-pressed={scrollSyncEnabled}
            aria-label={
              scrollSyncEnabled
                ? "Desativar sincronização de scroll"
                : "Ativar sincronização de scroll"
            }
            title={
              scrollSyncDisabled
                ? "Disponível no split (feche o preview expandido)"
                : scrollSyncEnabled
                  ? "Scroll sincronizado (ligado)"
                  : "Sincronizar scroll editor ↔ preview"
            }
            data-testid="scroll-sync-toggle"
          >
            Sync scroll: {scrollSyncEnabled ? "On" : "Off"}
          </button>
        )}
        <button
          type="button"
          onClick={toggleMode}
          className={toolbarButtonClass}
          aria-label="Alternar tema"
        >
          Tema: {mode === "dark" ? "Escuro" : "Claro"}
        </button>
        <button
          type="button"
          onClick={onClear}
          className={toolbarButtonClass}
        >
          Limpar
        </button>
      </div>
    </header>
  );
}
