/** Maps source scroll position to the equivalent target scrollTop by ratio. */
export function getSyncedScrollTop(
  source: { scrollTop: number; scrollHeight: number; clientHeight: number },
  target: { scrollHeight: number; clientHeight: number },
): number {
  const sourceMax = source.scrollHeight - source.clientHeight;
  const targetMax = target.scrollHeight - target.clientHeight;

  if (sourceMax <= 0 || targetMax <= 0) return 0;

  const ratio = source.scrollTop / sourceMax;
  return ratio * targetMax;
}

export function attachScrollSync(
  left: HTMLElement,
  right: HTMLElement,
): () => void {
  let syncing = false;

  const syncFrom = (source: HTMLElement, target: HTMLElement) => {
    if (syncing) return;
    syncing = true;
    target.scrollTop = getSyncedScrollTop(source, target);
    requestAnimationFrame(() => {
      syncing = false;
    });
  };

  const onLeftScroll = () => syncFrom(left, right);
  const onRightScroll = () => syncFrom(right, left);

  left.addEventListener("scroll", onLeftScroll, { passive: true });
  right.addEventListener("scroll", onRightScroll, { passive: true });

  // Align once when sync is enabled.
  syncFrom(left, right);

  return () => {
    left.removeEventListener("scroll", onLeftScroll);
    right.removeEventListener("scroll", onRightScroll);
  };
}
