import rehypePrettyCode from "rehype-pretty-code";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import type { Element, Root, RootContent } from "hast";
import type { Schema } from "hast-util-sanitize";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import type { PluggableList } from "unified";
import { unified } from "unified";
import { rehypeMermaid } from "@/lib/rehypeMermaid";
import {
  getUtf8ByteLength,
  LARGE_DOCUMENT_BYTES,
} from "@/lib/documentMetrics";

export const SAMPLE_MARKDOWN = `# Olá, Markdown

Escreva aqui e veja o preview **ao vivo**.

| Coluna A | Coluna B |
| -------- | -------- |
| React    | Next.js  |

\`\`\`ts
const preview = live();
\`\`\`

- [x] Task list GFM
- [ ] Outro item
`;

export const PREVIEW_DEBOUNCE_MS = 150;
export const PREVIEW_DEBOUNCE_LARGE_MS = 500;

/** Schema allows language classes on code before pretty-code runs. */
export const sanitizeSchema: Schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ["className", /^language-./],
    ],
  },
};

export const remarkPlugins: PluggableList = [remarkGfm];

export function isRemoteMarkdownImageSource(source: unknown): boolean {
  if (typeof source !== "string") return false;
  return /^(?:https?:)?\/\//i.test(source.trim());
}

function blockRemoteImages(node: Root | Element): void {
  node.children = node.children.map((child): RootContent => {
    if (child.type !== "element") return child;

    if (
      child.tagName === "img" &&
      isRemoteMarkdownImageSource(child.properties.src)
    ) {
      const alt = child.properties.alt;
      const label =
        typeof alt === "string" && alt.trim()
          ? `Imagem remota bloqueada: ${alt.trim()}`
          : "Imagem remota bloqueada";

      return {
        type: "element",
        tagName: "span",
        properties: {
          className: ["remote-image-blocked"],
          "data-remote-image-blocked": "",
          role: "note",
        },
        children: [{ type: "text", value: `[${label}]` }],
      };
    }

    blockRemoteImages(child);
    return child;
  });
}

/** Prevents Markdown from making third-party requests without user consent. */
function rehypeBlockRemoteImages() {
  return (tree: Root) => blockRemoteImages(tree);
}

const prettyCodeOptions = {
  theme: {
    light: "github-light",
    dark: "github-dark",
  },
  defaultLang: "plaintext",
} as const;

const prettyCodeLightOptions = {
  theme: "github-light",
  defaultLang: "plaintext",
} as const;

export function isLargeDocument(content: string): boolean {
  return getUtf8ByteLength(content) > LARGE_DOCUMENT_BYTES;
}

export function getPreviewDebounceMs(content: string): number {
  return isLargeDocument(content)
    ? PREVIEW_DEBOUNCE_LARGE_MS
    : PREVIEW_DEBOUNCE_MS;
}

/** Preview: sanitize first, then pull out mermaid fences before pretty-code
 * (which has no mermaid grammar) touches them; pretty-code only when highlight is enabled. */
export function getRehypePlugins(options?: {
  highlight?: boolean;
}): PluggableList {
  const highlight = options?.highlight ?? true;
  const plugins: PluggableList = [
    [rehypeSanitize, sanitizeSchema],
    rehypeBlockRemoteImages,
    rehypeMermaid,
  ];
  if (highlight) {
    plugins.push([rehypePrettyCode, prettyCodeOptions]);
  }
  return plugins;
}

export const rehypePlugins: PluggableList = getRehypePlugins({
  highlight: true,
});

export async function renderMarkdownHtml(
  source: string,
  options?: { codeTheme?: "light" | "dual"; highlight?: boolean },
): Promise<string> {
  const prettyCodeConfig =
    options?.codeTheme === "light" ? prettyCodeLightOptions : prettyCodeOptions;
  const highlight = options?.highlight ?? true;

  let processor = unified()
    .use(remarkParse)
    .use(remarkPlugins)
    // Sem rehype-raw: HTML cru não vira nós; false evita superfície extra se raw for adicionado depois.
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeBlockRemoteImages)
    .use(rehypeMermaid);

  if (highlight) {
    processor = processor.use(rehypePrettyCode, prettyCodeConfig);
  }

  const file = await processor.use(rehypeStringify).process(source);
  return String(file);
}
