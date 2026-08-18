"use client";

import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const dialogStack: symbol[] = [];

type DialogProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  className?: string;
  backdropClassName?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  closeOnBackdrop?: boolean;
  /** Return false when Escape was handled but the dialog must stay open. */
  onEscape?: () => boolean | void;
  testId?: string;
};

export function Dialog({
  open,
  onClose,
  children,
  ariaLabel,
  ariaLabelledBy,
  className = "",
  backdropClassName = "items-center justify-center p-4",
  initialFocusRef,
  returnFocusRef: explicitReturnFocusRef,
  closeOnBackdrop = true,
  onEscape,
  testId,
}: DialogProps) {
  const generatedLabelId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const onEscapeRef = useRef(onEscape);
  const dialogIdRef = useRef(Symbol("dialog"));
  onCloseRef.current = onClose;
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!open) return;
    const dialogId = dialogIdRef.current;
    dialogStack.push(dialogId);
    const backgroundDialogs = Array.from(
      document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'),
    ).filter((element) => element !== dialogRef.current);
    backgroundDialogs.forEach((element) => {
      element.inert = true;
    });
    returnFocusRef.current = explicitReturnFocusRef?.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      const target =
        initialFocusRef?.current ??
        dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
        dialogRef.current;
      target?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (dialogStack.at(-1) !== dialogId) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (onEscapeRef.current?.() === false) return;
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ??
          [],
      ).filter(
        (element) =>
          !element.hidden &&
          !element.closest("[hidden], details:not([open]), [inert]") &&
          window.getComputedStyle(element).display !== "none",
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      const stackIndex = dialogStack.lastIndexOf(dialogId);
      if (stackIndex >= 0) dialogStack.splice(stackIndex, 1);
      backgroundDialogs.forEach((element) => {
        element.inert = false;
      });
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [explicitReturnFocusRef, initialFocusRef, open]);

  if (!open) return null;

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && event.target === event.currentTarget) onClose();
  };

  return createPortal(
    <div
      className={`dialog-backdrop fixed inset-0 z-50 flex bg-black/60 ${backdropClassName}`}
      onMouseDown={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy ?? (!ariaLabel ? generatedLabelId : undefined)}
        tabIndex={-1}
        className={className}
        data-testid={testId}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
