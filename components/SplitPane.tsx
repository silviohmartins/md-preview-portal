"use client";

import type { ReactNode } from "react";

type SplitPaneProps = {
  left: ReactNode;
  right: ReactNode;
  leftLabel?: string;
  rightLabel?: string;
  rightHeaderAction?: ReactNode;
};

export function SplitPane({
  left,
  right,
  leftLabel = "Editor",
  rightLabel = "Preview",
  rightHeaderAction,
}: SplitPaneProps) {
  return (
    <main className="grid min-h-0 flex-1 grid-cols-2 divide-x divide-border">
      <section className="flex min-h-0 flex-col">
        <div className="border-b border-border bg-pane-header px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
          {leftLabel}
        </div>
        <div className="min-h-0 flex-1">{left}</div>
      </section>
      <section className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-border bg-pane-header px-3 py-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
            {rightLabel}
          </span>
          {rightHeaderAction}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{right}</div>
      </section>
    </main>
  );
}
