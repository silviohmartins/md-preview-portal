"use client";

import { useMemo } from "react";
import { MarkdownHooks } from "react-markdown";
import { PreviewErrorBoundary } from "@/components/PreviewErrorBoundary";
import { getRehypePlugins, remarkPlugins } from "@/lib/markdown";

type PreviewProps = {
  markdown: string;
  /** When false, skips Shiki/pretty-code for large documents. */
  highlight?: boolean;
};

export function Preview({ markdown, highlight = true }: PreviewProps) {
  const plugins = useMemo(
    () => ({
      remarkPlugins,
      rehypePlugins: getRehypePlugins({ highlight }),
    }),
    [highlight],
  );

  if (!markdown.trim()) {
    return (
      <p className="p-4 text-sm italic text-muted">
        O preview aparece aqui quando você digitar markdown.
      </p>
    );
  }

  return (
    <PreviewErrorBoundary resetKey={`${highlight}:${markdown}`}>
      <article className="preview-prose p-4 md:p-6">
        <MarkdownHooks
          remarkPlugins={plugins.remarkPlugins}
          rehypePlugins={plugins.rehypePlugins}
          fallback={
            <p className="text-sm text-muted">Renderizando preview…</p>
          }
        >
          {markdown}
        </MarkdownHooks>
      </article>
    </PreviewErrorBoundary>
  );
}
