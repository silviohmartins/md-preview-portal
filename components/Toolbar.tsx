"use client";

import { useEffect, useRef, useState } from "react";
import { FolderIcon, MenuIcon, MoreIcon, PdfIcon, SaveIcon } from "@/components/icons";
import { useTheme } from "@/components/ThemeProvider";
import type { SaveStatus } from "@/hooks/useWorkspace";

const secondaryButtonClass =
  "ui-pressable inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface-elevated px-3 text-xs font-medium text-foreground hover:border-connection/50 hover:bg-pane-header disabled:cursor-not-allowed disabled:opacity-40";

type ToolbarProps = {
  onClear: () => void;
  clearDisabled?: boolean;
  scrollSyncEnabled?: boolean;
  scrollSyncDisabled?: boolean;
  onToggleScrollSync?: () => void;
  onOpenFolder?: () => void;
  onShowFiles?: () => void;
  onSave?: () => void;
  onExport?: () => void;
  canSave?: boolean;
  canExport?: boolean;
  exporting?: boolean;
  saving?: boolean;
  activePath?: string | null;
  folderName?: string | null;
  saveStatus?: SaveStatus;
};

export function Toolbar({
  onClear,
  clearDisabled = false,
  scrollSyncEnabled = false,
  scrollSyncDisabled = false,
  onToggleScrollSync,
  onOpenFolder,
  onShowFiles,
  onSave,
  onExport,
  canSave = false,
  canExport = false,
  exporting = false,
  saving = false,
  activePath,
  folderName,
  saveStatus = "saved",
}: ToolbarProps) {
  const { mode, toggleMode } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const documentName = activePath?.split("/").at(-1) ?? "Rascunho sem título";
  const statusLabel = {
    saved: "Salvo",
    unsaved: "Não salvo",
    saving: "Salvando…",
    error: "Falha ao salvar",
  }[saveStatus];

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent && menuRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
      if (event instanceof KeyboardEvent) menuButtonRef.current?.focus();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  return (
    <header className="workbench-toolbar relative z-30 flex min-h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 md:px-4">
      {onShowFiles && (
        <button type="button" className={`${secondaryButtonClass} px-2.5 lg:hidden`} onClick={onShowFiles} aria-label="Abrir arquivos">
          <MenuIcon />
        </button>
      )}
      <h1 className="brand-mark hidden shrink-0 text-sm font-semibold tracking-[-0.03em] lg:block">
        mdstudio<span className="text-connection">.io</span>
      </h1>

      <div className="min-w-0 flex-1 border-l-0 border-border lg:border-l lg:pl-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium" title={activePath ?? undefined}>{documentName}</span>
          <span className={`save-state shrink-0 text-[11px] font-medium ${saveStatus === "error" ? "text-error" : saveStatus === "unsaved" ? "text-warning" : "text-muted"}`} data-save-status={saveStatus}>
            <span className="mr-1" aria-hidden="true">●</span>{statusLabel}
          </span>
        </div>
        <p className="hidden truncate font-mono text-[10px] text-muted sm:block">
          {folderName && activePath ? `${folderName} / ${activePath}` : "Rascunho salvo somente neste navegador"}
        </p>
      </div>

      {!folderName && onOpenFolder && (
        <button type="button" onClick={onOpenFolder} className={`${secondaryButtonClass} border-connection bg-connection text-[#07101f] hover:bg-connection-strong max-md:hidden`} data-testid="open-folder" title="Abrir pasta local">
          <FolderIcon /> <span className="hidden sm:inline">Abrir pasta</span>
        </button>
      )}
      {onSave && (
        <button type="button" onClick={onSave} disabled={!canSave || saving} className={`${secondaryButtonClass} max-md:hidden`} data-testid="save-file" title="Salvar (Ctrl+S)">
          <SaveIcon /> {saving ? "Salvando…" : "Salvar"}
        </button>
      )}
      {onExport && (
        <button type="button" onClick={onExport} disabled={!canExport || exporting} className={`${secondaryButtonClass} toolbar-export`} data-testid="toolbar-export">
          <PdfIcon /> {exporting ? "Exportando…" : "Exportar"}
        </button>
      )}

      <div ref={menuRef} className="relative hidden md:block">
        <button ref={menuButtonRef} type="button" className={`${secondaryButtonClass} px-2.5`} aria-label="Mais comandos" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((current) => !current)}>
          <MoreIcon />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 rounded-xl border border-border bg-surface p-1.5 shadow-2xl" role="menu">
            {folderName && onOpenFolder && <button type="button" role="menuitem" onClick={onOpenFolder} className="menu-command">Trocar pasta…</button>}
            {onToggleScrollSync && (
              <button type="button" role="menuitemcheckbox" aria-checked={scrollSyncEnabled} disabled={scrollSyncDisabled} onClick={onToggleScrollSync} className="menu-command" data-testid="scroll-sync-toggle">
                Sync de scroll <span>{scrollSyncEnabled ? "Ligado" : "Desligado"}</span>
              </button>
            )}
            <button type="button" role="menuitem" onClick={toggleMode} className="menu-command">Tema <span>{mode === "dark" ? "Escuro" : "Claro"}</span></button>
            <button type="button" role="menuitem" onClick={onClear} disabled={clearDisabled} className="menu-command text-error">Limpar rascunho</button>
          </div>
        )}
      </div>
    </header>
  );
}
