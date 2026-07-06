"use client";

import { useEffect, useRef, type ReactNode } from "react";

type PreviewOverlayProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  headerAction?: ReactNode;
};

export function PreviewOverlay({ open, onClose, children, headerAction }: PreviewOverlayProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

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
        <header className="flex shrink-0 items-center justify-between border-b border-border bg-pane-header px-4 py-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
            Preview
          </span>
          <div className="flex items-center gap-2">
            {headerAction}
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              data-testid="preview-overlay-close"
              className="rounded-md border border-border bg-surface-elevated px-3 py-1 text-xs text-foreground transition hover:bg-surface"
              aria-label="Sair do preview expandido"
            >
              Fechar
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
