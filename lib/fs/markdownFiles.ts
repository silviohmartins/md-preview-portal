const MARKDOWN_EXT = /\.(md|markdown)$/i;

export function isMarkdownFileName(name: string): boolean {
  return MARKDOWN_EXT.test(name);
}

export function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}
