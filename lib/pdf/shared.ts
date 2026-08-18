export const PDF_STYLE_ID = "pdf-export-styles";
export const PDF_RENDER_WIDTH_PX = 794;
export const PDF_PAGE_MARGIN_PT = 40;
export const PDF_IMAGE_FORMAT = "PNG" as const;
export const PDF_CAPTURE_SCALE = 2;

type PdfExportPhase = "preparing" | "capturing" | "saving";
export type PdfExportProgress = {
  phase: PdfExportPhase;
  completedPages: number;
  totalPages: number;
};
export type PdfExportOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: PdfExportProgress) => void;
};

export class PdfExportCancelledError extends Error {
  constructor() {
    super("Exportação cancelada.");
    this.name = "PdfExportCancelledError";
  }
}

export function throwIfPdfExportCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new PdfExportCancelledError();
}
