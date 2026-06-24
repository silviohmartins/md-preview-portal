import { describe, expect, it } from "vitest";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { rehypePlugins, remarkPlugins, sanitizeSchema } from "./markdown";

async function renderMarkdownHtml(source: string): Promise<string> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkRehype, { allowDangerousHtml: true });

  for (const plugin of rehypePlugins) {
    if (Array.isArray(plugin)) {
      processor.use(plugin[0], plugin[1]);
    } else {
      processor.use(plugin);
    }
  }

  const file = await processor.use(rehypeStringify).process(source);
  return String(file);
}

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
});
