"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnnotationLayer } from "@/components/AnnotationLayer";
import { AnnotationToolbar } from "@/components/AnnotationToolbar";
import { useAnnotationStore } from "@/hooks/useAnnotationStore";

type PreviewOverlayProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  headerAction?: ReactNode;
  /** Stable key for annotation persistence (markdown hash). */
  documentKey: string;
};

export function PreviewOverlay({
  open,
  onClose,
  children,
  headerAction,
  documentKey,
}: PreviewOverlayProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const store = useAnnotationStore(documentKey);
  const { mode, setMode } = store;
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (wasOpenRef.current && !open) {
      setMode("navigate");
    }
    wasOpenRef.current = open;
  }, [open, setMode]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (mode === "draw") {
        event.preventDefault();
        setMode("navigate");
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, mode, setMode]);

  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-black/50 p-3 md:p-5"
      data-testid="preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Preview expandido"
      onClick={onClose}
    >
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-pane-header px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
              Preview
            </span>
            {mode === "draw" && (
              <span
                className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-700 dark:text-rose-300"
                data-testid="annotation-drawing-badge"
              >
                Desenhando
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AnnotationToolbar store={store} />
            {headerAction}
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              data-testid="preview-overlay-close"
              className="ui-pressable rounded-md border border-border bg-surface-elevated px-3 py-1 text-xs text-foreground hover:bg-surface"
              aria-label="Sair do preview expandido"
            >
              Fechar
            </button>
          </div>
        </header>
        <div
          ref={scrollRef}
          className="relative min-h-0 flex-1 overflow-auto"
          data-testid="preview-overlay-scroll"
        >
          <div ref={contentRef} className="relative min-h-full">
            {children}
            <AnnotationLayer
              store={store}
              contentRef={contentRef}
              scrollRef={scrollRef}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
