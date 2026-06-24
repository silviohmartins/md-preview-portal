"use client";

import type { ReactNode } from "react";

type SplitPaneProps = {
  left: ReactNode;
  right: ReactNode;
  leftLabel?: string;
  rightLabel?: string;
};

export function SplitPane({
  left,
  right,
  leftLabel = "Editor",
  rightLabel = "Preview",
}: SplitPaneProps) {
  return (
    <main className="grid min-h-0 flex-1 grid-cols-2 divide-x divide-[var(--border)]">
      <section className="flex min-h-0 flex-col">
        <div className="border-b border-[var(--border)] bg-[var(--pane-header)] px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
          {leftLabel}
        </div>
        <div className="min-h-0 flex-1">{left}</div>
      </section>
      <section className="flex min-h-0 flex-col">
        <div className="border-b border-[var(--border)] bg-[var(--pane-header)] px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
          {rightLabel}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{right}</div>
      </section>
    </main>
  );
}
