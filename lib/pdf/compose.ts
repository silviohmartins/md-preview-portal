import { PDF_IMAGE_FORMAT, PDF_PAGE_MARGIN_PT, throwIfPdfExportCancelled } from "./shared";

type JsPdfLike = {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  addImage: (imageData: string, format: string, x: number, y: number, w: number, h: number) => void;
  addPage: () => void;
  save: (filename: string) => void;
};

export function sanitizeFilename(name: string): string {
  const cleaned = name.trim().replace(/[^\w\-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "documento";
}

async function createPdfDocument(): Promise<JsPdfLike> {
  const { jsPDF } = await import("jspdf");
  return new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" }) as unknown as JsPdfLike;
}

function addCanvasPageToPdf(
  pdf: JsPdfLike,
  canvas: HTMLCanvasElement,
  pageIndex: number,
): void {
  if (canvas.width === 0 || canvas.height === 0) {
    throw new Error("Não foi possível capturar o conteúdo para o PDF.");
  }
  if (pageIndex > 0) pdf.addPage();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PDF_PAGE_MARGIN_PT * 2;
  const drawHeightPt = (canvas.height * contentWidth) / canvas.width;
  const imageData = canvas.toDataURL("image/png");
  pdf.addImage(
    imageData,
    PDF_IMAGE_FORMAT,
    PDF_PAGE_MARGIN_PT,
    PDF_PAGE_MARGIN_PT,
    contentWidth,
    Math.min(drawHeightPt, pageHeight - PDF_PAGE_MARGIN_PT * 2),
  );
}

function savePdfDocument(pdf: JsPdfLike, filename: string): void {
  pdf.save(`${sanitizeFilename(filename)}.pdf`);
}

export async function composePdfOnePageAtATime(args: {
  filename: string;
  totalPages: number;
  signal?: AbortSignal;
  capturePage: (pageIndex: number) => Promise<HTMLCanvasElement>;
  releaseCanvas: (canvas: HTMLCanvasElement) => void;
  onPageComposed?: (completedPages: number) => void;
  createPdf?: () => Promise<JsPdfLike>;
}): Promise<void> {
  if (args.totalPages === 0) {
    throw new Error("Não foi possível capturar o conteúdo para o PDF.");
  }
  throwIfPdfExportCancelled(args.signal);
  const pdf = await (args.createPdf ?? createPdfDocument)();
  for (let pageIndex = 0; pageIndex < args.totalPages; pageIndex++) {
    throwIfPdfExportCancelled(args.signal);
    const canvas = await args.capturePage(pageIndex);
    try {
      throwIfPdfExportCancelled(args.signal);
      addCanvasPageToPdf(pdf, canvas, pageIndex);
    } finally {
      args.releaseCanvas(canvas);
    }
    args.onPageComposed?.(pageIndex + 1);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }
  throwIfPdfExportCancelled(args.signal);
  savePdfDocument(pdf, args.filename);
}
