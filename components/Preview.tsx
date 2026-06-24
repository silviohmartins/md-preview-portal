"use client";

import { useMemo } from "react";
import { MarkdownHooks } from "react-markdown";
import { rehypePlugins, remarkPlugins } from "@/lib/markdown";

type PreviewProps = {
  markdown: string;
  error: string | null;
};

export function Preview({ markdown, error }: PreviewProps) {
  const plugins = useMemo(
    () => ({ remarkPlugins, rehypePlugins }),
    [],
  );

  if (error) {
    return (
      <div className="p-4 text-sm text-red-600 dark:text-red-400">
        <p className="font-medium">Erro ao renderizar</p>
        <p className="mt-1 text-[var(--muted)]">{error}</p>
      </div>
    );
  }

  if (!markdown.trim()) {
    return (
      <p className="p-4 text-sm italic text-[var(--muted)]">
        O preview aparece aqui quando você digitar markdown.
      </p>
    );
  }

  return (
    <article className="preview-prose p-4 md:p-6">
      <MarkdownHooks
        remarkPlugins={plugins.remarkPlugins}
        rehypePlugins={plugins.rehypePlugins}
        fallback={
          <p className="text-sm text-[var(--muted)]">Renderizando preview…</p>
        }
      >
        {markdown}
      </MarkdownHooks>
    </article>
  );
}
