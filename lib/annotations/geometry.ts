import type {
  AnnotationDocumentSize,
  Stroke,
  StrokePoint,
} from "@/lib/annotations/types";

/**
 * Convert pointer client coordinates to document space of a content wrapper
 * that lives inside a scroll container.
 *
 * Uses the content element's bounding rect only: when the parent is scrolled,
 * getBoundingClientRect already shifts, so scroll offsets must not be added again.
 */
export function clientToDocumentPoint(
  clientX: number,
  clientY: number,
  contentEl: HTMLElement,
  _scrollEl?: HTMLElement,
): { x: number; y: number } {
  void _scrollEl;
  const rect = contentEl.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

/** Measure overlay size matching scrollable content. */
export function measureContentSize(contentEl: HTMLElement): {
  width: number;
  height: number;
} {
  return {
    width: Math.max(contentEl.scrollWidth, contentEl.offsetWidth),
    height: Math.max(contentEl.scrollHeight, contentEl.offsetHeight),
  };
}

export function normalizeDocumentPoint(
  point: StrokePoint,
  size: AnnotationDocumentSize,
): StrokePoint {
  return {
    x: size.width > 0 ? point.x / size.width : 0,
    y: size.height > 0 ? point.y / size.height : 0,
    ...(point.p === undefined ? {} : { p: point.p }),
  };
}

export function scaleStrokePoint(
  stroke: Stroke,
  point: StrokePoint,
  targetSize: AnnotationDocumentSize,
): StrokePoint {
  if (!stroke.documentSize) return point;
  return {
    x: point.x * targetSize.width,
    y: point.y * targetSize.height,
    ...(point.p === undefined ? {} : { p: point.p }),
  };
}

export function scaleStrokeWidth(
  stroke: Stroke,
  targetSize: AnnotationDocumentSize,
): number {
  if (!stroke.documentSize) return stroke.width;
  const xScale = targetSize.width / stroke.documentSize.width;
  const yScale = targetSize.height / stroke.documentSize.height;
  return stroke.width * Math.max(0.25, Math.min(xScale, yScale, 4));
}
