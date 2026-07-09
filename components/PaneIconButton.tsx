"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export const paneIconButtonClass =
  "ui-pressable rounded border border-border bg-surface-elevated p-1 text-foreground hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:border-foreground/40 aria-pressed:bg-pane-header";

type PaneIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function PaneIconButton({
  children,
  className,
  type = "button",
  ...props
}: PaneIconButtonProps) {
  return (
    <button
      type={type}
      className={className ? `${paneIconButtonClass} ${className}` : paneIconButtonClass}
      {...props}
    >
      {children}
    </button>
  );
}
