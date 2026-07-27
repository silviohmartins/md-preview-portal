"use client";

import {
  ClearInkIcon,
  EraserIcon,
  HandIcon,
  HighlighterIcon,
  PenIcon,
  RedoIcon,
  UndoIcon,
} from "@/components/icons";
import { PaneIconButton } from "@/components/PaneIconButton";
import type { AnnotationStore } from "@/hooks/useAnnotationStore";
import {
  ANNOTATION_COLORS,
  ANNOTATION_WIDTHS,
} from "@/lib/annotations/types";

type AnnotationToolbarProps = {
  store: AnnotationStore;
};

export function AnnotationToolbar({ store }: AnnotationToolbarProps) {
  const {
    mode,
    setMode,
    tool,
    setTool,
    color,
    setColor,
    width,
    setWidth,
    undo,
    redo,
    clear,
    canUndo,
    canRedo,
    strokes,
  } = store;

  const drawing = mode === "draw";

  return (
    <div
      className="flex flex-wrap items-center gap-1"
      data-testid="annotation-toolbar"
      role="toolbar"
      aria-label="Anotações"
    >
      <PaneIconButton
        data-testid="annotation-mode-navigate"
        aria-pressed={!drawing}
        aria-label="Modo navegar"
        title="Navegar (rolar)"
        onClick={() => setMode("navigate")}
      >
        <HandIcon />
      </PaneIconButton>
      <PaneIconButton
        data-testid="annotation-mode-draw"
        aria-pressed={drawing}
        aria-label="Modo desenhar"
        title="Desenhar"
        onClick={() => setMode("draw")}
      >
        <PenIcon />
      </PaneIconButton>

      <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />

      <PaneIconButton
        disabled={!drawing}
        data-testid="annotation-tool-pen"
        aria-pressed={tool === "pen"}
        aria-label="Caneta"
        title="Caneta"
        onClick={() => setTool("pen")}
      >
        <PenIcon />
      </PaneIconButton>
      <PaneIconButton
        disabled={!drawing}
        data-testid="annotation-tool-highlighter"
        aria-pressed={tool === "highlighter"}
        aria-label="Marcador"
        title="Marcador"
        onClick={() => setTool("highlighter")}
      >
        <HighlighterIcon />
      </PaneIconButton>
      <PaneIconButton
        disabled={!drawing}
        data-testid="annotation-tool-eraser"
        aria-pressed={tool === "eraser"}
        aria-label="Borracha"
        title="Borracha"
        onClick={() => setTool("eraser")}
      >
        <EraserIcon />
      </PaneIconButton>

      <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />

      {ANNOTATION_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          disabled={!drawing || tool === "eraser"}
          data-testid={`annotation-color-${c.slice(1)}`}
          aria-label={`Cor ${c}`}
          aria-pressed={color === c}
          title={c}
          className="ui-pressable h-5 w-5 rounded-full border border-border disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:ring-2 aria-pressed:ring-foreground/50"
          style={{ backgroundColor: c }}
          onClick={() => setColor(c)}
        />
      ))}

      {ANNOTATION_WIDTHS.map((w) => (
        <PaneIconButton
          key={w}
          disabled={!drawing || tool === "eraser"}
          data-testid={`annotation-width-${w}`}
          aria-pressed={width === w}
          aria-label={`Espessura ${w}`}
          title={`Espessura ${w}`}
          onClick={() => setWidth(w)}
        >
          <span
            className="block rounded-full bg-current"
            style={{ width: 10, height: w }}
            aria-hidden="true"
          />
        </PaneIconButton>
      ))}

      <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />

      <PaneIconButton
        disabled={!canUndo}
        data-testid="annotation-undo"
        aria-label="Desfazer"
        title="Desfazer"
        onClick={undo}
      >
        <UndoIcon />
      </PaneIconButton>
      <PaneIconButton
        disabled={!canRedo}
        data-testid="annotation-redo"
        aria-label="Refazer"
        title="Refazer"
        onClick={redo}
      >
        <RedoIcon />
      </PaneIconButton>
      <PaneIconButton
        disabled={strokes.length === 0}
        data-testid="annotation-clear"
        aria-label="Limpar anotações"
        title="Limpar anotações"
        onClick={clear}
      >
        <ClearInkIcon />
      </PaneIconButton>
    </div>
  );
}
