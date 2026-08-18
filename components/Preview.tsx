"use client";

import { useMemo } from "react";
import { MarkdownHooks, type Components } from "react-markdown";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { PreviewErrorBoundary } from "@/components/PreviewErrorBoundary";
import { getRehypePlugins, remarkPlugins } from "@/lib/markdown";

const components: Components = {
  div({ node, ...props }) {
    void node;
    const source = (props as Record<string, unknown>)["data-mermaid-source"];
    if (typeof source === "string") {
      return <MermaidDiagram code={source} />;
    }
    return <div {...props} />;
  },
};

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
      <article className="preview-prose mx-auto w-full max-w-[80ch] p-5 md:p-8">
        <MarkdownHooks
          remarkPlugins={plugins.remarkPlugins}
          rehypePlugins={plugins.rehypePlugins}
          components={components}
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
