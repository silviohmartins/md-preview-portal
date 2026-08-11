"use client";

import { useEffect, useId, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";

type MermaidDiagramProps = {
  code: string;
};

export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const { mode } = useTheme();
  const rawId = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(null);

    import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: mode === "dark" ? "dark" : "default",
        // Without this, mermaid renders its own "bomb" error graphic into
        // document.body on parse failure instead of just throwing.
        suppressErrorRendering: true,
      });
      try {
        const { svg: rendered } = await mermaid.render(
          `mermaid-${rawId}`,
          code,
        );
        if (!cancelled) setSvg(rendered);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Erro ao renderizar diagrama.",
          );
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [code, mode, rawId]);

  if (error) {
    return (
      <div className="mermaid-diagram-error">
        <p className="mermaid-diagram-error-message">
          Erro no diagrama Mermaid: {error}
        </p>
        <pre>
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  if (!svg) {
    return <p className="text-sm text-muted">Renderizando diagrama…</p>;
  }

  return (
    <div
      className="mermaid-diagram"
      // SVG produced locally by mermaid.render() (securityLevel: "strict"), not raw user HTML.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
