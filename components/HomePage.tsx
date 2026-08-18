"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CapabilityBanner } from "@/components/CapabilityBanner";
import { ClearConfirmDialog } from "@/components/ClearConfirmDialog";
import { Dialog } from "@/components/Dialog";
import { DirtyConfirmDialog } from "@/components/DirtyConfirmDialog";
import { DocumentActions } from "@/components/DocumentActions";
import { DocumentStatusBar } from "@/components/DocumentStatusBar";
import { FileTree } from "@/components/FileTree";
import { CopyIcon, ExpandIcon, PdfIcon, ScrollSyncIcon } from "@/components/icons";
import { PaneIconButton } from "@/components/PaneIconButton";
import { Preview } from "@/components/Preview";
import { Toolbar } from "@/components/Toolbar";
import { WorkbenchPanes } from "@/components/WorkbenchPanes";
import { MobileDock, ViewModeTabs } from "@/components/WorkbenchNavigation";
import { WorkbenchShell } from "@/components/WorkbenchShell";
import { useCopyMarkdown } from "@/hooks/useCopyMarkdown";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useDocumentMetrics } from "@/hooks/useDocumentMetrics";
import { useExportMarkdownPdf } from "@/hooks/useExportMarkdownPdf";
import { useScrollSync } from "@/hooks/useScrollSync";
import { useWorkbenchLayout } from "@/hooks/useWorkbenchLayout";
import { type DirtyDecision, useWorkspace } from "@/hooks/useWorkspace";
import { createAnnotationDocumentKey, hashMarkdown } from "@/lib/annotations/hash";
import { ANNOTATION_CONTENT_VERSION } from "@/lib/annotations/types";
import { formatByteSize, LARGE_DOCUMENT_BYTES } from "@/lib/documentMetrics";
import { PREVIEW_DEBOUNCE_LARGE_MS, PREVIEW_DEBOUNCE_MS } from "@/lib/markdown";

const Editor = dynamic(() => import("@/components/Editor").then((module) => module.Editor), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted">Carregando editor…</div>,
});

const PreviewOverlay = dynamic(() => import("@/components/PreviewOverlay").then((module) => module.PreviewOverlay), { ssr: false });

export function HomePage() {
  const dirtyResolverRef = useRef<((decision: DirtyDecision) => void) | null>(null);
  const [dirtyDialogOpen, setDirtyDialogOpen] = useState(false);
  const confirmDirtyChange = useCallback((): Promise<DirtyDecision> => new Promise((resolve) => {
    dirtyResolverRef.current = resolve;
    setDirtyDialogOpen(true);
  }), []);

  const {
    markdown, setMarkdown, hydrated, storageWarning, fsError, clearDocument,
    files, activePath, folderName, workspaceId, isFolderOpen, dirty, saving,
    saveStatus, capabilities, openFolder, openFile, save, closeFolder,
    isEnumerating, enumerationProgress,
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
  const [fileTreeCollapsed, setFileTreeCollapsed] = useState(true);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [showCapabilityNotice, setShowCapabilityNotice] = useState(true);
  const editorScrollerRef = useRef<HTMLElement | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const previewExpandButtonRef = useRef<HTMLButtonElement>(null);
  const layout = useWorkbenchLayout();

  useEffect(() => setFileTreeCollapsed(!isFolderOpen), [isFolderOpen]);
  useEffect(() => {
    if (isFolderOpen) setShowCapabilityNotice(true);
  }, [isFolderOpen]);

  const documentMetrics = useDocumentMetrics(markdown);
  const shouldThrottlePreview = markdown.length > LARGE_DOCUMENT_BYTES || documentMetrics.isLarge;
  const debouncedMarkdown = useDebouncedValue(markdown, shouldThrottlePreview ? PREVIEW_DEBOUNCE_LARGE_MS : PREVIEW_DEBOUNCE_MS);
  const previewHighlight = !shouldThrottlePreview;
  const { copy, canCopy, copyButtonLabel } = useCopyMarkdown(markdown);
  const { exportPdf, cancelPdf, canExport, exportingPdf, pdfError, pdfProgress } = useExportMarkdownPdf(markdown);

  const annotationDocumentKey = useMemo(() => createAnnotationDocumentKey({
    workspaceId,
    relativePath: activePath ?? "__draft__.md",
    contentVersion: ANNOTATION_CONTENT_VERSION,
  }), [activePath, workspaceId]);
  const canExpandPreview = debouncedMarkdown.trim().length > 0;
  const canScrollSync = !previewExpanded && layout.viewMode === "split";
  const canSave = isFolderOpen && Boolean(activePath) && dirty;

  useScrollSync({
    enabled: scrollSyncEnabled && canScrollSync,
    getLeft: useCallback(() => editorScrollerRef.current, []),
    getRight: useCallback(() => previewScrollRef.current, []),
    attachKey: editorReady,
  });

  const handleScrollerReady = useCallback((scroller: HTMLElement | null) => {
    editorScrollerRef.current = scroller;
    setEditorReady(Boolean(scroller));
  }, []);
  const toggleScrollSync = useCallback(() => {
    if (canScrollSync) setScrollSyncEnabled((current) => !current);
  }, [canScrollSync]);
  const confirmClear = useCallback(() => {
    clearDocument();
    setShowClearConfirm(false);
    setPreviewExpanded(false);
  }, [clearDocument]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      if (!saving) void save();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save, saving]);

  const pdfProgressLabel = !pdfProgress || pdfProgress.phase === "preparing"
    ? "Preparando PDF…"
    : pdfProgress.phase === "saving"
      ? "Finalizando PDF…"
      : `Gerando página ${pdfProgress.completedPages + 1} de ${pdfProgress.totalPages}…`;
  const pdfLabel = exportingPdf ? pdfProgressLabel : "Baixar preview em PDF";
  const scrollSyncLabel = scrollSyncEnabled ? "Desativar sincronização de scroll" : "Ativar sincronização de scroll";
  const saveStatusLabel = { saved: "Salvo", unsaved: "Não salvo", saving: "Salvando…", error: "Falha ao salvar" }[saveStatus];

  const previewHeaderActions = (
    <div className="flex items-center gap-1">
      <PaneIconButton disabled={!canExport || exportingPdf} onClick={exportPdf} data-testid="preview-export-pdf" aria-label={pdfLabel} title={pdfLabel}><PdfIcon /></PaneIconButton>
      <PaneIconButton ref={previewExpandButtonRef} disabled={!canExpandPreview} onClick={() => setPreviewExpanded(true)} data-testid="preview-expand" aria-label="Expandir preview" title="Expandir preview"><ExpandIcon /></PaneIconButton>
    </div>
  );

  const footerLeft = [
    "GFM",
    isFolderOpen ? saveStatusLabel : "Auto-save localStorage",
    `${documentMetrics.words} palavras`,
    formatByteSize(documentMetrics.bytes),
  ].join(" · ");
  const footerRight = `${scrollSyncEnabled && canScrollSync ? "Sync conectado" : "Sync independente"} · ${folderName ? `Pasta: ${folderName}` : "Salvo localmente"}`;

  if (!hydrated) {
    return (
      <div className="flex h-[100dvh] flex-col bg-background">
        <Toolbar onClear={() => {}} />
        <div className="flex flex-1 items-center justify-center text-sm text-muted">
          {enumerationProgress?.filesFound ? `Restaurando pasta… ${enumerationProgress.filesFound} arquivos Markdown encontrados` : "Carregando…"}
        </div>
      </div>
    );
  }

  const hasModal = previewExpanded || showClearConfirm || dirtyDialogOpen || explorerOpen || mobileMoreOpen;
  const editorNode = <Editor value={markdown} onChange={setMarkdown} onScrollerReady={handleScrollerReady} />;
  const previewNode = previewExpanded
    ? <p className="p-5 text-sm text-muted" aria-hidden="true">Preview aberto em modo expandido.</p>
    : <Preview markdown={debouncedMarkdown} highlight={previewHighlight} />;

  const documentActions = (
    <DocumentActions
      activePath={activePath}
      canExport={canExport}
      canSave={canSave}
      clearDisabled={isFolderOpen}
      exporting={exportingPdf}
      folderName={folderName}
      mobileOpen={mobileMoreOpen}
      onClear={() => {
        setMobileMoreOpen(false);
        setShowClearConfirm(true);
      }}
      onCloseMobile={() => setMobileMoreOpen(false)}
      onExport={() => {
        setMobileMoreOpen(false);
        void exportPdf();
      }}
      onOpenFolder={() => {
        setMobileMoreOpen(false);
        void openFolder();
      }}
      onSave={() => void save()}
      onShowFiles={() => setExplorerOpen(true)}
      onToggleScrollSync={toggleScrollSync}
      saveStatus={saveStatus}
      saving={saving}
      scrollSyncDisabled={!canScrollSync}
      scrollSyncEnabled={scrollSyncEnabled}
    />
  );

  const notices = (
    <div className="shrink-0" aria-label="Avisos do documento">
      <CapabilityBanner visible={showCapabilityNotice && isFolderOpen && !capabilities.canOverwriteInPlace} onDismiss={() => setShowCapabilityNotice(false)} />
      {storageWarning && <Notice tone="warning">{storageWarning}</Notice>}
      {fsError && <Notice tone="error" testId="fs-error-banner">{fsError}</Notice>}
      {isEnumerating && <Notice tone="info" live testId="folder-enumeration-progress">{enumerationProgress?.filesFound ? `Lendo pasta… ${enumerationProgress.filesFound} arquivos Markdown encontrados` : "Lendo pasta…"}</Notice>}
      {documentMetrics.isLarge && <Notice tone="warning" testId={documentMetrics.isVeryLarge ? "very-large-doc-banner" : "large-doc-banner"}>{documentMetrics.isVeryLarge ? `Arquivo muito grande (${formatByteSize(documentMetrics.bytes)}) — o preview é atualizado em pausas para preservar a digitação.` : `Documento grande (${formatByteSize(documentMetrics.bytes)}) — preview com atualização reduzida.`}</Notice>}
      {pdfError && <Notice tone="error">{pdfError}</Notice>}
      {exportingPdf && <div className="flex min-h-10 items-center justify-center gap-3 bg-connection/10 px-4 py-2 text-xs text-connection" aria-live="polite" data-testid="pdf-progress"><span>{pdfProgressLabel}</span><button type="button" onClick={cancelPdf} className="ui-pressable min-h-10 rounded-md border border-current px-3 font-medium">Cancelar</button></div>}
    </div>
  );

  const leftHeaderActions = (
    <div className="flex items-center gap-1">
      <PaneIconButton disabled={!canScrollSync} onClick={toggleScrollSync} data-testid="editor-scroll-sync" aria-pressed={scrollSyncEnabled} aria-label={scrollSyncLabel} title={scrollSyncLabel}><ScrollSyncIcon /></PaneIconButton>
      <PaneIconButton disabled={!canCopy} onClick={copy} data-testid="editor-copy" aria-label={copyButtonLabel} title={copyButtonLabel}><CopyIcon /></PaneIconButton>
    </div>
  );

  return (
    <>
      <WorkbenchShell
        actions={documentActions}
        inert={hasModal}
        notices={notices}
        viewNavigation={<ViewModeTabs mode={layout.viewMode} canSplit={layout.canSplit} onChange={layout.setPreferredView} />}
        statusBar={<DocumentStatusBar left={footerLeft} right={footerRight} saveStatus={saveStatus} />}
        mobileDock={<MobileDock onFiles={() => setExplorerOpen(true)} onSave={() => void save()} onMore={() => setMobileMoreOpen(true)} canSave={canSave} saving={saving} />}
      >
        <WorkbenchPanes
          activePath={activePath}
          dirty={dirty}
          editor={editorNode}
          explorerCollapsed={fileTreeCollapsed}
          explorerWidth={layout.explorerWidth}
          files={files}
          folderName={folderName}
          leftHeaderAction={leftHeaderActions}
          onCloseFolder={() => void closeFolder()}
          onCollapseExplorer={() => setFileTreeCollapsed(true)}
          onExpandExplorer={() => setFileTreeCollapsed(false)}
          onExplorerWidthChange={layout.setExplorerWidth}
          onOpenFile={(path) => void openFile(path)}
          onOpenFolder={() => void openFolder()}
          onSplitRatioChange={layout.setSplitRatio}
          preview={previewNode}
          previewScrollRef={previewScrollRef}
          rightHeaderAction={previewHeaderActions}
          scrollSyncEnabled={scrollSyncEnabled}
          splitRatio={layout.splitRatio}
          viewMode={layout.viewMode}
          viewport={layout.viewport}
        />
        <div className="sr-only" aria-live="polite" aria-atomic="true">{saveStatusLabel}. {exportingPdf ? pdfProgressLabel : ""}</div>
      </WorkbenchShell>

      <Dialog open={explorerOpen} onClose={() => setExplorerOpen(false)} ariaLabel="Arquivos" backdropClassName={layout.viewport === "mobile" ? "items-end justify-center p-0" : "items-stretch justify-start p-0"} className={layout.viewport === "mobile" ? "file-explorer-sheet flex h-[min(78dvh,620px)] min-h-0 w-full flex-col rounded-t-2xl border border-border bg-surface shadow-2xl" : "file-explorer-drawer flex h-full min-h-0 w-[min(88vw,320px)] flex-col border-r border-border bg-surface shadow-2xl"} testId="file-explorer-drawer">
        {layout.viewport === "mobile" && <div className="mx-auto my-2 h-1 w-10 shrink-0 rounded-full bg-border" aria-hidden="true" />}
        <FileTree files={files} activePath={activePath} dirty={dirty} folderName={folderName} onOpenFile={(path) => { setExplorerOpen(false); void openFile(path); }} onOpenFolder={() => { setExplorerOpen(false); void openFolder(); }} onCloseFolder={() => { setExplorerOpen(false); void closeFolder(); }} onCollapse={() => setExplorerOpen(false)} />
      </Dialog>

      {previewExpanded && <PreviewOverlay open onClose={() => setPreviewExpanded(false)} returnFocusRef={previewExpandButtonRef} documentKey={annotationDocumentKey} legacyDocumentKey={hashMarkdown(markdown)} documentName={activePath ?? "Rascunho sem título"} headerAction={<PaneIconButton disabled={!canExport || exportingPdf} onClick={exportPdf} data-testid="preview-overlay-export-pdf" aria-label={pdfLabel} title={pdfLabel}><PdfIcon /></PaneIconButton>}><Preview markdown={debouncedMarkdown} highlight={previewHighlight} /></PreviewOverlay>}
      <ClearConfirmDialog open={showClearConfirm} onCancel={() => setShowClearConfirm(false)} onConfirm={confirmClear} />
      <DirtyConfirmDialog open={dirtyDialogOpen} onCancel={() => resolveDirtyDialog("cancel")} onDiscard={() => resolveDirtyDialog("discard")} onSave={() => resolveDirtyDialog("save")} saving={saving} />
    </>
  );
}

function Notice({ children, tone, live = false, testId }: { children: React.ReactNode; tone: "warning" | "error" | "info"; live?: boolean; testId?: string }) {
  const toneClass = tone === "error" ? "bg-red-500/10 text-error" : tone === "warning" ? "bg-amber-500/10 text-warning" : "bg-connection/10 text-connection-text";
  return <div className={`px-4 py-2 text-center text-xs ${toneClass}`} role={tone === "error" ? "alert" : "status"} aria-live={live ? "polite" : undefined} data-testid={testId}>{children}</div>;
}
