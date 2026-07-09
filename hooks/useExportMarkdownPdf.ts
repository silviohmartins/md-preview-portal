"use client";

import { useCallback, useState } from "react";
import { exportMarkdownToPdf } from "@/lib/exportPdf";

export function useExportMarkdownPdf(markdown: string) {
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const canExport = markdown.trim().length > 0;

  const exportPdf = useCallback(async () => {
    if (!canExport || exportingPdf) return;
    setPdfError(null);
    setExportingPdf(true);
    try {
      await exportMarkdownToPdf(markdown);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível exportar o PDF.";
      setPdfError(message);
    } finally {
      setExportingPdf(false);
    }
  }, [canExport, exportingPdf, markdown]);

  return { exportPdf, canExport, exportingPdf, pdfError };
}
