"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type WorkbenchViewMode = "editor" | "preview" | "split";
export type WorkbenchViewport = "mobile" | "tablet" | "desktop";

const VIEW_MODE_KEY = "md-workbench-view";
const SPLIT_RATIO_KEY = "md-workbench-split-ratio";
const EXPLORER_WIDTH_KEY = "md-workbench-explorer-width";

function readNumber(key: string, fallback: number, min: number, max: number) {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === null) return fallback;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  } catch {
    return fallback;
  }
}

export function useWorkbenchLayout() {
  const [viewport, setViewport] = useState<WorkbenchViewport>("desktop");
  const [canSplit, setCanSplit] = useState(true);
  const [preferredView, setPreferredViewState] =
    useState<WorkbenchViewMode>("editor");
  const [splitRatio, setSplitRatioState] = useState(50);
  const [explorerWidth, setExplorerWidthState] = useState(240);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mobile = window.matchMedia("(max-width: 767px)");
    const desktop = window.matchMedia("(min-width: 1024px)");
    const split = window.matchMedia("(min-width: 900px)");
    const update = () => {
      setViewport(mobile.matches ? "mobile" : desktop.matches ? "desktop" : "tablet");
      setCanSplit(split.matches);
    };
    update();
    mobile.addEventListener("change", update);
    desktop.addEventListener("change", update);
    split.addEventListener("change", update);
    return () => {
      mobile.removeEventListener("change", update);
      desktop.removeEventListener("change", update);
      split.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    try {
      const storedView = window.localStorage.getItem(VIEW_MODE_KEY);
      if (storedView === "editor" || storedView === "preview" || storedView === "split") {
        setPreferredViewState(storedView);
      }
    } catch {
      // Layout preferences are optional.
    }
    setSplitRatioState(readNumber(SPLIT_RATIO_KEY, 50, 25, 75));
    setExplorerWidthState(readNumber(EXPLORER_WIDTH_KEY, 240, 220, 320));
  }, []);

  const setPreferredView = useCallback((view: WorkbenchViewMode) => {
    setPreferredViewState(view);
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, view);
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  }, []);

  const setSplitRatio = useCallback((ratio: number) => {
    const next = Math.min(75, Math.max(25, Math.round(ratio)));
    setSplitRatioState(next);
    try {
      window.localStorage.setItem(SPLIT_RATIO_KEY, String(next));
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  }, []);

  const setExplorerWidth = useCallback((width: number) => {
    const next = Math.min(320, Math.max(220, Math.round(width)));
    setExplorerWidthState(next);
    try {
      window.localStorage.setItem(EXPLORER_WIDTH_KEY, String(next));
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  }, []);

  const viewMode = useMemo<WorkbenchViewMode>(() => {
    if (viewport === "desktop") return "split";
    if (!canSplit && preferredView === "split") return "editor";
    return preferredView;
  }, [canSplit, preferredView, viewport]);

  return {
    viewport,
    canSplit,
    preferredView,
    viewMode,
    setPreferredView,
    splitRatio,
    setSplitRatio,
    explorerWidth,
    setExplorerWidth,
  };
}
