import rehypePrettyCode from "rehype-pretty-code";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Schema } from "hast-util-sanitize";
import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";

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

export const rehypePlugins: PluggableList = [
  [rehypeSanitize, sanitizeSchema],
  [
    rehypePrettyCode,
    {
      theme: {
        light: "github-light",
        dark: "github-dark",
      },
      defaultLang: "plaintext",
    },
  ],
];

export function isLargeDocument(content: string): boolean {
  return new Blob([content]).size > 50 * 1024;
}
