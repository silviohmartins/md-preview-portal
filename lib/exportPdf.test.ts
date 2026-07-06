import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportMarkdownToPdf } from "./exportPdf";

const saveMock = vi.fn();
const html2canvasMock = vi.fn();

vi.mock("./markdown", () => ({
  renderMarkdownHtml: vi.fn().mockResolvedValue("<h1>Teste</h1><p>Conteúdo PDF</p>"),
}));

vi.mock("html2canvas", () => ({
  default: (...args: unknown[]) => html2canvasMock(...args),
}));

vi.mock("jspdf", () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    internal: {
      pageSize: {
        getWidth: () => 595,
        getHeight: () => 842,
      },
    },
    addImage: vi.fn(),
    addPage: vi.fn(),
    save: saveMock,
  })),
}));

describe("exportMarkdownToPdf", () => {
  beforeEach(() => {
    saveMock.mockReset();
    html2canvasMock.mockReset();
    html2canvasMock.mockResolvedValue({
      width: 794,
      height: 1200,
      toDataURL: () => "data:image/jpeg;base64,abc",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.getElementById("pdf-export-styles")?.remove();
    document.querySelector(".pdf-export-root")?.remove();
  });

  it("renderiza com tema claro e baixa o arquivo PDF", async () => {
    const { renderMarkdownHtml } = await import("./markdown");

    await exportMarkdownToPdf("# Teste", "meu-documento");

    expect(renderMarkdownHtml).toHaveBeenCalledWith("# Teste", { codeTheme: "light" });
    expect(html2canvasMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith("meu-documento.pdf");
  });

  it("falha quando a captura retorna canvas vazio", async () => {
    html2canvasMock.mockResolvedValue({
      width: 0,
      height: 0,
      toDataURL: () => "data:image/jpeg;base64,abc",
    });

    await expect(exportMarkdownToPdf("# Teste")).rejects.toThrow(
      "Não foi possível capturar o conteúdo para o PDF.",
    );
  });
});
