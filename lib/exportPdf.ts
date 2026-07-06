import html2canvas from "html2canvas";
import { renderMarkdownHtml } from "@/lib/markdown";

const PDF_STYLE_ID = "pdf-export-styles";

const PDF_CSS = `
  .pdf-export-root {
    box-sizing: border-box;
    width: 794px;
    padding: 24px 32px;
    font-family: system-ui, -apple-system, sans-serif;
    color: #1a1a1a !important;
    background: #ffffff !important;
    line-height: 1.65;
  }
  .pdf-export-root .preview-prose {
    font-size: 15px;
    max-width: none;
    color: #1a1a1a !important;
  }
  .pdf-export-root .preview-prose h1,
  .pdf-export-root .preview-prose h2,
  .pdf-export-root .preview-prose h3,
  .pdf-export-root .preview-prose h4,
  .pdf-export-root .preview-prose p,
  .pdf-export-root .preview-prose li,
  .pdf-export-root .preview-prose th,
  .pdf-export-root .preview-prose td {
    color: #1a1a1a !important;
  }
  .pdf-export-root .preview-prose h1 {
    font-size: 1.75em;
    font-weight: 700;
    margin: 0 0 0.5em;
    padding-bottom: 0.25em;
    border-bottom: 1px solid #d4d4d4;
  }
  .pdf-export-root .preview-prose h2 {
    font-size: 1.35em;
    font-weight: 600;
    margin: 1.25em 0 0.5em;
  }
  .pdf-export-root .preview-prose p { margin: 0.75em 0; }
  .pdf-export-root .preview-prose a { color: #2563eb !important; text-decoration: underline; }
  .pdf-export-root .preview-prose pre {
    overflow: visible;
    border-radius: 6px;
    margin: 1em 0;
    padding: 0;
    background: #f5f5f5 !important;
    border: 1px solid #d4d4d4;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .pdf-export-root .preview-prose pre code {
    display: block;
    padding: 12px 16px;
    font-size: 13px;
    font-family: ui-monospace, "Cascadia Code", "Segoe UI Mono", monospace;
    background: #f5f5f5 !important;
  }
  .pdf-export-root .preview-prose :not(pre) > code {
    background: #f5f5f5 !important;
    padding: 0.15em 0.35em;
    border-radius: 4px;
    font-size: 0.9em;
    font-family: ui-monospace, "Cascadia Code", "Segoe UI Mono", monospace;
  }
  .pdf-export-root .preview-prose table {
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;
    font-size: 14px;
  }
  .pdf-export-root .preview-prose th,
  .pdf-export-root .preview-prose td {
    border: 1px solid #d4d4d4;
    padding: 8px 12px;
    text-align: left;
  }
  .pdf-export-root .preview-prose th {
    background: #eeeeee !important;
    font-weight: 600;
  }
  .pdf-export-root .preview-prose ul,
  .pdf-export-root .preview-prose ol {
    margin: 0.75em 0;
    padding-left: 1.5em;
  }
  .pdf-export-root .preview-prose blockquote {
    border-left: 4px solid #d4d4d4;
    margin: 1em 0;
    padding-left: 1em;
    color: #737373 !important;
  }
`;

function injectPdfStyles(): void {
  if (document.getElementById(PDF_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PDF_STYLE_ID;
  style.textContent = PDF_CSS;
  document.head.appendChild(style);
}

function removePdfStyles(): void {
  document.getElementById(PDF_STYLE_ID)?.remove();
}

function createExportContainer(bodyHtml: string): HTMLDivElement {
  injectPdfStyles();

  const container = document.createElement("div");
  container.className = "pdf-export-root";
  container.setAttribute("aria-hidden", "true");
  container.style.cssText = [
    "position: fixed",
    "left: 0",
    "top: 0",
    "width: 794px",
    "opacity: 0",
    "pointer-events: none",
    "z-index: -1",
    "overflow: visible",
  ].join("; ");

  const article = document.createElement("article");
  article.className = "preview-prose";
  article.innerHTML = bodyHtml;

  container.appendChild(article);
  document.body.appendChild(container);
  return container;
}

async function waitForLayout(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
}

function sanitizeFilename(name: string): string {
  const cleaned = name.trim().replace(/[^\w\-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "documento";
}

async function captureToPdf(
  container: HTMLElement,
  filename: string,
): Promise<void> {
  const canvas = await html2canvas(container, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    width: 794,
    windowWidth: 794,
    onclone: (clonedDoc) => {
      const cloned = clonedDoc.querySelector(".pdf-export-root");
      if (!(cloned instanceof HTMLElement)) return;
      cloned.style.opacity = "1";
      cloned.style.position = "static";
      cloned.style.zIndex = "auto";
      cloned.style.pointerEvents = "auto";
    },
  });

  if (canvas.width === 0 || canvas.height === 0) {
    throw new Error("Não foi possível capturar o conteúdo para o PDF.");
  }

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;
  const imgWidth = contentWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imgData = canvas.toDataURL("image/jpeg", 0.95);

  let offsetY = 0;
  let pageIndex = 0;

  while (offsetY < imgHeight) {
    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(imgData, "JPEG", margin, margin - offsetY, imgWidth, imgHeight);
    offsetY += contentHeight;
    pageIndex += 1;
  }

  pdf.save(`${sanitizeFilename(filename)}.pdf`);
}

export async function exportMarkdownToPdf(
  markdown: string,
  filename = "mdPreviewPortal",
): Promise<void> {
  const bodyHtml = await renderMarkdownHtml(markdown, { codeTheme: "light" });
  const container = createExportContainer(bodyHtml);

  try {
    await waitForLayout();
    await captureToPdf(container, filename);
  } finally {
    container.remove();
    removePdfStyles();
  }
}
