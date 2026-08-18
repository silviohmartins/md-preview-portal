"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { AnnotationLayer } from "@/components/AnnotationLayer";
import { AnnotationToolbar } from "@/components/AnnotationToolbar";
import { Dialog } from "@/components/Dialog";
import { useAnnotationStore } from "@/hooks/useAnnotationStore";

type PreviewOverlayProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  headerAction?: ReactNode;
  documentKey: string;
  legacyDocumentKey?: string;
  documentName?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export function PreviewOverlay({
  open,
  onClose,
  children,
  headerAction,
  documentKey,
  legacyDocumentKey,
  documentName = "Rascunho",
  returnFocusRef,
}: PreviewOverlayProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const store = useAnnotationStore(documentKey, legacyDocumentKey);
  const { mode, setMode, storageError } = store;
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (wasOpenRef.current && !open) setMode("navigate");
    wasOpenRef.current = open;
  }, [open, setMode]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onEscape={() => {
        if (mode !== "draw") return true;
        setMode("navigate");
        return false;
      }}
      ariaLabel="Preview expandido"
      initialFocusRef={closeButtonRef}
      returnFocusRef={returnFocusRef}
      backdropClassName="p-0 md:p-4"
      className="preview-overlay-shell flex h-full w-full min-h-0 flex-col overflow-hidden border-border bg-surface shadow-2xl md:rounded-xl md:border"
      testId="preview-overlay"
    >
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-pane-header px-3 md:px-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-connection">Preview expandido</p>
          <p className="truncate font-mono text-xs text-muted">{documentName}</p>
        </div>
        <div className="flex items-center gap-2">
          {mode === "draw" && <span className="hidden rounded-md bg-rose-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-300 sm:inline" data-testid="annotation-drawing-badge">Desenhando</span>}
          {headerAction}
          <button ref={closeButtonRef} type="button" onClick={onClose} data-testid="preview-overlay-close" className="ui-pressable min-h-10 rounded-lg border border-border bg-surface-elevated px-3 text-xs font-medium hover:border-connection/50" aria-label="Fechar preview expandido">Fechar</button>
        </div>
      </header>

      {storageError && <div className="shrink-0 bg-red-500/10 px-4 py-2 text-center text-xs text-error" role="alert" data-testid="annotation-storage-error">{storageError}</div>}

      <div className="preview-overlay-workspace grid min-h-0 flex-1">
        <aside className="annotation-dock border-r border-border bg-surface" aria-label="Ferramentas de anotação">
          <AnnotationToolbar store={store} />
        </aside>
        <div ref={scrollRef} className="preview-overlay-canvas relative min-h-0 overflow-auto bg-background" data-testid="preview-overlay-scroll">
          <div ref={contentRef} className="relative mx-auto min-h-full w-full max-w-[960px] bg-surface shadow-[0_0_0_1px_var(--border)]">
            {children}
            <AnnotationLayer store={store} contentRef={contentRef} scrollRef={scrollRef} />
          </div>
        </div>
      </div>
    </Dialog>
  );
}
