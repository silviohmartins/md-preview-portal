import { describe, expect, it } from "vitest";
import { basename, isMarkdownFileName } from "@/lib/fs/markdownFiles";

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
