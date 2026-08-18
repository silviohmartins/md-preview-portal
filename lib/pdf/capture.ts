import {
  PDF_CAPTURE_SCALE,
  PDF_RENDER_WIDTH_PX,
  throwIfPdfExportCancelled,
} from "./shared";
import { waitForPdfLayout } from "./render";

export async function captureDomPage(
  source: HTMLElement,
  startY: number,
  endY: number,
  signal?: AbortSignal,
): Promise<HTMLCanvasElement> {
  throwIfPdfExportCancelled(signal);
  const height = Math.max(1, Math.ceil(endY - startY));
  const viewport = document.createElement("div");
  viewport.className = "pdf-export-viewport";
  viewport.setAttribute("aria-hidden", "true");
  viewport.style.cssText = [
    "position: fixed", "left: -10000px", "top: 0",
    `width: ${PDF_RENDER_WIDTH_PX}px`, `height: ${height}px`,
    "overflow: hidden", "opacity: 1", "pointer-events: none", "z-index: -1",
    "background: #ffffff",
  ].join("; ");
  const clone = source.cloneNode(true) as HTMLElement;
  clone.style.cssText = [
    "position: relative", "left: 0", "top: 0",
    `width: ${PDF_RENDER_WIDTH_PX}px`, "margin: 0", "opacity: 1",
    "pointer-events: none", `transform: translateY(-${startY}px)`,
    "background: #ffffff",
  ].join("; ");
  viewport.appendChild(clone);
  document.body.appendChild(viewport);
  try {
    await waitForPdfLayout();
    throwIfPdfExportCancelled(signal);
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(viewport, {
      scale: PDF_CAPTURE_SCALE,
      backgroundColor: "#ffffff",
      useCORS: false,
      logging: false,
      width: PDF_RENDER_WIDTH_PX,
      height,
      windowWidth: PDF_RENDER_WIDTH_PX,
      windowHeight: height,
      x: 0,
      y: 0,
    });
    if (signal?.aborted) {
      releasePdfCanvas(canvas);
      throwIfPdfExportCancelled(signal);
    }
    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error("Não foi possível capturar o conteúdo para o PDF.");
    }
    return canvas;
  } finally {
    viewport.remove();
  }
}

export function releasePdfCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}
