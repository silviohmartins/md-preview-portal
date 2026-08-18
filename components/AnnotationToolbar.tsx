"use client";

import { useRef, useState, type ReactNode } from "react";
import { Dialog } from "@/components/Dialog";
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
import { ANNOTATION_COLORS, ANNOTATION_WIDTHS } from "@/lib/annotations/types";

type AnnotationToolbarProps = { store: AnnotationStore };

function ToolButton({ label, children, ...props }: React.ComponentProps<typeof PaneIconButton> & { label: string; children: ReactNode }) {
  return (
    <PaneIconButton {...props} aria-label={label} title={label}>
      {children}
      <span className="annotation-tool-caption">{label}</span>
    </PaneIconButton>
  );
}

export function AnnotationToolbar({ store }: AnnotationToolbarProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [openPopover, setOpenPopover] = useState<"color" | "width" | null>(
    null,
  );
  const cancelClearRef = useRef<HTMLButtonElement>(null);
  const {
    mode, setMode, tool, setTool, color, setColor, width, setWidth,
    undo, redo, clear, canUndo, canRedo, strokes,
  } = store;
  const drawing = mode === "draw";

  return (
    <>
      <div
        className="annotation-toolbar"
        data-testid="annotation-toolbar"
        role="toolbar"
        aria-label="Ferramentas de anotação"
        onKeyDown={(event) => {
          if (event.key !== "Escape" || openPopover === null) return;
          event.preventDefault();
          event.stopPropagation();
          setOpenPopover(null);
        }}
      >
        <div className="annotation-tool-group" role="group" aria-label="Modo">
          <ToolButton data-testid="annotation-mode-navigate" aria-pressed={!drawing} label="Mão" onClick={() => setMode("navigate")}><HandIcon /></ToolButton>
          <ToolButton data-testid="annotation-mode-draw" aria-pressed={drawing} label="Desenhar" onClick={() => setMode("draw")}><PenIcon /></ToolButton>
        </div>
        <div className="annotation-tool-group" role="group" aria-label="Instrumento">
          <ToolButton disabled={!drawing} data-testid="annotation-tool-pen" aria-pressed={tool === "pen"} label="Caneta" onClick={() => setTool("pen")}><PenIcon /></ToolButton>
          <ToolButton disabled={!drawing} data-testid="annotation-tool-highlighter" aria-pressed={tool === "highlighter"} label="Marca" onClick={() => setTool("highlighter")}><HighlighterIcon /></ToolButton>
          <ToolButton disabled={!drawing} data-testid="annotation-tool-eraser" aria-pressed={tool === "eraser"} label="Borracha" onClick={() => setTool("eraser")}><EraserIcon /></ToolButton>
        </div>

        <div className="annotation-popover relative" data-testid="annotation-color-popover">
          <button
            type="button"
            className="annotation-summary ui-pressable"
            aria-label="Escolher cor"
            aria-expanded={openPopover === "color"}
            aria-controls="annotation-colors"
            onClick={() =>
              setOpenPopover((current) =>
                current === "color" ? null : "color",
              )
            }
          >
            <span className="h-4 w-4 rounded-full border border-white/30" style={{ backgroundColor: color }} aria-hidden="true" />
            <span>Cor</span>
          </button>
          {openPopover === "color" && <div id="annotation-colors" className="annotation-popover-panel" role="group" aria-label="Cores">
            {ANNOTATION_COLORS.map((candidate) => (
              <button key={candidate} type="button" disabled={!drawing || tool === "eraser"} data-testid={`annotation-color-${candidate.slice(1)}`} aria-label={`Cor ${candidate}`} aria-pressed={color === candidate} className="ui-pressable h-9 w-9 rounded-full border border-border disabled:opacity-40 aria-pressed:ring-2 aria-pressed:ring-connection" style={{ backgroundColor: candidate }} onClick={() => { setColor(candidate); setOpenPopover(null); }} />
            ))}
          </div>}
        </div>

        <div className="annotation-popover relative" data-testid="annotation-width-popover">
          <button
            type="button"
            className="annotation-summary ui-pressable"
            aria-label="Escolher espessura"
            aria-expanded={openPopover === "width"}
            aria-controls="annotation-widths"
            onClick={() =>
              setOpenPopover((current) =>
                current === "width" ? null : "width",
              )
            }
          ><span className="w-4 rounded-full bg-current" style={{ height: width }} aria-hidden="true" /><span>Traço</span></button>
          {openPopover === "width" && <div id="annotation-widths" className="annotation-popover-panel" role="group" aria-label="Espessuras">
            {ANNOTATION_WIDTHS.map((candidate) => (
              <PaneIconButton key={candidate} disabled={!drawing || tool === "eraser"} data-testid={`annotation-width-${candidate}`} aria-pressed={width === candidate} aria-label={`Espessura ${candidate}`} onClick={() => { setWidth(candidate); setOpenPopover(null); }}>
                <span className="block w-5 rounded-full bg-current" style={{ height: candidate }} aria-hidden="true" />
              </PaneIconButton>
            ))}
          </div>}
        </div>

        <div className="annotation-tool-group" role="group" aria-label="Histórico">
          <ToolButton disabled={!canUndo} data-testid="annotation-undo" label="Desfazer" onClick={undo}><UndoIcon /></ToolButton>
          <ToolButton disabled={!canRedo} data-testid="annotation-redo" label="Refazer" onClick={redo}><RedoIcon /></ToolButton>
        </div>
        <ToolButton className="annotation-clear" disabled={strokes.length === 0} data-testid="annotation-clear" label="Limpar" onClick={() => setConfirmClear(true)}><ClearInkIcon /></ToolButton>
      </div>

      <Dialog open={confirmClear} onClose={() => setConfirmClear(false)} ariaLabelledBy="annotation-clear-title" initialFocusRef={cancelClearRef} className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-2xl">
        <h2 id="annotation-clear-title" className="text-sm font-semibold">Limpar todas as anotações?</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">Esta ação remove todos os traços deste documento. Você ainda poderá desfazer enquanto o preview permanecer aberto.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelClearRef} type="button" className="ui-pressable min-h-10 rounded-lg px-3 text-xs text-muted hover:bg-pane-header" onClick={() => setConfirmClear(false)}>Cancelar</button>
          <button type="button" className="ui-pressable min-h-10 rounded-lg bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-700" onClick={() => { clear(); setConfirmClear(false); }}>Limpar anotações</button>
        </div>
      </Dialog>
    </>
  );
}
