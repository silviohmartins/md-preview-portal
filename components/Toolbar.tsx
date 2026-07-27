"use client";

import { useTheme } from "@/components/ThemeProvider";

const toolbarButtonClass =
  "ui-pressable rounded-md border border-border bg-surface-elevated px-3 py-1 text-xs text-foreground hover:bg-pane-header disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:border-foreground/40 aria-pressed:bg-pane-header";

type ToolbarProps = {
  onClear: () => void;
  clearDisabled?: boolean;
  scrollSyncEnabled?: boolean;
  scrollSyncDisabled?: boolean;
  onToggleScrollSync?: () => void;
  onOpenFolder?: () => void;
  onSave?: () => void;
  canSave?: boolean;
  saving?: boolean;
};

export function Toolbar({
  onClear,
  clearDisabled = false,
  scrollSyncEnabled = false,
  scrollSyncDisabled = false,
  onToggleScrollSync,
  onOpenFolder,
  onSave,
  canSave = false,
  saving = false,
}: ToolbarProps) {
  const { mode, toggleMode } = useTheme();

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-4 py-2.5">
      <h1 className="text-sm font-semibold tracking-tight">mdstudio.io</h1>
      <div className="flex items-center gap-2">
        {onOpenFolder && (
          <button
            type="button"
            onClick={onOpenFolder}
            className={toolbarButtonClass}
            data-testid="open-folder"
            title="Abrir pasta local"
          >
            Abrir pasta
          </button>
        )}
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave || saving}
            className={toolbarButtonClass}
            data-testid="save-file"
            title="Salvar (Ctrl+S)"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        )}
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
          disabled={clearDisabled}
          className={toolbarButtonClass}
        >
          Limpar
        </button>
      </div>
    </header>
  );
}
