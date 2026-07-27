"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CapabilityBanner } from "@/components/CapabilityBanner";
import { ClearConfirmDialog } from "@/components/ClearConfirmDialog";
import { DirtyConfirmDialog } from "@/components/DirtyConfirmDialog";
import { FileTree } from "@/components/FileTree";
import { FileTreeCollapsed } from "@/components/FileTreeCollapsed";
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
import {
  type DirtyDecision,
  useWorkspace,
} from "@/hooks/useWorkspace";
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
  const dirtyResolverRef = useRef<((decision: DirtyDecision) => void) | null>(
    null,
  );
  const [dirtyDialogOpen, setDirtyDialogOpen] = useState(false);

  const confirmDirtyChange = useCallback((): Promise<DirtyDecision> => {
    return new Promise((resolve) => {
      dirtyResolverRef.current = resolve;
      setDirtyDialogOpen(true);
    });
  }, []);

  const {
    markdown,
    setMarkdown,
    hydrated,
    storageWarning,
    fsError,
    resetToSample,
    files,
    activePath,
    folderName,
    isFolderOpen,
    dirty,
    saving,
    capabilities,
    openFolder,
    openFile,
    save,
    closeFolder,
  } = useWorkspace({ confirmDirtyChange });

  const resolveDirtyDialog = useCallback((decision: DirtyDecision) => {
    setDirtyDialogOpen(false);
    const resolve = dirtyResolverRef.current;
    dirtyResolverRef.current = null;
    resolve?.(decision);
  }, []);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [fileTreeCollapsed, setFileTreeCollapsed] = useState(false);

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
  const canSave = isFolderOpen && Boolean(activePath) && dirty;

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isSave =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "s";
      if (!isSave) return;
      event.preventDefault();
      void save();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

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

  const footerLeft = (() => {
    const parts = ["GFM"];
    if (isFolderOpen) {
      parts.push(dirty ? "Não salvo" : "Salvo no disco");
      if (activePath) parts.push(activePath);
    } else {
      parts.push("Auto-save localStorage");
    }
    parts.push(`${wordCount} palavras`);
    if (scrollSyncEnabled) parts.push("Scroll sync");
    return parts.join(" · ");
  })();

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
        clearDisabled={isFolderOpen}
        scrollSyncEnabled={scrollSyncEnabled}
        scrollSyncDisabled={!canScrollSync}
        onToggleScrollSync={toggleScrollSync}
        onOpenFolder={openFolder}
        onSave={save}
        canSave={canSave}
        saving={saving}
      />
      <CapabilityBanner visible={!capabilities.canOverwriteInPlace} />
      {storageWarning && (
        <div className="bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-700 dark:text-amber-300">
          {storageWarning}
        </div>
      )}
      {fsError && (
        <div
          className="bg-red-500/10 px-4 py-2 text-center text-xs text-red-700 dark:text-red-300"
          data-testid="fs-error-banner"
        >
          {fsError}
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
      <div
        className={`grid min-h-0 flex-1 ${
          fileTreeCollapsed
            ? "grid-cols-[2.5rem_1fr]"
            : "grid-cols-[minmax(160px,220px)_1fr]"
        }`}
      >
        {fileTreeCollapsed ? (
          <FileTreeCollapsed onExpand={() => setFileTreeCollapsed(false)} />
        ) : (
          <FileTree
            files={files}
            activePath={activePath}
            dirty={dirty}
            folderName={folderName}
            onOpenFile={(path) => void openFile(path)}
            onOpenFolder={() => void openFolder()}
            onCloseFolder={() => void closeFolder()}
            onCollapse={() => setFileTreeCollapsed(true)}
          />
        )}
        <SplitPane
          rightScrollRef={previewScrollRef}
          leftLabel={activePath ? `Editor · ${activePath}` : "Editor"}
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
      </div>
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
        <span data-testid="status-footer">{footerLeft}</span>
        <span>{folderName ? `Pasta: ${folderName}` : "Draft avulso"}</span>
      </footer>
      <ClearConfirmDialog
        open={showClearConfirm}
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={confirmClear}
      />
      <DirtyConfirmDialog
        open={dirtyDialogOpen}
        onCancel={() => resolveDirtyDialog("cancel")}
        onDiscard={() => resolveDirtyDialog("discard")}
        onSave={() => resolveDirtyDialog("save")}
        saving={saving}
      />
    </div>
  );
}
