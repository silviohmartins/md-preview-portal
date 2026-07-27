"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import { ClearConfirmDialog } from "@/components/ClearConfirmDialog";
import {
  CopyIcon,
  ExpandIcon,
  PdfIcon,
  ScrollSyncIcon,
} from "@/components/icons";
import { PaneIconButton } from "@/components/PaneIconButton";
import { Preview } from "@/components/Preview";
import { PreviewOverlay } from "@/components/PreviewOverlay";
import { SplitPane } from "@/components/SplitPane";
import { Toolbar } from "@/components/Toolbar";
import { useCopyMarkdown } from "@/hooks/useCopyMarkdown";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useExportMarkdownPdf } from "@/hooks/useExportMarkdownPdf";
import { useMarkdownDraft } from "@/hooks/useMarkdownDraft";
import { useScrollSync } from "@/hooks/useScrollSync";
import { hashMarkdown } from "@/lib/annotations/hash";
import {
  getPreviewDebounceMs,
  isLargeDocument,
} from "@/lib/markdown";
import { countWords } from "@/lib/wordCount";

const Editor = dynamic(() => import("@/components/Editor").then((m) => m.Editor), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted">
      Carregando editor…
    </div>
  ),
});

export function HomePage() {
  const {
    markdown,
    setMarkdown,
    hydrated,
    storageWarning,
    resetToSample,
  } = useMarkdownDraft();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(false);
  const [editorReady, setEditorReady] = useState(false);

  const editorScrollerRef = useRef<HTMLElement | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);

  const largeDoc = useMemo(() => isLargeDocument(markdown), [markdown]);
  const previewDelay = useMemo(
    () => getPreviewDebounceMs(markdown),
    [markdown],
  );
  const debouncedMarkdown = useDebouncedValue(markdown, previewDelay);
  const previewHighlight = useMemo(
    () => !isLargeDocument(debouncedMarkdown),
    [debouncedMarkdown],
  );

  const { copy, canCopy, copyButtonLabel } = useCopyMarkdown(markdown);
  const { exportPdf, canExport, exportingPdf, pdfError } =
    useExportMarkdownPdf(debouncedMarkdown);

  const wordCount = useMemo(() => countWords(markdown), [markdown]);
  const annotationDocumentKey = useMemo(
    () => hashMarkdown(debouncedMarkdown),
    [debouncedMarkdown],
  );
  const canExpandPreview = debouncedMarkdown.trim().length > 0;
  const canScrollSync = !previewExpanded;

  const getEditorScroller = useCallback(
    () => editorScrollerRef.current,
    [],
  );
  const getPreviewScroller = useCallback(
    () => previewScrollRef.current,
    [],
  );

  useScrollSync({
    enabled: scrollSyncEnabled && canScrollSync,
    getLeft: getEditorScroller,
    getRight: getPreviewScroller,
    attachKey: editorReady,
  });

  const handleScrollerReady = useCallback((scroller: HTMLElement | null) => {
    editorScrollerRef.current = scroller;
    setEditorReady(Boolean(scroller));
  }, []);

  const toggleScrollSync = useCallback(() => {
    if (!canScrollSync) return;
    setScrollSyncEnabled((prev) => !prev);
  }, [canScrollSync]);

  const handleClear = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const confirmClear = useCallback(() => {
    resetToSample();
    setShowClearConfirm(false);
    setPreviewExpanded(false);
  }, [resetToSample]);

  const pdfLabel = exportingPdf ? "Gerando PDF…" : "Baixar preview em PDF";
  const pdfTitle = exportingPdf ? "Gerando PDF…" : "Baixar PDF";
  const scrollSyncLabel = scrollSyncEnabled
    ? "Desativar sincronização de scroll"
    : "Ativar sincronização de scroll";

  const previewHeaderActions = (
    <div className="flex items-center gap-1">
      <PaneIconButton
        disabled={!canExport || exportingPdf}
        onClick={exportPdf}
        data-testid="preview-export-pdf"
        aria-label={pdfLabel}
        title={pdfTitle}
      >
        <PdfIcon />
      </PaneIconButton>
      <PaneIconButton
        disabled={!canExpandPreview}
        onClick={() => setPreviewExpanded(true)}
        data-testid="preview-expand"
        aria-label="Expandir preview"
        title="Expandir preview"
      >
        <ExpandIcon />
      </PaneIconButton>
    </div>
  );

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
      <Toolbar
        onClear={handleClear}
        scrollSyncEnabled={scrollSyncEnabled}
        scrollSyncDisabled={!canScrollSync}
        onToggleScrollSync={toggleScrollSync}
      />
      {storageWarning && (
        <div className="bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-700 dark:text-amber-300">
          {storageWarning}
        </div>
      )}
      {largeDoc && (
        <div
          className="bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-700 dark:text-amber-300"
          data-testid="large-doc-banner"
        >
          Documento grande (&gt;50KB) — preview com debounce maior e sem
          syntax highlight.
        </div>
      )}
      {pdfError && (
        <div className="bg-red-500/10 px-4 py-2 text-center text-xs text-red-700 dark:text-red-300">
          {pdfError}
        </div>
      )}
      <SplitPane
        rightScrollRef={previewScrollRef}
        left={
          <Editor
            value={markdown}
            onChange={setMarkdown}
            onScrollerReady={handleScrollerReady}
          />
        }
        right={
          previewExpanded ? (
            <p className="p-4 text-sm text-muted" aria-hidden="true">
              Preview expandido…
            </p>
          ) : (
            <Preview
              markdown={debouncedMarkdown}
              highlight={previewHighlight}
            />
          )
        }
        leftHeaderAction={
          <div className="flex items-center gap-1">
            <PaneIconButton
              disabled={!canScrollSync}
              onClick={toggleScrollSync}
              data-testid="editor-scroll-sync"
              aria-pressed={scrollSyncEnabled}
              aria-label={scrollSyncLabel}
              title={scrollSyncLabel}
            >
              <ScrollSyncIcon />
            </PaneIconButton>
            <PaneIconButton
              disabled={!canCopy}
              onClick={copy}
              data-testid="editor-copy"
              aria-label={copyButtonLabel}
              title={copyButtonLabel}
            >
              <CopyIcon />
            </PaneIconButton>
          </div>
        }
        rightHeaderAction={previewHeaderActions}
      />
      <PreviewOverlay
        open={previewExpanded}
        onClose={() => setPreviewExpanded(false)}
        documentKey={annotationDocumentKey}
        headerAction={
          <PaneIconButton
            disabled={!canExport || exportingPdf}
            onClick={exportPdf}
            data-testid="preview-overlay-export-pdf"
            aria-label={pdfLabel}
            title={pdfTitle}
          >
            <PdfIcon />
          </PaneIconButton>
        }
      >
        <Preview markdown={debouncedMarkdown} highlight={previewHighlight} />
      </PreviewOverlay>
      <footer className="flex shrink-0 items-center justify-between border-t border-border bg-pane-header px-4 py-1.5 text-[11px] text-muted">
        <span>
          GFM · Auto-save localStorage · {wordCount} palavras
          {scrollSyncEnabled ? " · Scroll sync" : ""}
        </span>
        <span>Split 50/50</span>
      </footer>
      <ClearConfirmDialog
        open={showClearConfirm}
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={confirmClear}
      />
    </div>
  );
}
