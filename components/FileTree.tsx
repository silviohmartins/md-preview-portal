"use client";

import { PanelCollapseIcon } from "@/components/icons";
import { PaneIconButton } from "@/components/PaneIconButton";
import { paneHeaderClass } from "@/components/paneHeader";
import type { FileEntry } from "@/lib/fs";

type FileTreeProps = {
  files: FileEntry[];
  activePath: string | null;
  dirty: boolean;
  folderName: string | null;
  onOpenFile: (path: string) => void;
  onOpenFolder: () => void;
  onCloseFolder?: () => void;
  onCollapse?: () => void;
};

export function FileTree({
  files,
  activePath,
  dirty,
  folderName,
  onOpenFile,
  onOpenFolder,
  onCloseFolder,
  onCollapse,
}: FileTreeProps) {
  return (
    <aside
      className="flex min-h-0 flex-col border-r border-border bg-surface"
      data-testid="file-tree"
    >
      <div className={paneHeaderClass}>
        <span className="truncate text-[11px] font-medium uppercase tracking-wider text-muted">
          {folderName ?? "Arquivos"}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {folderName && onCloseFolder && (
            <button
              type="button"
              onClick={onCloseFolder}
              className="ui-pressable rounded px-1.5 py-0.5 text-[10px] text-muted hover:bg-surface-elevated hover:text-foreground"
              title="Fechar pasta"
              data-testid="close-folder"
            >
              Fechar
            </button>
          )}
          {onCollapse && (
            <PaneIconButton
              onClick={onCollapse}
              data-testid="collapse-file-tree"
              aria-label="Recolher explorador"
              title="Recolher explorador"
            >
              <PanelCollapseIcon />
            </PaneIconButton>
          )}
        </div>
      </div>

      {!folderName ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
          <p className="text-xs text-muted">
            Abra uma pasta local para listar arquivos Markdown.
          </p>
          <button
            type="button"
            onClick={onOpenFolder}
            className="ui-pressable rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-xs text-foreground hover:bg-pane-header"
            data-testid="file-tree-open-folder"
          >
            Abrir pasta
          </button>
        </div>
      ) : files.length === 0 ? (
        <p className="p-3 text-xs text-muted">Nenhum .md nesta pasta.</p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-auto py-1" role="tree">
          {files.map((file) => {
            const active = file.path === activePath;
            const showDirty = active && dirty;
            return (
              <li key={file.path} role="treeitem" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => onOpenFile(file.path)}
                  className={`ui-pressable flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs ${
                    active
                      ? "bg-pane-header text-foreground"
                      : "text-muted hover:bg-pane-header/60 hover:text-foreground"
                  }`}
                  title={file.path}
                  data-testid={`file-tree-item-${file.path}`}
                >
                  <span className="min-w-0 flex-1 truncate">{file.path}</span>
                  {showDirty && (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                      aria-label="Alterações não salvas"
                      title="Não salvo"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
