"use client";

import { useEffect } from "react";
import { attachScrollSync } from "@/lib/scrollSync";

type UseScrollSyncOptions = {
  enabled: boolean;
  getLeft: () => HTMLElement | null;
  getRight: () => HTMLElement | null;
  /** Bump when panes remount (e.g. editor ready). */
  attachKey?: string | number | boolean;
};

export function useScrollSync({
  enabled,
  getLeft,
  getRight,
  attachKey,
}: UseScrollSyncOptions): void {
  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let detach: (() => void) | undefined;
    let rafId = 0;
    let attempts = 0;

    const tryAttach = () => {
      if (disposed) return;
      const left = getLeft();
      const right = getRight();
      if (!left || !right) {
        attempts += 1;
        if (attempts < 60) {
          rafId = requestAnimationFrame(tryAttach);
        }
        return;
      }
      detach = attachScrollSync(left, right);
    };

    tryAttach();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      detach?.();
    };
  }, [enabled, getLeft, getRight, attachKey]);
}
