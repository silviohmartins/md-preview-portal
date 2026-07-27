"use client";

import { PanelExpandIcon } from "@/components/icons";
import { PaneIconButton } from "@/components/PaneIconButton";
import { paneHeaderClass } from "@/components/paneHeader";

type FileTreeCollapsedProps = {
  onExpand: () => void;
};

export function FileTreeCollapsed({ onExpand }: FileTreeCollapsedProps) {
  return (
    <aside
      className="flex min-h-0 w-10 flex-col border-r border-border bg-surface"
      data-testid="file-tree-collapsed"
    >
      <div className={`${paneHeaderClass} justify-center px-1`}>
        <PaneIconButton
          onClick={onExpand}
          data-testid="expand-file-tree"
          aria-label="Expandir explorador"
          title="Expandir explorador"
        >
          <PanelExpandIcon />
        </PaneIconButton>
      </div>
    </aside>
  );
}
