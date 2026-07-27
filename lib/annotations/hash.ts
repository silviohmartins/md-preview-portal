/**
 * Stable, non-cryptographic hash for document keys (localStorage).
 * FNV-1a 32-bit over UTF-16 code units — deterministic across sessions.
 */
export function hashMarkdown(content: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function annotationStorageKey(documentHash: string): string {
  return `md-annotations:${documentHash}`;
}
