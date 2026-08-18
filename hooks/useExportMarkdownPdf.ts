"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PdfExportProgress } from "@/lib/pdf/shared";

export function useExportMarkdownPdf(markdown: string) {
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<PdfExportProgress | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const canExport = markdown.trim().length > 0;

  const exportPdf = useCallback(async () => {
    if (!canExport || exportingPdf) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setPdfError(null);
    setPdfProgress({ phase: "preparing", completedPages: 0, totalPages: 0 });
    setExportingPdf(true);
    try {
      const { exportMarkdownToPdf } = await import("@/lib/exportPdf");
      await exportMarkdownToPdf(markdown, "mdstudio.io", {
        signal: controller.signal,
        onProgress: setPdfProgress,
      });
    } catch (error) {
      if (!(error instanceof Error && error.name === "PdfExportCancelledError")) {
        setPdfError(
          error instanceof Error
            ? error.message
            : "Não foi possível exportar o PDF.",
        );
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setExportingPdf(false);
      setPdfProgress(null);
    }
  }, [canExport, exportingPdf, markdown]);

  const cancelPdf = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  return {
    exportPdf,
    cancelPdf,
    canExport,
    exportingPdf,
    pdfError,
    pdfProgress,
  };
}
