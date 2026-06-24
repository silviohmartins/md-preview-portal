"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Preview } from "@/components/Preview";
import { PreviewOverlay } from "@/components/PreviewOverlay";
import { SplitPane } from "@/components/SplitPane";
import { Toolbar } from "@/components/Toolbar";
import { isLargeDocument, SAMPLE_MARKDOWN } from "@/lib/markdown";
import {
  createDebouncedDraftWriter,
  parseDraftOrSample,
  readDraft,
  clearDraft,
  writeDraftImmediate,
} from "@/lib/storage";

const Editor = dynamic(() => import("@/components/Editor").then((m) => m.Editor), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted">
      Carregando editor…
    </div>
  ),
});

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function HomePage() {
  const [markdown, setMarkdown] = useState(SAMPLE_MARKDOWN);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const writerRef = useRef(createDebouncedDraftWriter(500));

  const debouncedMarkdown = useDebouncedValue(markdown, 150);
  const largeDoc = useMemo(
    () => isLargeDocument(markdown),
    [markdown],
  );

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

  const handleClear = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const confirmClear = useCallback(() => {
    clearDraft();
    writeDraftImmediate(SAMPLE_MARKDOWN);
    setMarkdown(SAMPLE_MARKDOWN);
    setShowClearConfirm(false);
    setPreviewExpanded(false);
    setStorageWarning(null);
  }, []);

  const wordCount = useMemo(() => {
    const words = markdown.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }, [markdown]);

  const canExpandPreview = debouncedMarkdown.trim().length > 0;

  if (!hydrated) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <Toolbar onClear={() => {}} />
        <div className="flex flex-1 items-center justify-center text-sm text-muted">
          Carregando…
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Toolbar onClear={handleClear} />
      {storageWarning && (
        <div className="bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-700 dark:text-amber-300">
          {storageWarning}
        </div>
      )}
      {largeDoc && (
        <div className="bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-700 dark:text-amber-300">
          Documento grande (&gt;50KB) — o preview pode ficar mais lento.
        </div>
      )}
      <SplitPane
        left={<Editor value={markdown} onChange={setMarkdown} />}
        right={<Preview markdown={debouncedMarkdown} error={null} />}
        rightHeaderAction={
          <button
            type="button"
            disabled={!canExpandPreview}
            onClick={() => setPreviewExpanded(true)}
            data-testid="preview-expand"
            className="rounded border border-border bg-surface-elevated p-1 text-foreground transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Expandir preview"
            title="Expandir preview"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path d="M1 1v4h1.5V2.5H5V1H1zm10 0v1.5h2.5V5H15V1h-4zM1 11v4h4v-1.5H2.5V11H1zm13 0h-1.5v2.5H11V15h4v-4z" />
            </svg>
          </button>
        }
      />
      <PreviewOverlay
        open={previewExpanded}
        onClose={() => setPreviewExpanded(false)}
      >
        <Preview markdown={debouncedMarkdown} error={null} />
      </PreviewOverlay>
      <footer className="flex shrink-0 items-center justify-between border-t border-border bg-pane-header px-4 py-1.5 text-[11px] text-muted">
        <span>GFM · Auto-save localStorage · {wordCount} palavras</span>
        <span>Split 50/50</span>
      </footer>
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-lg">
            <p className="text-sm font-medium">Limpar conteúdo?</p>
            <p className="mt-1 text-xs text-muted">
              O editor volta ao exemplo padrão e o rascunho salvo é removido.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-xs text-muted hover:bg-pane-header"
                onClick={() => setShowClearConfirm(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700"
                onClick={confirmClear}
              >
                Limpar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
