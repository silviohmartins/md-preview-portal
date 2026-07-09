"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SAMPLE_MARKDOWN } from "@/lib/markdown";
import {
  clearDraft,
  createDebouncedDraftWriter,
  parseDraftOrSample,
  readDraft,
  writeDraftImmediate,
} from "@/lib/storage";

export function useMarkdownDraft() {
  const [markdown, setMarkdown] = useState(SAMPLE_MARKDOWN);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const writerRef = useRef(createDebouncedDraftWriter(500));

  useEffect(() => {
    const stored = readDraft();
    if (stored.ok && stored.value) {
      setMarkdown(parseDraftOrSample(stored.value, SAMPLE_MARKDOWN));
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writerRef.current.write(markdown, (msg) => setStorageWarning(msg));
  }, [markdown, hydrated]);

  useEffect(() => {
    const writer = writerRef.current;
    const persist = () => {
      const result = writer.flush();
      if (!result.ok) {
        setStorageWarning(result.error);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") persist();
    };

    window.addEventListener("beforeunload", persist);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", persist);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      persist();
    };
  }, []);

  const resetToSample = useCallback(() => {
    clearDraft();
    writeDraftImmediate(SAMPLE_MARKDOWN);
    setMarkdown(SAMPLE_MARKDOWN);
    setStorageWarning(null);
  }, []);

  return {
    markdown,
    setMarkdown,
    hydrated,
    storageWarning,
    resetToSample,
  };
}
