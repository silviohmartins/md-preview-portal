import type { ReactNode, RefObject } from "react";
import { ExplorerResizeHandle } from "@/components/ExplorerResizeHandle";
import { FileTree } from "@/components/FileTree";
import { FileTreeCollapsed } from "@/components/FileTreeCollapsed";
import { SplitPane } from "@/components/SplitPane";
import type {
  WorkbenchViewMode,
  WorkbenchViewport,
} from "@/hooks/useWorkbenchLayout";
import type { FileEntry } from "@/lib/fs";

type WorkbenchPanesProps = {
  activePath: string | null;
  dirty: boolean;
  editor: ReactNode;
  explorerCollapsed: boolean;
  explorerWidth: number;
  files: FileEntry[];
  folderName: string | null;
  leftHeaderAction: ReactNode;
  onCloseFolder: () => void;
  onCollapseExplorer: () => void;
  onExpandExplorer: () => void;
  onExplorerWidthChange: (width: number) => void;
  onOpenFile: (path: string) => void;
  onOpenFolder: () => void;
  onSplitRatioChange: (ratio: number) => void;
  preview: ReactNode;
  previewScrollRef: RefObject<HTMLDivElement | null>;
  rightHeaderAction: ReactNode;
  scrollSyncEnabled: boolean;
  splitRatio: number;
  viewMode: WorkbenchViewMode;
  viewport: WorkbenchViewport;
};

export function WorkbenchPanes({
  activePath,
  dirty,
  editor,
  explorerCollapsed,
  explorerWidth,
  files,
  folderName,
  leftHeaderAction,
  onCloseFolder,
  onCollapseExplorer,
  onExpandExplorer,
  onExplorerWidthChange,
  onOpenFile,
  onOpenFolder,
  onSplitRatioChange,
  preview,
  previewScrollRef,
  rightHeaderAction,
  scrollSyncEnabled,
  splitRatio,
  viewMode,
  viewport,
}: WorkbenchPanesProps) {
  return (
    <div
      className="workspace-body grid min-h-0 flex-1"
      style={viewport === "desktop"
        ? {
            gridTemplateColumns: explorerCollapsed
              ? "40px minmax(0, 1fr)"
              : `${explorerWidth}px var(--explorer-divider-hit-size) minmax(0, 1fr)`,
          }
        : { gridTemplateColumns: "minmax(0, 1fr)" }}
    >
      {viewport === "desktop" && (explorerCollapsed
        ? <FileTreeCollapsed onExpand={onExpandExplorer} />
        : <>
            <FileTree
              files={files}
              activePath={activePath}
              dirty={dirty}
              folderName={folderName}
              onOpenFile={onOpenFile}
              onOpenFolder={onOpenFolder}
              onCloseFolder={onCloseFolder}
              onCollapse={onCollapseExplorer}
            />
            <ExplorerResizeHandle width={explorerWidth} onWidthChange={onExplorerWidthChange} />
          </>)}
      <SplitPane
        rightScrollRef={previewScrollRef}
        ratio={splitRatio}
        onRatioChange={onSplitRatioChange}
        viewMode={viewMode}
        scrollSyncEnabled={scrollSyncEnabled}
        leftLabel={activePath ? `Editor · ${activePath}` : "Editor"}
        left={editor}
        right={preview}
        leftHeaderAction={leftHeaderAction}
        rightHeaderAction={rightHeaderAction}
      />
    </div>
  );
}
