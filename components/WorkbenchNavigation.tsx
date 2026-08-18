"use client";

import { FolderIcon, MoreIcon, SaveIcon } from "@/components/icons";
import type { WorkbenchViewMode } from "@/hooks/useWorkbenchLayout";

type ViewModeTabsProps = {
  mode: WorkbenchViewMode;
  canSplit: boolean;
  onChange: (mode: WorkbenchViewMode) => void;
};

export function ViewModeTabs({ mode, canSplit, onChange }: ViewModeTabsProps) {
  return (
    <nav className="view-mode-tabs shrink-0 border-b border-border bg-surface px-3 py-2 lg:hidden" aria-label="Modo de visualização">
      <div className="mx-auto grid max-w-md grid-cols-2 rounded-lg bg-background p-1 data-[split=true]:grid-cols-3" data-split={canSplit}>
        <ViewTab active={mode === "editor"} onClick={() => onChange("editor")}>Editor</ViewTab>
        <ViewTab active={mode === "preview"} onClick={() => onChange("preview")}>Preview</ViewTab>
        {canSplit && <ViewTab active={mode === "split"} onClick={() => onChange("split")}>Dividido</ViewTab>}
      </div>
    </nav>
  );
}

function ViewTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" className="ui-pressable min-h-10 rounded-md px-3 text-xs font-medium text-muted hover:text-foreground aria-pressed:bg-surface-elevated aria-pressed:text-foreground aria-pressed:shadow-sm" aria-pressed={active} onClick={onClick}>{children}</button>
  );
}

type MobileDockProps = {
  onFiles: () => void;
  onSave: () => void;
  onMore: () => void;
  canSave: boolean;
  saving: boolean;
};

export function MobileDock({ onFiles, onSave, onMore, canSave, saving }: MobileDockProps) {
  return (
    <nav className="mobile-dock shrink-0 border-t border-border bg-surface" aria-label="Ações do documento">
      <button type="button" onClick={onFiles} className="mobile-dock-action"><FolderIcon /><span>Arquivos</span></button>
      <button type="button" onClick={onSave} disabled={!canSave || saving} className="mobile-dock-action" data-testid="save-file-mobile"><SaveIcon /><span>{saving ? "Salvando…" : "Salvar"}</span></button>
      <button type="button" onClick={onMore} className="mobile-dock-action"><MoreIcon /><span>Mais</span></button>
    </nav>
  );
}
