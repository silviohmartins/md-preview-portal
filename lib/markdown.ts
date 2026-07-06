import rehypePrettyCode from "rehype-pretty-code";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import type { Schema } from "hast-util-sanitize";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import type { PluggableList } from "unified";
import { unified } from "unified";

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

const prettyCodeOptions = {
  theme: {
    light: "github-light",
    dark: "github-dark",
  },
  defaultLang: "plaintext",
} as const;

export const rehypePlugins: PluggableList = [
  [rehypeSanitize, sanitizeSchema],
  [rehypePrettyCode, prettyCodeOptions],
];

export function isLargeDocument(content: string): boolean {
  return new Blob([content]).size > 50 * 1024;
}

const prettyCodeLightOptions = {
  theme: "github-light",
  defaultLang: "plaintext",
} as const;

export async function renderMarkdownHtml(
  source: string,
  options?: { codeTheme?: "light" | "dual" },
): Promise<string> {
  const prettyCodeConfig =
    options?.codeTheme === "light" ? prettyCodeLightOptions : prettyCodeOptions;

  const file = await unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypePrettyCode, prettyCodeConfig)
    .use(rehypeStringify)
    .process(source);

  return String(file);
}
