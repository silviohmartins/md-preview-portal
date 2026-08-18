"use client";

import { useRef } from "react";
import { Dialog } from "@/components/Dialog";
import { Toolbar } from "@/components/Toolbar";
import { useTheme } from "@/components/ThemeProvider";
import type { SaveStatus } from "@/hooks/useWorkspace";

type DocumentActionsProps = {
  activePath: string | null;
  canExport: boolean;
  canSave: boolean;
  clearDisabled: boolean;
  exporting: boolean;
  folderName: string | null;
  mobileOpen: boolean;
  onClear: () => void;
  onCloseMobile: () => void;
  onExport: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onShowFiles: () => void;
  onToggleScrollSync: () => void;
  saveStatus: SaveStatus;
  saving: boolean;
  scrollSyncDisabled: boolean;
  scrollSyncEnabled: boolean;
};

export function DocumentActions({
  activePath,
  canExport,
  canSave,
  clearDisabled,
  exporting,
  folderName,
  mobileOpen,
  onClear,
  onCloseMobile,
  onExport,
  onOpenFolder,
  onSave,
  onShowFiles,
  onToggleScrollSync,
  saveStatus,
  saving,
  scrollSyncDisabled,
  scrollSyncEnabled,
}: DocumentActionsProps) {
  return (
    <>
      <Toolbar
        onClear={onClear}
        clearDisabled={clearDisabled}
        scrollSyncEnabled={scrollSyncEnabled}
        scrollSyncDisabled={scrollSyncDisabled}
        onToggleScrollSync={onToggleScrollSync}
        onOpenFolder={onOpenFolder}
        onShowFiles={onShowFiles}
        onSave={onSave}
        onExport={onExport}
        canSave={canSave}
        canExport={canExport}
        exporting={exporting}
        saving={saving}
        activePath={activePath}
        folderName={folderName}
        saveStatus={saveStatus}
      />
      {mobileOpen && (
        <MobileDocumentActions
          open
          onClose={onCloseMobile}
          onExport={onExport}
          canExport={canExport && !exporting}
          onOpenFolder={onOpenFolder}
          onToggleSync={onToggleScrollSync}
          syncEnabled={scrollSyncEnabled}
          syncDisabled={scrollSyncDisabled}
          onClear={onClear}
          clearDisabled={clearDisabled}
        />
      )}
    </>
  );
}

function MobileDocumentActions({
  open,
  onClose,
  onExport,
  canExport,
  onOpenFolder,
  onToggleSync,
  syncEnabled,
  syncDisabled,
  onClear,
  clearDisabled,
}: {
  open: boolean;
  onClose: () => void;
  onExport: () => void;
  canExport: boolean;
  onOpenFolder: () => void;
  onToggleSync: () => void;
  syncEnabled: boolean;
  syncDisabled: boolean;
  onClear: () => void;
  clearDisabled: boolean;
}) {
  const { mode, toggleMode } = useTheme();
  const closeRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      ariaLabelledBy="mobile-commands-title"
      initialFocusRef={closeRef}
      backdropClassName="items-end justify-center p-0"
      className="mobile-sheet w-full rounded-t-2xl border border-border bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl"
    >
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
      <div className="flex items-center justify-between">
        <h2 id="mobile-commands-title" className="text-sm font-semibold">Mais ações</h2>
        <button ref={closeRef} type="button" className="ui-pressable min-h-10 rounded-lg px-3 text-xs text-muted" onClick={onClose}>Fechar</button>
      </div>
      <div className="mt-3 grid gap-2">
        <button type="button" className="sheet-command" disabled={!canExport} onClick={onExport}>Exportar preview em PDF <span>PDF</span></button>
        <button type="button" className="sheet-command" onClick={onOpenFolder}>Abrir ou trocar pasta <span>Local</span></button>
        <button type="button" className="sheet-command" onClick={toggleMode}>Alternar tema <span>{mode === "dark" ? "Escuro" : "Claro"}</span></button>
        <button type="button" className="sheet-command" disabled={syncDisabled} onClick={onToggleSync}>Sincronizar scroll <span>{syncEnabled ? "Ligado" : "Desligado"}</span></button>
        <button type="button" className="sheet-command text-error" disabled={clearDisabled} onClick={onClear}>Limpar rascunho <span>Destrutivo</span></button>
      </div>
    </Dialog>
  );
}
