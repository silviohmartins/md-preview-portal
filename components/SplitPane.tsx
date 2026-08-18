"use client";

import { useCallback, useRef, type KeyboardEvent, type PointerEvent, type ReactNode, type Ref } from "react";
import { paneHeaderClass } from "@/components/paneHeader";
import type { WorkbenchViewMode } from "@/hooks/useWorkbenchLayout";

type SplitPaneProps = {
  left: ReactNode;
  right: ReactNode;
  leftLabel?: string;
  rightLabel?: string;
  leftHeaderAction?: ReactNode;
  rightHeaderAction?: ReactNode;
  /** Scroll container of the preview pane (for scroll sync). */
  rightScrollRef?: Ref<HTMLDivElement>;
  ratio?: number;
  onRatioChange?: (ratio: number) => void;
  viewMode?: WorkbenchViewMode;
  scrollSyncEnabled?: boolean;
};

export function SplitPane({
  left,
  right,
  leftLabel = "Editor",
  rightLabel = "Preview",
  leftHeaderAction,
  rightHeaderAction,
  rightScrollRef,
  ratio = 50,
  onRatioChange,
  viewMode = "split",
  scrollSyncEnabled = false,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLElement>(null);
  const setRatioFromPointer = useCallback(
    (clientX: number) => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds || bounds.width === 0) return;
      onRatioChange?.(((clientX - bounds.left) / bounds.width) * 100);
    },
    [onRatioChange],
  );

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!onRatioChange) return;
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setRatioFromPointer(event.clientX);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setRatioFromPointer(event.clientX);
  };

  const handleDividerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onRatioChange) return;
    let next = ratio;
    if (event.key === "ArrowLeft") next -= event.shiftKey ? 10 : 5;
    else if (event.key === "ArrowRight") next += event.shiftKey ? 10 : 5;
    else if (event.key === "Home") next = 35;
    else if (event.key === "End") next = 65;
    else return;
    event.preventDefault();
    onRatioChange(next);
  };

  return (
    <main
      ref={containerRef}
      className="workbench-split grid min-h-0 flex-1"
      data-view-mode={viewMode}
      style={{ gridTemplateColumns: `${ratio}fr var(--divider-hit-size) ${100 - ratio}fr` }}
    >
      <section className="editor-pane flex min-h-0 min-w-0 flex-col" hidden={viewMode === "preview"}>
        <div className={paneHeaderClass}>
          <span className="truncate text-[11px] font-medium uppercase tracking-wider text-muted">
            {leftLabel}
          </span>
          {leftHeaderAction}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{left}</div>
      </section>
      <div
        className="live-divider group relative z-10 flex cursor-col-resize touch-none items-center justify-center bg-transparent outline-none"
        role="separator"
        aria-label="Redimensionar editor e preview"
        aria-orientation="vertical"
        aria-valuemin={25}
        aria-valuemax={75}
        aria-valuenow={Math.round(ratio)}
        tabIndex={viewMode === "split" ? 0 : -1}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onKeyDown={handleDividerKeyDown}
        data-testid="live-divider"
      >
        <span className="h-full w-px bg-connection/70" aria-hidden="true" />
        <span
          className={`absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-background ${
            scrollSyncEnabled ? "bg-connection shadow-[0_0_0_3px_rgb(116_167_255_/_0.18)]" : "bg-muted"
          }`}
          title={scrollSyncEnabled ? "Scroll sincronizado" : "Scroll independente"}
          aria-hidden="true"
        />
        <div className="split-presets absolute left-1/2 top-3 flex -translate-x-1/2 flex-col gap-1 rounded-md border border-border bg-surface p-1 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {[35, 50, 65].map((preset) => (
            <button
              key={preset}
              type="button"
              className="ui-pressable min-h-7 min-w-8 rounded px-1 font-mono text-[9px] text-muted hover:bg-pane-header hover:text-foreground"
              onClick={() => onRatioChange?.(preset)}
              aria-label={`Usar proporção ${preset}/${100 - preset}`}
              aria-pressed={ratio === preset}
            >
              {preset}/{100 - preset}
            </button>
          ))}
        </div>
        <span className="sr-only">
          {scrollSyncEnabled ? "Scroll sincronizado" : "Scroll independente"}
        </span>
      </div>
      <section className="preview-pane flex min-h-0 min-w-0 flex-col" hidden={viewMode === "editor"}>
        <div className={paneHeaderClass}>
          <span className="truncate text-[11px] font-medium uppercase tracking-wider text-muted">
            {rightLabel}
          </span>
          {rightHeaderAction}
        </div>
        <div
          ref={rightScrollRef}
          className="min-h-0 flex-1 overflow-auto"
          data-testid="preview-scroll"
        >
          {right}
        </div>
      </section>
    </main>
  );
}
