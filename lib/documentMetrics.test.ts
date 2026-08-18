import { describe, expect, it, vi } from "vitest";
import {
  calculateDocumentMetrics,
  formatByteSize,
  getUtf8ByteLength,
} from "./documentMetrics";

describe("document metrics", () => {
  it.each([
    [50 * 1024, false, false],
    [500 * 1024, true, false],
    [5 * 1024 * 1024, true, true],
  ] as const)(
    "measures a %i-byte Markdown document without constructing Blob objects",
    (size, isLarge, isVeryLarge) => {
      const blobSpy = vi.spyOn(globalThis, "Blob");
      const metrics = calculateDocumentMetrics("a".repeat(size));

      expect(metrics).toMatchObject({ bytes: size, isLarge, isVeryLarge });
      expect(blobSpy).not.toHaveBeenCalled();
      blobSpy.mockRestore();
    },
  );

  it("counts UTF-8 bytes instead of UTF-16 code units", () => {
    expect(getUtf8ByteLength("ação 🚀")).toBe(11);
  });

  it("formats byte sizes for the status bar", () => {
    expect(formatByteSize(512)).toBe("512 B");
    expect(formatByteSize(50 * 1024)).toBe("50 KB");
    expect(formatByteSize(5 * 1024 * 1024)).toBe("5 MB");
  });
});
