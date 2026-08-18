"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { copyTextToClipboard } from "@/lib/clipboard";

type CopyStatus = "idle" | "copied" | "error";

export function useCopyMarkdown(text: string) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const canCopy = text.length > 0;

  const copy = useCallback(async () => {
    if (!canCopy) return;
    const ok = await copyTextToClipboard(text);
    setCopyStatus(ok ? "copied" : "error");
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => setCopyStatus("idle"), 2000);
  }, [canCopy, text]);

  const copyButtonLabel =
    copyStatus === "copied"
      ? "Copiado!"
      : copyStatus === "error"
        ? "Falha ao copiar"
        : "Copiar conteúdo do editor";

  return { copy, canCopy, copyStatus, copyButtonLabel };
}
