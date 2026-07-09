import html2canvas from "html2canvas";
import { renderMarkdownHtml } from "@/lib/markdown";

const PDF_STYLE_ID = "pdf-export-styles";
/** CSS px ≈ 96dpi width for A4 content area used by the offscreen renderer. */
export const PDF_RENDER_WIDTH_PX = 794;
export const PDF_PAGE_MARGIN_PT = 40;
export const PDF_IMAGE_FORMAT = "PNG" as const;
export const PDF_CAPTURE_SCALE = 2;

/** Blocks that contribute candidate break edges (top/bottom). */
const BREAK_SELECTOR = [
  "tr",
  "thead",
  "tbody",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "pre",
  "li",
  "blockquote",
  "table",
  "hr",
  "ul",
  "ol",
].join(", ");

/**
 * Regions that must not be sliced mid-way (table rows; short code blocks).
 * Paragraphs and list items use line-box breaks instead.
 */
const ATOMIC_SELECTOR = "tr, thead, pre, h1, h2, h3, h4, h5, h6";

const PDF_CSS = `
  .pdf-export-root {
    box-sizing: border-box;
    width: ${PDF_RENDER_WIDTH_PX}px;
    padding: 24px 32px;
    font-family: system-ui, -apple-system, sans-serif;
    color: #1a1a1a !important;
    background: #ffffff !important;
    line-height: 1.65;
  }
  .pdf-export-root *,
  .pdf-export-root *::before,
  .pdf-export-root *::after {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .pdf-export-root .preview-prose {
    font-size: 15px;
    max-width: none;
    color: #1a1a1a !important;
  }
  .pdf-export-root .preview-prose h1,
  .pdf-export-root .preview-prose h2,
  .pdf-export-root .preview-prose h3,
  .pdf-export-root .preview-prose h4,
  .pdf-export-root .preview-prose p,
  .pdf-export-root .preview-prose li,
  .pdf-export-root .preview-prose th,
  .pdf-export-root .preview-prose td {
    color: #1a1a1a !important;
  }
  .pdf-export-root .preview-prose h1 {
    font-size: 1.75em;
    font-weight: 700;
    margin: 0 0 0.5em;
    padding-bottom: 0.25em;
    border-bottom: 1px solid #d4d4d4;
  }
  .pdf-export-root .preview-prose h2 {
    font-size: 1.35em;
    font-weight: 600;
    margin: 1.25em 0 0.5em;
  }
  .pdf-export-root .preview-prose h3 {
    font-size: 1.15em;
    font-weight: 600;
    margin: 1em 0 0.4em;
  }
  .pdf-export-root .preview-prose p { margin: 0.75em 0; }
  .pdf-export-root .preview-prose a { color: #2563eb !important; text-decoration: underline; }
  .pdf-export-root .preview-prose pre {
    overflow: visible;
    border-radius: 6px;
    margin: 1em 0;
    padding: 0;
    background: #f5f5f5 !important;
    border: 1px solid #d4d4d4;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .pdf-export-root .preview-prose pre code {
    display: block;
    padding: 12px 16px;
    font-size: 13px;
    font-family: ui-monospace, "Cascadia Code", "Segoe UI Mono", monospace;
    background: #f5f5f5 !important;
  }
  .pdf-export-root .preview-prose :not(pre) > code {
    background: #f5f5f5 !important;
    padding: 0.15em 0.35em;
    border-radius: 4px;
    font-size: 0.9em;
    font-family: ui-monospace, "Cascadia Code", "Segoe UI Mono", monospace;
  }
  .pdf-export-root .preview-prose table {
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;
    font-size: 14px;
  }
  .pdf-export-root .preview-prose th,
  .pdf-export-root .preview-prose td {
    border: 1px solid #d4d4d4;
    padding: 8px 12px;
    text-align: left;
    vertical-align: top;
  }
  .pdf-export-root .preview-prose th {
    background: #eeeeee !important;
    font-weight: 600;
  }
  .pdf-export-root .preview-prose ul,
  .pdf-export-root .preview-prose ol {
    margin: 0.75em 0;
    padding-left: 1.5em;
  }
  .pdf-export-root .preview-prose blockquote {
    border-left: 4px solid #d4d4d4;
    margin: 1em 0;
    padding-left: 1em;
    color: #737373 !important;
  }
  .pdf-export-root .preview-prose input[type="checkbox"] {
    margin-right: 0.4em;
  }
  .pdf-export-root .preview-prose img {
    max-width: 100%;
    height: auto;
  }
`;

export type PdfAtomicRegion = {
  top: number;
  bottom: number;
};

export type PdfPageRange = {
  start: number;
  end: number;
};

export function sanitizeFilename(name: string): string {
  const cleaned = name.trim().replace(/[^\w\-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "documento";
}

/** A4 content height in CSS px for the offscreen renderer width. */
export function getPageHeightCss(): number {
  const a4WidthPt = 595;
  const a4HeightPt = 842;
  const contentWidthPt = a4WidthPt - PDF_PAGE_MARGIN_PT * 2;
  const contentHeightPt = a4HeightPt - PDF_PAGE_MARGIN_PT * 2;
  return (contentHeightPt * PDF_RENDER_WIDTH_PX) / contentWidthPt;
}

function addPoint(points: Set<number>, value: number): void {
  if (!Number.isFinite(value)) return;
  points.add(Math.max(0, value));
}

function isInsideAtomicRegion(
  y: number,
  regions: PdfAtomicRegion[],
): boolean {
  return regions.some((region) => y > region.top && y < region.bottom);
}

function findAtomicRegionAt(
  y: number,
  regions: PdfAtomicRegion[],
): PdfAtomicRegion | null {
  return regions.find((region) => y > region.top && y < region.bottom) ?? null;
}

export function collectAtomicRegionsCss(
  container: HTMLElement,
): PdfAtomicRegion[] {
  const containerRect = container.getBoundingClientRect();
  const regions: PdfAtomicRegion[] = [];

  container.querySelectorAll(ATOMIC_SELECTOR).forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const rect = node.getBoundingClientRect();
    const top = rect.top - containerRect.top;
    const bottom = rect.bottom - containerRect.top;
    if (!Number.isFinite(top) || !Number.isFinite(bottom)) return;
    if (bottom - top < 1) return;
    regions.push({
      top: Math.max(0, top),
      bottom: Math.max(0, bottom),
    });
  });

  return regions.sort((a, b) => a.top - b.top);
}

/**
 * Line-box bottoms/tops from text nodes outside table rows / short code blocks.
 */
export function collectLineBoxBreakPoints(
  container: HTMLElement,
  containerTop: number,
  points: Set<number>,
  atomicRegions: PdfAtomicRegion[],
): void {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === "SCRIPT" || tag === "STYLE") return NodeFilter.FILTER_REJECT;
      if (!(node.textContent ?? "").trim()) return NodeFilter.FILTER_REJECT;
      // Never sample line boxes inside table rows (atomic).
      if (parent.closest("tr, thead")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  if (typeof document.createRange !== "function") return;

  const range = document.createRange();
  if (typeof range.getClientRects !== "function") return;

  let textNode = walker.nextNode();
  while (textNode) {
    try {
      range.selectNodeContents(textNode);
      const rects = range.getClientRects();
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i]!;
        if (rect.height < 0.5) continue;
        const top = rect.top - containerTop;
        const bottom = rect.bottom - containerTop;
        // Skip line boxes that fall inside protected atomic regions (short pre/headings).
        if (isInsideAtomicRegion(bottom - 0.5, atomicRegions)) continue;
        addPoint(points, top);
        addPoint(points, bottom);
      }
    } catch {
      // Some environments (jsdom) lack full Range layout APIs.
    }
    textNode = walker.nextNode();
  }
}

/** Line breaks inside oversized <pre> blocks that cannot fit on one page. */
export function collectOversizedRegionLineBreaks(
  container: HTMLElement,
  containerTop: number,
  points: Set<number>,
  oversizedRegions: PdfAtomicRegion[],
): void {
  if (oversizedRegions.length === 0) return;
  if (typeof document.createRange !== "function") return;

  const range = document.createRange();
  if (typeof range.getClientRects !== "function") return;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent?.closest("pre")) return NodeFilter.FILTER_REJECT;
      if (!(node.textContent ?? "").trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let textNode = walker.nextNode();
  while (textNode) {
    try {
      range.selectNodeContents(textNode);
      const rects = range.getClientRects();
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i]!;
        if (rect.height < 0.5) continue;
        const bottom = rect.bottom - containerTop;
        if (isInsideAtomicRegion(bottom - 0.5, oversizedRegions)) {
          addPoint(points, bottom);
        }
      }
    } catch {
      // jsdom / incomplete Range
    }
    textNode = walker.nextNode();
  }
}

/**
 * Collect Y offsets (CSS px, relative to container top) where a page may end
 * without cutting through a table row or a wrapped text line.
 */
export function collectPdfBreakPointsCss(
  container: HTMLElement,
  pageHeightCss?: number,
): number[] {
  const containerRect = container.getBoundingClientRect();
  const points = new Set<number>();
  const atomicRegions = collectAtomicRegionsCss(container);

  addPoint(points, 0);
  addPoint(points, container.scrollHeight);
  addPoint(points, containerRect.height);

  container.querySelectorAll(BREAK_SELECTOR).forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const rect = node.getBoundingClientRect();
    addPoint(points, rect.top - containerRect.top);
    addPoint(points, rect.bottom - containerRect.top);
  });

  const protectedRegions =
    pageHeightCss && pageHeightCss > 0
      ? atomicRegions.filter(
          (region) => region.bottom - region.top <= pageHeightCss,
        )
      : atomicRegions;

  collectLineBoxBreakPoints(
    container,
    containerRect.top,
    points,
    protectedRegions,
  );

  if (pageHeightCss && pageHeightCss > 0) {
    const oversized = atomicRegions.filter(
      (region) => region.bottom - region.top > pageHeightCss,
    );
    collectOversizedRegionLineBreaks(
      container,
      containerRect.top,
      points,
      oversized,
    );
  }

  return [...points]
    .filter((y) => !isInsideAtomicRegion(y, protectedRegions))
    .sort((a, b) => a - b);
}

/**
 * Pick the largest safe break at or before `idealEnd`, never landing inside an
 * atomic region (table row / short code block / heading).
 */
export function choosePageEnd(
  sourceY: number,
  idealEnd: number,
  contentHeight: number,
  breakPoints: number[],
  atomicRegions: PdfAtomicRegion[] = [],
): number {
  const hardEnd = Math.min(idealEnd, contentHeight);
  if (hardEnd >= contentHeight) return contentHeight;

  const hit = findAtomicRegionAt(hardEnd, atomicRegions);
  const regionFitsOnPage =
    hit !== null && hit.bottom - hit.top <= idealEnd - sourceY + 1;
  if (hit && hit.top > sourceY && regionFitsOnPage) {
    return hit.top;
  }

  const insideFromStart = findAtomicRegionAt(sourceY + 1, atomicRegions);

  let bestAtOrBefore = -1;
  let firstAfter = -1;

  for (const point of breakPoints) {
    if (point <= sourceY) continue;
    const insideOtherAtomic =
      isInsideAtomicRegion(point, atomicRegions) &&
      !(
        insideFromStart &&
        point > insideFromStart.top &&
        point < insideFromStart.bottom
      );
    if (insideOtherAtomic) continue;
    if (point <= hardEnd) {
      bestAtOrBefore = point;
      continue;
    }
    if (firstAfter < 0) firstAfter = point;
    break;
  }

  if (bestAtOrBefore > sourceY) return bestAtOrBefore;

  if (hit && hit.top > sourceY) {
    return hit.top;
  }

  const slack = 40;
  if (firstAfter > sourceY && firstAfter - hardEnd <= slack) {
    const afterInsideOther =
      isInsideAtomicRegion(firstAfter, atomicRegions) &&
      !(
        insideFromStart &&
        firstAfter > insideFromStart.top &&
        firstAfter < insideFromStart.bottom
      );
    if (!afterInsideOther) {
      return Math.min(firstAfter, contentHeight);
    }
  }

  return hardEnd;
}

/** Plan page ranges in CSS pixels (same space as the DOM layout). */
export function planPdfPageRanges(
  contentHeight: number,
  pageHeight: number,
  breakPoints: number[] = [],
  atomicRegions: PdfAtomicRegion[] = [],
): PdfPageRange[] {
  if (contentHeight <= 0 || pageHeight <= 0) return [];

  const usablePageHeight = Math.max(1, pageHeight - 8);
  const sortedBreaks = [...new Set(breakPoints)]
    .filter((y) => y >= 0 && y <= contentHeight)
    .sort((a, b) => a - b);

  const ranges: PdfPageRange[] = [];
  let start = 0;

  while (start < contentHeight - 0.5) {
    const idealEnd = Math.min(start + usablePageHeight, contentHeight);
    const end = choosePageEnd(
      start,
      idealEnd,
      contentHeight,
      sortedBreaks,
      atomicRegions,
    );
    const safeEnd = Math.max(end, start + 1);
    ranges.push({ start, end: Math.min(safeEnd, contentHeight) });
    start = ranges[ranges.length - 1]!.end;
  }

  return ranges;
}

function injectPdfStyles(): void {
  if (document.getElementById(PDF_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PDF_STYLE_ID;
  style.textContent = PDF_CSS;
  document.head.appendChild(style);
}

function removePdfStyles(): void {
  document.getElementById(PDF_STYLE_ID)?.remove();
}

function createExportContainer(bodyHtml: string): HTMLDivElement {
  injectPdfStyles();

  const container = document.createElement("div");
  container.className = "pdf-export-root";
  container.setAttribute("aria-hidden", "true");
  container.style.cssText = [
    "position: fixed",
    "left: -10000px",
    "top: 0",
    `width: ${PDF_RENDER_WIDTH_PX}px`,
    "opacity: 1",
    "pointer-events: none",
    "z-index: -1",
    "overflow: visible",
    "background: #ffffff",
  ].join("; ");

  const article = document.createElement("article");
  article.className = "preview-prose";
  // HTML already sanitized by renderMarkdownHtml (rehype-sanitize).
  article.innerHTML = bodyHtml;

  container.appendChild(article);
  document.body.appendChild(container);
  return container;
}

async function waitForLayout(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  await new Promise<void>((resolve) => window.setTimeout(resolve, 80));
}

/**
 * Capture one page by clipping the laid-out DOM in CSS space.
 * Avoids slicing a full-document canvas (which misaligned text line boxes).
 */
export async function captureDomPage(
  source: HTMLElement,
  startY: number,
  endY: number,
): Promise<HTMLCanvasElement> {
  const height = Math.max(1, Math.ceil(endY - startY));

  const viewport = document.createElement("div");
  viewport.className = "pdf-export-viewport";
  viewport.setAttribute("aria-hidden", "true");
  viewport.style.cssText = [
    "position: fixed",
    "left: -10000px",
    "top: 0",
    `width: ${PDF_RENDER_WIDTH_PX}px`,
    `height: ${height}px`,
    "overflow: hidden",
    "opacity: 1",
    "pointer-events: none",
    "z-index: -1",
    "background: #ffffff",
  ].join("; ");

  const clone = source.cloneNode(true) as HTMLElement;
  clone.style.cssText = [
    "position: relative",
    "left: 0",
    "top: 0",
    `width: ${PDF_RENDER_WIDTH_PX}px`,
    "margin: 0",
    "opacity: 1",
    "pointer-events: none",
    `transform: translateY(-${startY}px)`,
    "background: #ffffff",
  ].join("; ");

  viewport.appendChild(clone);
  document.body.appendChild(viewport);

  try {
    await waitForLayout();
    const canvas = await html2canvas(viewport, {
      scale: PDF_CAPTURE_SCALE,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      width: PDF_RENDER_WIDTH_PX,
      height,
      windowWidth: PDF_RENDER_WIDTH_PX,
      windowHeight: height,
      x: 0,
      y: 0,
    });

    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error("Não foi possível capturar o conteúdo para o PDF.");
    }
    return canvas;
  } finally {
    viewport.remove();
  }
}

type JsPdfLike = {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  addImage: (
    imageData: string,
    format: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => void;
  addPage: () => void;
  save: (filename: string) => void;
};

export async function buildPdfFromPageCanvases(
  pageCanvases: HTMLCanvasElement[],
  filename: string,
  createPdf: () => Promise<JsPdfLike> = async () => {
    const { jsPDF } = await import("jspdf");
    return new jsPDF({
      unit: "pt",
      format: "a4",
      orientation: "portrait",
    }) as unknown as JsPdfLike;
  },
): Promise<void> {
  if (pageCanvases.length === 0) {
    throw new Error("Não foi possível capturar o conteúdo para o PDF.");
  }

  const pdf = await createPdf();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = PDF_PAGE_MARGIN_PT;
  const contentWidth = pageWidth - margin * 2;

  pageCanvases.forEach((canvas, pageIndex) => {
    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error("Não foi possível capturar o conteúdo para o PDF.");
    }
    if (pageIndex > 0) pdf.addPage();
    const drawHeightPt = (canvas.height * contentWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(
      imgData,
      PDF_IMAGE_FORMAT,
      margin,
      margin,
      contentWidth,
      Math.min(drawHeightPt, pageHeight - margin * 2),
    );
  });

  pdf.save(`${sanitizeFilename(filename)}.pdf`);
}

async function captureToPdf(
  container: HTMLElement,
  filename: string,
): Promise<void> {
  const pageHeightCss = getPageHeightCss();
  const contentHeight = Math.max(
    container.scrollHeight,
    container.getBoundingClientRect().height,
    1,
  );

  const breakPoints = collectPdfBreakPointsCss(container, pageHeightCss);
  const atomicRegions = collectAtomicRegionsCss(container).filter(
    (region) => region.bottom - region.top <= pageHeightCss,
  );

  const ranges = planPdfPageRanges(
    contentHeight,
    pageHeightCss,
    breakPoints,
    atomicRegions,
  );

  if (ranges.length === 0) {
    throw new Error("Não foi possível capturar o conteúdo para o PDF.");
  }

  const pageCanvases: HTMLCanvasElement[] = [];
  for (const range of ranges) {
    pageCanvases.push(await captureDomPage(container, range.start, range.end));
  }

  await buildPdfFromPageCanvases(pageCanvases, filename);
}

/**
 * Renders markdown to a light-themed, sanitized HTML snapshot and downloads an A4 PDF.
 * Client-side raster export (html2canvas + jsPDF); API kept stable for callers.
 */
export async function exportMarkdownToPdf(
  markdown: string,
  filename = "mdPreviewPortal",
): Promise<void> {
  if (!markdown.trim()) {
    throw new Error("Não há conteúdo para exportar.");
  }

  const bodyHtml = await renderMarkdownHtml(markdown, {
    codeTheme: "light",
    highlight: true,
  });
  const container = createExportContainer(bodyHtml);

  try {
    await waitForLayout();
    await captureToPdf(container, filename);
  } finally {
    container.remove();
    removePdfStyles();
  }
}
