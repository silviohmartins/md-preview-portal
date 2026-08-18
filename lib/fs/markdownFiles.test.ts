import { describe, expect, it } from "vitest";
import {
  basename,
  isMarkdownFileName,
  normalizeRelativePath,
} from "@/lib/fs/markdownFiles";

describe("isMarkdownFileName", () => {
  it("accepts md and markdown extensions", () => {
    expect(isMarkdownFileName("readme.md")).toBe(true);
    expect(isMarkdownFileName("NOTES.Markdown")).toBe(true);
    expect(isMarkdownFileName("a/b/c.MD")).toBe(true);
  });

  it("rejects other extensions", () => {
    expect(isMarkdownFileName("readme.txt")).toBe(false);
    expect(isMarkdownFileName("image.png")).toBe(false);
    expect(isMarkdownFileName("md")).toBe(false);
  });
});

describe("basename", () => {
  it("returns the last path segment", () => {
    expect(basename("docs/guide.md")).toBe("guide.md");
    expect(basename("guide.md")).toBe("guide.md");
    expect(basename("a\\b\\c.md")).toBe("c.md");
  });
});

describe("normalizeRelativePath", () => {
  it("normalizes separators and dot segments", () => {
    expect(normalizeRelativePath("docs\\guides\\intro.md")).toBe(
      "docs/guides/intro.md",
    );
    expect(normalizeRelativePath("./docs//guide.md")).toBe("docs/guide.md");
  });

  it("keeps parent traversal inside the relative root", () => {
    expect(normalizeRelativePath("docs/../readme.md")).toBe("readme.md");
    expect(normalizeRelativePath("../../readme.md")).toBe("readme.md");
  });
});
