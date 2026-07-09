import { describe, expect, it } from "vitest";
import { countWords } from "./wordCount";

describe("countWords", () => {
  it("counts words in trimmed text", () => {
    expect(countWords("olá mundo")).toBe(2);
    expect(countWords("  um   dois  três ")).toBe(3);
  });

  it("returns 0 for empty or whitespace", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});
