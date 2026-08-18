import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { LARGE_DOCUMENT_BYTES } from "./documentMetrics";
import {
  getPreviewDebounceMs,
  getRehypePlugins,
  isLargeDocument,
  PREVIEW_DEBOUNCE_LARGE_MS,
  PREVIEW_DEBOUNCE_MS,
  rehypePlugins,
  isRemoteMarkdownImageSource,
  remarkPlugins,
  renderMarkdownHtml,
  sanitizeSchema,
} from "./markdown";

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

  it("strips javascript: URLs (XSS)", async () => {
    const html = await renderMarkdownHtml("[click](javascript:alert(1))");
    expect(html.toLowerCase()).not.toContain("javascript:");
  });

  it("strips event handlers from raw-looking HTML (XSS)", async () => {
    const html = await renderMarkdownHtml('<img src=x onerror="alert(1)">');
    expect(html.toLowerCase()).not.toContain("onerror");
  });

  it("strips iframe tags (XSS)", async () => {
    const html = await renderMarkdownHtml(
      '<iframe src="https://evil.example"></iframe>\n\nSafe',
    );
    expect(html.toLowerCase()).not.toContain("<iframe");
    expect(html).toContain("Safe");
  });

  it("blocks remote Markdown images without making a third-party request", async () => {
    const html = await renderMarkdownHtml(
      "![Diagrama](https://cdn.example.com/diagram.png)",
    );

    expect(html).not.toContain("https://cdn.example.com");
    expect(html).not.toContain("<img");
    expect(html).toContain("Imagem remota bloqueada: Diagrama");
  });

  it("keeps self-hosted Markdown images", async () => {
    const html = await renderMarkdownHtml("![Logo](/logo.png)");

    expect(html).toContain('<img src="/logo.png" alt="Logo">');
  });

  it("recognizes absolute and protocol-relative remote image sources", () => {
    expect(isRemoteMarkdownImageSource("https://example.com/image.png")).toBe(
      true,
    );
    expect(isRemoteMarkdownImageSource("//example.com/image.png")).toBe(true);
    expect(isRemoteMarkdownImageSource("/image.png")).toBe(false);
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

  it("getRehypePlugins omits pretty-code when highlight is false", () => {
    const withoutHighlight = getRehypePlugins({ highlight: false });
    const withHighlight = getRehypePlugins({ highlight: true });
    expect(withHighlight.length).toBe(withoutHighlight.length + 1);
  });

  it("extracts mermaid fences into a data-mermaid-source placeholder", async () => {
    const file = await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(getRehypePlugins({ highlight: false }))
      .use(rehypeStringify)
      .process("```mermaid\ngraph TD;\nA-->B;\n```");
    const html = String(file);
    expect(html).toContain("data-mermaid-source");
    expect(html).toContain("graph TD;");
    expect(html).not.toContain("<pre");
  });

  it("preserves Mermaid placeholders in the HTML used by PDF export", async () => {
    const html = await renderMarkdownHtml(
      "```mermaid\ngraph TD;\nA-->B;\n```",
      { codeTheme: "light", highlight: true },
    );

    expect(html).toContain("data-mermaid-source");
    expect(html).toContain("graph TD;");
    expect(html).not.toContain("<pre");
  });

  it("renderMarkdownHtml can skip highlight", async () => {
    const html = await renderMarkdownHtml("```ts\nconst x = 1;\n```", {
      highlight: false,
    });
    expect(html).toContain("<code");
    expect(html).toContain("const");
    expect(html).not.toContain('data-theme="github');
  });

  it("adapts debounce for large documents", () => {
    const small = "# hi";
    const large = "x".repeat(LARGE_DOCUMENT_BYTES + 1);
    expect(isLargeDocument(small)).toBe(false);
    expect(isLargeDocument(large)).toBe(true);
    expect(getPreviewDebounceMs(small)).toBe(PREVIEW_DEBOUNCE_MS);
    expect(getPreviewDebounceMs(large)).toBe(PREVIEW_DEBOUNCE_LARGE_MS);
  });
});
