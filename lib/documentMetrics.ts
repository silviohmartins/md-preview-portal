import { countWords } from "@/lib/wordCount";

export const LARGE_DOCUMENT_BYTES = 50 * 1024;
const VERY_LARGE_DOCUMENT_BYTES = 1024 * 1024;

export type DocumentMetrics = {
  bytes: number;
  words: number;
  isLarge: boolean;
  isVeryLarge: boolean;
};

const byteSizeFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

export function getUtf8ByteLength(content: string): number {
  let bytes = 0;
  for (let index = 0; index < content.length; index += 1) {
    const code = content.charCodeAt(index);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      index + 1 < content.length &&
      content.charCodeAt(index + 1) >= 0xdc00 &&
      content.charCodeAt(index + 1) <= 0xdfff
    ) {
      bytes += 4;
      index += 1;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

export function calculateDocumentMetrics(content: string): DocumentMetrics {
  const bytes = getUtf8ByteLength(content);
  return {
    bytes,
    words: countWords(content),
    isLarge: bytes > LARGE_DOCUMENT_BYTES,
    isVeryLarge: bytes > VERY_LARGE_DOCUMENT_BYTES,
  };
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatUnit(bytes / 1024)} KB`;
  return `${formatUnit(bytes / (1024 * 1024))} MB`;
}

function formatUnit(value: number): string {
  if (value >= 10) return Math.round(value).toLocaleString("pt-BR");
  return byteSizeFormatter.format(value);
}
