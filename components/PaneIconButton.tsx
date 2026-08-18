"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

const paneIconButtonClass =
  "ui-pressable inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-border bg-surface-elevated p-1.5 text-foreground hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:border-connection aria-pressed:bg-connection/15 aria-pressed:text-connection";

type PaneIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export const PaneIconButton = forwardRef<HTMLButtonElement, PaneIconButtonProps>(function PaneIconButton({
  children,
  className,
  type = "button",
  ...props
}: PaneIconButtonProps, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={className ? `${paneIconButtonClass} ${className}` : paneIconButtonClass}
      {...props}
    >
      {children}
    </button>
  );
});
