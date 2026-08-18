"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { PanelCollapseIcon } from "@/components/icons";
import { PaneIconButton } from "@/components/PaneIconButton";
import { paneHeaderClass } from "@/components/paneHeader";
import type { FileEntry } from "@/lib/fs";

const FILE_TREE_VIRTUALIZATION_THRESHOLD = 100;
const FILE_TREE_ROW_HEIGHT = 40;
const FILE_TREE_OVERSCAN = 6;

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(320);
  const [pendingFocusIndex, setPendingFocusIndex] = useState<number | null>(
    null,
  );
  const activeFileIndex = files.findIndex((file) => file.path === activePath);
  const [rovingFocusIndex, setRovingFocusIndex] = useState(() =>
    Math.max(0, activeFileIndex),
  );
  const virtualized = files.length > FILE_TREE_VIRTUALIZATION_THRESHOLD;

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const updateHeight = () => {
      if (element.clientHeight > 0) setViewportHeight(element.clientHeight);
    };
    updateHeight();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, [folderName, virtualized]);

  useEffect(() => {
    setRovingFocusIndex((currentIndex) =>
      activeFileIndex >= 0
        ? activeFileIndex
        : Math.min(currentIndex, Math.max(0, files.length - 1)),
    );
  }, [activeFileIndex, files.length]);

  useEffect(() => {
    if (!virtualized || !activePath) return;
    const element = scrollRef.current;
    if (activeFileIndex < 0 || !element) return;
    const rowTop = activeFileIndex * FILE_TREE_ROW_HEIGHT;
    const rowBottom = rowTop + FILE_TREE_ROW_HEIGHT;
    if (rowTop < element.scrollTop) element.scrollTop = rowTop;
    else if (rowBottom > element.scrollTop + viewportHeight) {
      element.scrollTop = rowBottom - viewportHeight;
    }
    setScrollTop(element.scrollTop);
  }, [activeFileIndex, activePath, files, viewportHeight, virtualized]);

  const startIndex = virtualized
    ? Math.max(
        0,
        Math.floor(scrollTop / FILE_TREE_ROW_HEIGHT) - FILE_TREE_OVERSCAN,
      )
    : 0;
  const endIndex = virtualized
    ? Math.min(
        files.length,
        Math.ceil((scrollTop + viewportHeight) / FILE_TREE_ROW_HEIGHT) +
          FILE_TREE_OVERSCAN,
      )
    : files.length;
  const visibleFiles = files.slice(startIndex, endIndex);

  const moveFocus = (index: number) => {
    const nextIndex = Math.max(0, Math.min(files.length - 1, index));
    const element = scrollRef.current;
    if (virtualized && element) {
      const rowTop = nextIndex * FILE_TREE_ROW_HEIGHT;
      const rowBottom = rowTop + FILE_TREE_ROW_HEIGHT;
      let nextScrollTop = element.scrollTop;
      if (rowTop < element.scrollTop) nextScrollTop = rowTop;
      else if (rowBottom > element.scrollTop + viewportHeight) {
        nextScrollTop = rowBottom - viewportHeight;
      }
      element.scrollTop = nextScrollTop;
      setScrollTop(nextScrollTop);
    }
    setRovingFocusIndex(nextIndex);
    setPendingFocusIndex(nextIndex);
  };

  useEffect(() => {
    if (pendingFocusIndex === null) return;
    const button = scrollRef.current?.querySelector<HTMLButtonElement>(
      `[data-file-index="${pendingFocusIndex}"]`,
    );
    if (!button) return;
    button.focus();
    setPendingFocusIndex(null);
  }, [pendingFocusIndex, visibleFiles]);

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
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-auto py-1"
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          data-virtualized={virtualized ? "true" : "false"}
        >
          <ul
            className={virtualized ? "relative" : undefined}
            style={
              virtualized
                ? { height: files.length * FILE_TREE_ROW_HEIGHT }
                : undefined
            }
            role="tree"
            aria-label={`Arquivos Markdown em ${folderName}`}
          >
            {visibleFiles.map((file, visibleIndex) => {
              const index = startIndex + visibleIndex;
              return (
                <FileTreeItem
                  key={file.path}
                  file={file}
                  index={index}
                  total={files.length}
                  active={file.path === activePath}
                  dirty={dirty}
                  virtualized={virtualized}
                  focusable={index === rovingFocusIndex}
                  onOpenFile={onOpenFile}
                  onMoveFocus={moveFocus}
                  onFocusIndex={setRovingFocusIndex}
                />
              );
            })}
          </ul>
        </div>
      )}
    </aside>
  );
}

type FileTreeItemProps = {
  file: FileEntry;
  index: number;
  total: number;
  active: boolean;
  dirty: boolean;
  virtualized: boolean;
  focusable: boolean;
  onOpenFile: (path: string) => void;
  onMoveFocus: (index: number) => void;
  onFocusIndex: (index: number) => void;
};

function FileTreeItem({
  file,
  index,
  total,
  active,
  dirty,
  virtualized,
  focusable,
  onOpenFile,
  onMoveFocus,
  onFocusIndex,
}: FileTreeItemProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") nextIndex = index + 1;
    else if (event.key === "ArrowUp") nextIndex = index - 1;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = total - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    onMoveFocus(nextIndex);
  };

  return (
    <li
      role="none"
      className={virtualized ? "absolute left-0 right-0" : undefined}
      style={
        virtualized
          ? {
              height: FILE_TREE_ROW_HEIGHT,
              transform: `translateY(${index * FILE_TREE_ROW_HEIGHT}px)`,
            }
          : undefined
      }
    >
      <button
        type="button"
        role="treeitem"
        aria-selected={active}
        aria-posinset={index + 1}
        aria-setsize={total}
        tabIndex={focusable ? 0 : -1}
        onClick={() => onOpenFile(file.path)}
        onKeyDown={handleKeyDown}
        onFocus={() => onFocusIndex(index)}
        className={`ui-pressable flex h-10 w-full items-center gap-1.5 px-3 text-left text-xs ${
          active
            ? "bg-pane-header text-foreground"
            : "text-muted hover:bg-pane-header/60 hover:text-foreground"
        }`}
        title={file.path}
        data-testid={`file-tree-item-${file.path}`}
        data-file-index={index}
      >
        <span className="min-w-0 flex-1 truncate">{file.path}</span>
        {active && dirty && (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
            aria-label="Alterações não salvas"
            title="Não salvo"
          />
        )}
      </button>
    </li>
  );
}
