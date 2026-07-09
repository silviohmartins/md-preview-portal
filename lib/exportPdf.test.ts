import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPdfFromPageCanvases,
  choosePageEnd,
  collectPdfBreakPointsCss,
  exportMarkdownToPdf,
  getPageHeightCss,
  planPdfPageRanges,
  sanitizeFilename,
} from "./exportPdf";

const saveMock = vi.fn();
const addImageMock = vi.fn();
const addPageMock = vi.fn();
const html2canvasMock = vi.fn();

vi.mock("./markdown", () => ({
  renderMarkdownHtml: vi
    .fn()
    .mockResolvedValue("<h1>Teste</h1><p>Conteúdo PDF</p>"),
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
    addImage: addImageMock,
    addPage: addPageMock,
    save: saveMock,
  })),
}));

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

const canvasSpies: Array<ReturnType<typeof vi.spyOn>> = [];

function stubCanvasApis(): void {
  for (const spy of canvasSpies) spy.mockRestore();
  canvasSpies.length = 0;

  canvasSpies.push(
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        ({
          fillStyle: "",
          fillRect: vi.fn(),
          drawImage: vi.fn(),
        }) as unknown as CanvasRenderingContext2D,
    ),
  );
  canvasSpies.push(
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/png;base64,abc",
    ),
  );
}

function restoreCanvasApis(): void {
  for (const spy of canvasSpies) spy.mockRestore();
  canvasSpies.length = 0;
}

describe("sanitizeFilename", () => {
  it("normalizes unsafe characters", () => {
    expect(sanitizeFilename(" Meu Doc!.pdf ")).toBe("Meu-Doc-pdf");
    expect(sanitizeFilename("@@@")).toBe("documento");
  });
});

describe("choosePageEnd", () => {
  it("snaps to the last break at or before the ideal end", () => {
    expect(choosePageEnd(0, 1000, 5000, [200, 800, 1200])).toBe(800);
  });

  it("falls back to ideal end when next break is far past the page", () => {
    expect(choosePageEnd(0, 1000, 5000, [1200, 2000])).toBe(1000);
  });

  it("allows a tiny overflow to the next line break", () => {
    expect(choosePageEnd(0, 1000, 5000, [1010])).toBe(1010);
  });

  it("returns content height on the last page", () => {
    expect(choosePageEnd(900, 1500, 1200, [1000])).toBe(1200);
  });

  it("moves an entire table row to the next page when the cut lands inside it", () => {
    const regions = [{ top: 900, bottom: 980 }];
    expect(choosePageEnd(0, 950, 5000, [800, 900, 980], regions)).toBe(900);
  });
});

describe("planPdfPageRanges", () => {
  it("returns a single range for short content", () => {
    const ranges = planPdfPageRanges(400, 1000);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toEqual({ start: 0, end: 400 });
  });

  it("splits tall content into multiple pages", () => {
    const pageHeight = getPageHeightCss();
    const contentHeight = pageHeight * 3;
    const ranges = planPdfPageRanges(contentHeight, pageHeight);
    expect(ranges.length).toBeGreaterThan(1);
    expect(ranges[0]?.start).toBe(0);
    expect(ranges[ranges.length - 1]?.end).toBe(contentHeight);
  });

  it("does not end a page inside an atomic table row", () => {
    const pageHeight = 1000;
    const rowTop = 960;
    const rowBottom = 1040;
    const ranges = planPdfPageRanges(
      3000,
      pageHeight,
      [0, rowTop, rowBottom, 3000],
      [{ top: rowTop, bottom: rowBottom }],
    );

    expect(ranges[0]?.end).toBe(rowTop);
    expect(ranges[1]?.start).toBe(rowTop);
  });

  it("snaps page end to a wrapped line bottom outside tables", () => {
    const pageHeight = 1000;
    const lineBottom = 980;
    const ranges = planPdfPageRanges(3000, pageHeight, [
      0,
      lineBottom,
      1050,
      3000,
    ]);

    expect(ranges[0]?.end).toBe(lineBottom);
  });
});

describe("collectPdfBreakPointsCss", () => {
  it("keeps row edges and strips mid-row candidates", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <table>
        <tr><td>a</td></tr>
        <tr><td>b</td></tr>
      </table>
      <p>parágrafo</p>
    `;
    document.body.appendChild(root);

    Object.defineProperty(root, "scrollHeight", {
      value: 200,
      configurable: true,
    });
    vi.spyOn(root, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 200,
      left: 0,
      right: 100,
      width: 100,
      height: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const rows = root.querySelectorAll("tr");
    rows.forEach((row, index) => {
      const top = 20 + index * 40;
      vi.spyOn(row, "getBoundingClientRect").mockReturnValue({
        top,
        bottom: top + 40,
        left: 0,
        right: 100,
        width: 100,
        height: 40,
        x: 0,
        y: top,
        toJSON: () => ({}),
      });
    });

    const points = collectPdfBreakPointsCss(root, 1000);
    expect(points).toEqual(expect.arrayContaining([0, 20, 60, 100]));
    expect(points.some((y) => y > 20 && y < 60)).toBe(false);

    root.remove();
  });
});

describe("buildPdfFromPageCanvases", () => {
  beforeEach(() => {
    saveMock.mockReset();
    addImageMock.mockReset();
    addPageMock.mockReset();
    stubCanvasApis();
  });

  afterEach(() => {
    restoreCanvasApis();
  });

  it("adds one PNG page for a single canvas", async () => {
    await buildPdfFromPageCanvases([makeCanvas(794, 400)], "curto");
    expect(addPageMock).not.toHaveBeenCalled();
    expect(addImageMock).toHaveBeenCalledTimes(1);
    expect(addImageMock.mock.calls[0]?.[1]).toBe("PNG");
    expect(saveMock).toHaveBeenCalledWith("curto.pdf");
  });

  it("adds extra pages for multiple canvases", async () => {
    await buildPdfFromPageCanvases(
      [makeCanvas(794, 400), makeCanvas(794, 400), makeCanvas(794, 200)],
      "longo",
    );
    expect(addPageMock).toHaveBeenCalledTimes(2);
    expect(addImageMock).toHaveBeenCalledTimes(3);
    expect(saveMock).toHaveBeenCalledWith("longo.pdf");
  });

  it("rejects empty canvas list", async () => {
    await expect(buildPdfFromPageCanvases([], "x")).rejects.toThrow(
      "Não foi possível capturar o conteúdo para o PDF.",
    );
  });
});

describe("exportMarkdownToPdf", () => {
  beforeEach(() => {
    saveMock.mockReset();
    addImageMock.mockReset();
    addPageMock.mockReset();
    html2canvasMock.mockReset();
    stubCanvasApis();
    html2canvasMock.mockResolvedValue(makeCanvas(794, 800));
  });

  afterEach(() => {
    restoreCanvasApis();
    document.getElementById("pdf-export-styles")?.remove();
    document.querySelector(".pdf-export-root")?.remove();
    document.querySelector(".pdf-export-viewport")?.remove();
  });

  it("renderiza com tema claro + highlight e baixa o arquivo PDF", async () => {
    const { renderMarkdownHtml } = await import("./markdown");

    await exportMarkdownToPdf("# Teste", "meu-documento");

    expect(renderMarkdownHtml).toHaveBeenCalledWith("# Teste", {
      codeTheme: "light",
      highlight: true,
    });
    expect(html2canvasMock).toHaveBeenCalled();
    expect(saveMock).toHaveBeenCalledWith("meu-documento.pdf");
    expect(document.querySelector(".pdf-export-root")).toBeNull();
    expect(document.getElementById("pdf-export-styles")).toBeNull();
  });

  it("falha quando a captura retorna canvas vazio", async () => {
    html2canvasMock.mockResolvedValue(makeCanvas(0, 0));

    await expect(exportMarkdownToPdf("# Teste")).rejects.toThrow(
      "Não foi possível capturar o conteúdo para o PDF.",
    );
  });

  it("rejeita markdown vazio", async () => {
    await expect(exportMarkdownToPdf("   ")).rejects.toThrow(
      "Não há conteúdo para exportar.",
    );
    expect(html2canvasMock).not.toHaveBeenCalled();
  });
});
