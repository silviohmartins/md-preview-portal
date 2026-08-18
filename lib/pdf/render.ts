import {
  PDF_RENDER_WIDTH_PX,
  PDF_STYLE_ID,
  throwIfPdfExportCancelled,
} from "./shared";

const PDF_CSS = `
  .pdf-export-root { box-sizing: border-box; width: ${PDF_RENDER_WIDTH_PX}px; padding: 24px 32px; font-family: system-ui, -apple-system, sans-serif; color: #1a1a1a !important; background: #fff !important; line-height: 1.65; }
  .pdf-export-root *, .pdf-export-root *::before, .pdf-export-root *::after { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pdf-export-root .preview-prose { font-size: 15px; max-width: none; color: #1a1a1a !important; }
  .pdf-export-root .preview-prose h1, .pdf-export-root .preview-prose h2, .pdf-export-root .preview-prose h3, .pdf-export-root .preview-prose h4, .pdf-export-root .preview-prose p, .pdf-export-root .preview-prose li, .pdf-export-root .preview-prose th, .pdf-export-root .preview-prose td { color: #1a1a1a !important; }
  .pdf-export-root .preview-prose h1 { font-size: 1.75em; font-weight: 700; margin: 0 0 .5em; padding-bottom: .25em; border-bottom: 1px solid #d4d4d4; }
  .pdf-export-root .preview-prose h2 { font-size: 1.35em; font-weight: 600; margin: 1.25em 0 .5em; }
  .pdf-export-root .preview-prose h3 { font-size: 1.15em; font-weight: 600; margin: 1em 0 .4em; }
  .pdf-export-root .preview-prose p { margin: .75em 0; }
  .pdf-export-root .preview-prose a { color: #2563eb !important; text-decoration: underline; }
  .pdf-export-root .preview-prose pre { overflow: visible; border-radius: 6px; margin: 1em 0; padding: 0; background: #f5f5f5 !important; border: 1px solid #d4d4d4; white-space: pre-wrap; word-break: break-word; }
  .pdf-export-root .preview-prose pre code { display: block; padding: 12px 16px; font-size: 13px; font-family: ui-monospace, "Cascadia Code", "Segoe UI Mono", monospace; background: #f5f5f5 !important; }
  .pdf-export-root .preview-prose :not(pre) > code { background: #f5f5f5 !important; padding: .15em .35em; border-radius: 4px; font-size: .9em; font-family: ui-monospace, "Cascadia Code", "Segoe UI Mono", monospace; }
  .pdf-export-root .preview-prose table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
  .pdf-export-root .preview-prose th, .pdf-export-root .preview-prose td { border: 1px solid #d4d4d4; padding: 8px 12px; text-align: left; vertical-align: top; }
  .pdf-export-root .preview-prose th { background: #eee !important; font-weight: 600; }
  .pdf-export-root .preview-prose ul, .pdf-export-root .preview-prose ol { margin: .75em 0; padding-left: 1.5em; }
  .pdf-export-root .preview-prose blockquote { border-left: 4px solid #d4d4d4; margin: 1em 0; padding-left: 1em; color: #737373 !important; }
  .pdf-export-root .preview-prose input[type="checkbox"] { margin-right: .4em; }
  .pdf-export-root .preview-prose img, .pdf-export-root .mermaid-diagram svg { display: block; max-width: 100%; height: auto; }
  .pdf-export-root .mermaid-diagram { margin: 1em 0; text-align: center; }
  .pdf-export-root .pdf-image-error { display: block; padding: .75em; border: 1px dashed #a3a3a3; color: #525252 !important; }
`;

export async function waitForPdfLayout(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  await new Promise<void>((resolve) => window.setTimeout(resolve, 80));
}

function injectPdfStyles(): void {
  if (document.getElementById(PDF_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PDF_STYLE_ID;
  style.textContent = PDF_CSS;
  document.head.appendChild(style);
}

function replaceFailedImage(image: HTMLImageElement): void {
  const replacement = document.createElement("span");
  replacement.className = "pdf-image-error";
  replacement.textContent = image.alt.trim()
    ? `[Imagem não disponível: ${image.alt.trim()}]`
    : "[Imagem não disponível]";
  image.replaceWith(replacement);
}

function waitForImage(
  image: HTMLImageElement,
  signal?: AbortSignal,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      image.removeEventListener("load", onLoad);
      image.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
      resolve(loaded);
    };
    const decode = async () => {
      try {
        if (typeof image.decode === "function") await image.decode();
        finish(image.naturalWidth > 0);
      } catch {
        finish(false);
      }
    };
    const onLoad = () => void decode();
    const onError = () => finish(false);
    const onAbort = () => finish(false);
    const timeoutId = window.setTimeout(() => finish(false), 5_000);

    signal?.addEventListener("abort", onAbort, { once: true });
    image.addEventListener("load", onLoad, { once: true });
    image.addEventListener("error", onError, { once: true });
    if (signal?.aborted) onAbort();
    else if (image.complete) void decode();
  });
}

async function waitForImages(
  container: HTMLElement,
  signal?: AbortSignal,
): Promise<void> {
  await Promise.all(
    Array.from(container.querySelectorAll("img")).map(async (image) => {
      throwIfPdfExportCancelled(signal);
      const loaded = await waitForImage(image, signal);
      throwIfPdfExportCancelled(signal);
      if (!loaded) replaceFailedImage(image);
    }),
  );
}

export async function renderPdfMermaidDiagrams(
  container: HTMLElement,
  signal?: AbortSignal,
): Promise<void> {
  const placeholders = Array.from(
    container.querySelectorAll<HTMLElement>("[data-mermaid-source]"),
  );
  if (placeholders.length === 0) return;
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "default",
    suppressErrorRendering: true,
  });
  for (let index = 0; index < placeholders.length; index++) {
    throwIfPdfExportCancelled(signal);
    const placeholder = placeholders[index]!;
    const source = placeholder.dataset.mermaidSource ?? "";
    try {
      const { svg } = await mermaid.render(
        `pdf-mermaid-${Date.now()}-${index}`,
        source,
      );
      placeholder.className = "mermaid-diagram";
      placeholder.removeAttribute("data-mermaid-source");
      // Mermaid renders locally with securityLevel=strict.
      placeholder.innerHTML = svg;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "sintaxe inválida";
      placeholder.className = "mermaid-diagram-error";
      placeholder.removeAttribute("data-mermaid-source");
      placeholder.textContent = "";
      const message = document.createElement("p");
      message.className = "mermaid-diagram-error-message";
      message.textContent = `Erro no diagrama Mermaid: ${detail}`;
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = source;
      pre.appendChild(code);
      placeholder.append(message, pre);
    }
  }
}

export async function createPdfRenderContainer(
  bodyHtml: string,
  signal?: AbortSignal,
): Promise<HTMLDivElement> {
  throwIfPdfExportCancelled(signal);
  injectPdfStyles();
  const container = document.createElement("div");
  container.className = "pdf-export-root";
  container.setAttribute("aria-hidden", "true");
  container.style.cssText = [
    "position: fixed", "left: -10000px", "top: 0",
    `width: ${PDF_RENDER_WIDTH_PX}px`, "opacity: 1", "pointer-events: none",
    "z-index: -1", "overflow: visible", "background: #ffffff",
  ].join("; ");
  const article = document.createElement("article");
  article.className = "preview-prose";
  article.innerHTML = bodyHtml;
  container.appendChild(article);
  document.body.appendChild(container);
  try {
    await renderPdfMermaidDiagrams(container, signal);
    await waitForImages(container, signal);
    await waitForPdfLayout();
    throwIfPdfExportCancelled(signal);
    return container;
  } catch (error) {
    container.remove();
    removePdfRenderStyles();
    throw error;
  }
}

export function removePdfRenderStyles(): void {
  document.getElementById(PDF_STYLE_ID)?.remove();
}
