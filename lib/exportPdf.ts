import { renderMarkdownHtml } from "@/lib/markdown";
import { captureDomPage, releasePdfCanvas } from "@/lib/pdf/capture";
import { composePdfOnePageAtATime } from "@/lib/pdf/compose";
import { measureAndPaginatePdf } from "@/lib/pdf/pagination";
import { createPdfRenderContainer, removePdfRenderStyles } from "@/lib/pdf/render";
import { type PdfExportOptions, throwIfPdfExportCancelled } from "@/lib/pdf/shared";

/** Renders the current Markdown snapshot and downloads an A4 PDF. */
export async function exportMarkdownToPdf(
  markdown: string,
  filename = "mdstudio.io",
  options: PdfExportOptions = {},
): Promise<void> {
  if (!markdown.trim()) throw new Error("Não há conteúdo para exportar.");
  throwIfPdfExportCancelled(options.signal);
  options.onProgress?.({ phase: "preparing", completedPages: 0, totalPages: 0 });

  const bodyHtml = await renderMarkdownHtml(markdown, {
    codeTheme: "light",
    highlight: true,
  });
  const container = await createPdfRenderContainer(bodyHtml, options.signal);
  try {
    throwIfPdfExportCancelled(options.signal);
    const ranges = measureAndPaginatePdf(container);
    if (ranges.length === 0) {
      throw new Error("Não foi possível capturar o conteúdo para o PDF.");
    }
    options.onProgress?.({
      phase: "capturing",
      completedPages: 0,
      totalPages: ranges.length,
    });
    await composePdfOnePageAtATime({
      filename,
      totalPages: ranges.length,
      signal: options.signal,
      capturePage: (pageIndex) => {
        const range = ranges[pageIndex]!;
        return captureDomPage(container, range.start, range.end, options.signal);
      },
      releaseCanvas: releasePdfCanvas,
      onPageComposed: (completedPages) => {
        options.onProgress?.({
          phase: completedPages === ranges.length ? "saving" : "capturing",
          completedPages,
          totalPages: ranges.length,
        });
      },
    });
  } finally {
    container.remove();
    document.querySelectorAll(".pdf-export-viewport").forEach((node) => node.remove());
    removePdfRenderStyles();
  }
}
