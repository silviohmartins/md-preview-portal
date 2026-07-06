import { describe, expect, it } from "vitest";
import { rehypePlugins, remarkPlugins, renderMarkdownHtml, sanitizeSchema } from "./markdown";

describe("markdown pipeline", () => {
  it("renders GFM table", async () => {
    const html = await renderMarkdownHtml("| A | B |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain("<table");
    expect(html).toContain("<td");
  });

  it("strips script tags (XSS)", async () => {
    const html = await renderMarkdownHtml(
      '<script>alert("xss")</script>\n\nSafe text',
    );
    expect(html.toLowerCase()).not.toContain("<script");
    expect(html).toContain("Safe text");
  });

  it("renders fenced code blocks with highlight markup", async () => {
    const html = await renderMarkdownHtml("```ts\nconst x = 1;\n```");
    expect(html).toContain("<code");
    expect(html).toContain("const");
  });

  it("renders task list", async () => {
    const html = await renderMarkdownHtml("- [x] Done\n- [ ] Todo");
    expect(html).toContain("checkbox");
  });

  it("exports sanitize schema with language classes on code", () => {
    const codeAttrs = sanitizeSchema.attributes?.code ?? [];
    const hasLanguage = codeAttrs.some(
      (attr) => Array.isArray(attr) && attr[0] === "className",
    );
    expect(hasLanguage).toBe(true);
  });

  it("exports plugin lists for react-markdown", () => {
    expect(remarkPlugins.length).toBeGreaterThan(0);
    expect(rehypePlugins.length).toBeGreaterThan(0);
  });
});
