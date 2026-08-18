"use client";

import { useEffect, useRef, useState } from "react";
import {
  calculateDocumentMetrics,
  type DocumentMetrics,
} from "@/lib/documentMetrics";

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function useDocumentMetrics(content: string): DocumentMetrics {
  const [metrics, setMetrics] = useState(() =>
    calculateDocumentMetrics(content),
  );
  const firstEffectRef = useRef(true);

  useEffect(() => {
    if (firstEffectRef.current) {
      firstEffectRef.current = false;
      return;
    }

    const idleWindow = window as IdleWindow;
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(
        () => setMetrics(calculateDocumentMetrics(content)),
        { timeout: 100 },
      );
      return () => idleWindow.cancelIdleCallback?.(handle);
    }

    const handle = window.setTimeout(
      () => setMetrics(calculateDocumentMetrics(content)),
      100,
    );
    return () => window.clearTimeout(handle);
  }, [content]);

  return metrics;
}
