import { PDF_PAGE_MARGIN_PT, PDF_RENDER_WIDTH_PX } from "./shared";

const BREAK_SELECTOR = [
  "tr", "thead", "tbody", "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "pre", "li", "blockquote", "table", "hr", "ul", "ol",
  "img", ".mermaid-diagram",
].join(", ");
const ATOMIC_SELECTOR =
  "tr, thead, pre, h1, h2, h3, h4, h5, h6, img, .mermaid-diagram";

type PdfAtomicRegion = { top: number; bottom: number };
type PdfPageRange = { start: number; end: number };

export function getPageHeightCss(): number {
  const contentWidthPt = 595 - PDF_PAGE_MARGIN_PT * 2;
  const contentHeightPt = 842 - PDF_PAGE_MARGIN_PT * 2;
  return (contentHeightPt * PDF_RENDER_WIDTH_PX) / contentWidthPt;
}

function addPoint(points: Set<number>, value: number): void {
  if (Number.isFinite(value)) points.add(Math.max(0, value));
}

function isInsideAtomicRegion(y: number, regions: PdfAtomicRegion[]): boolean {
  return regions.some((region) => y > region.top && y < region.bottom);
}

function findAtomicRegionAt(y: number, regions: PdfAtomicRegion[]) {
  return regions.find((region) => y > region.top && y < region.bottom) ?? null;
}

export function collectAtomicRegionsCss(container: HTMLElement): PdfAtomicRegion[] {
  const containerRect = container.getBoundingClientRect();
  const regions: PdfAtomicRegion[] = [];
  container.querySelectorAll(ATOMIC_SELECTOR).forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const rect = node.getBoundingClientRect();
    const top = rect.top - containerRect.top;
    const bottom = rect.bottom - containerRect.top;
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom - top < 1) return;
    regions.push({ top: Math.max(0, top), bottom: Math.max(0, bottom) });
  });
  return regions.sort((a, b) => a.top - b.top);
}

function collectLineBoxBreakPoints(
  container: HTMLElement,
  containerTop: number,
  points: Set<number>,
  atomicRegions: PdfAtomicRegion[],
): void {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.tagName === "SCRIPT" || parent.tagName === "STYLE") {
        return NodeFilter.FILTER_REJECT;
      }
      if (!(node.textContent ?? "").trim() || parent.closest("tr, thead")) {
        return NodeFilter.FILTER_REJECT;
      }
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
        if (isInsideAtomicRegion(bottom - 0.5, atomicRegions)) continue;
        addPoint(points, top);
        addPoint(points, bottom);
      }
    } catch {
      // Some environments expose incomplete Range layout APIs.
    }
    textNode = walker.nextNode();
  }
}

function collectOversizedRegionLineBreaks(
  container: HTMLElement,
  containerTop: number,
  points: Set<number>,
  oversizedRegions: PdfAtomicRegion[],
): void {
  if (oversizedRegions.length === 0 || typeof document.createRange !== "function") return;
  const range = document.createRange();
  if (typeof range.getClientRects !== "function") return;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent?.closest("pre") || !(node.textContent ?? "").trim()) {
        return NodeFilter.FILTER_REJECT;
      }
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
        const bottom = rect.bottom - containerTop;
        if (rect.height >= 0.5 && isInsideAtomicRegion(bottom - 0.5, oversizedRegions)) {
          addPoint(points, bottom);
        }
      }
    } catch {
      // jsdom / incomplete Range
    }
    textNode = walker.nextNode();
  }
}

export function collectPdfBreakPointsCss(container: HTMLElement, pageHeightCss?: number): number[] {
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
  const protectedRegions = pageHeightCss && pageHeightCss > 0
    ? atomicRegions.filter((region) => region.bottom - region.top <= pageHeightCss)
    : atomicRegions;
  collectLineBoxBreakPoints(container, containerRect.top, points, protectedRegions);
  if (pageHeightCss && pageHeightCss > 0) {
    collectOversizedRegionLineBreaks(
      container,
      containerRect.top,
      points,
      atomicRegions.filter((region) => region.bottom - region.top > pageHeightCss),
    );
  }
  return [...points]
    .filter((y) => !isInsideAtomicRegion(y, protectedRegions))
    .sort((a, b) => a - b);
}

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
  const regionFits = hit !== null && hit.bottom - hit.top <= idealEnd - sourceY + 1;
  if (hit && hit.top > sourceY && regionFits) return hit.top;
  const insideFromStart = findAtomicRegionAt(sourceY + 1, atomicRegions);
  let bestAtOrBefore = -1;
  let firstAfter = -1;
  for (const point of breakPoints) {
    if (point <= sourceY) continue;
    const insideOther = isInsideAtomicRegion(point, atomicRegions) && !(
      insideFromStart && point > insideFromStart.top && point < insideFromStart.bottom
    );
    if (insideOther) continue;
    if (point <= hardEnd) {
      bestAtOrBefore = point;
      continue;
    }
    if (firstAfter < 0) firstAfter = point;
    break;
  }
  if (bestAtOrBefore > sourceY) return bestAtOrBefore;
  if (hit && hit.top > sourceY) return hit.top;
  if (firstAfter > sourceY && firstAfter - hardEnd <= 40) {
    const insideOther = isInsideAtomicRegion(firstAfter, atomicRegions) && !(
      insideFromStart && firstAfter > insideFromStart.top && firstAfter < insideFromStart.bottom
    );
    if (!insideOther) return Math.min(firstAfter, contentHeight);
  }
  return hardEnd;
}

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
    const end = choosePageEnd(
      start,
      Math.min(start + usablePageHeight, contentHeight),
      contentHeight,
      sortedBreaks,
      atomicRegions,
    );
    ranges.push({ start, end: Math.min(Math.max(end, start + 1), contentHeight) });
    start = ranges[ranges.length - 1]!.end;
  }
  return ranges;
}

export function measureAndPaginatePdf(container: HTMLElement): PdfPageRange[] {
  const pageHeightCss = getPageHeightCss();
  const contentHeight = Math.max(container.scrollHeight, container.getBoundingClientRect().height, 1);
  return planPdfPageRanges(
    contentHeight,
    pageHeightCss,
    collectPdfBreakPointsCss(container, pageHeightCss),
    collectAtomicRegionsCss(container).filter(
      (region) => region.bottom - region.top <= pageHeightCss,
    ),
  );
}
