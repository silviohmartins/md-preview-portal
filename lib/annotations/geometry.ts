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
