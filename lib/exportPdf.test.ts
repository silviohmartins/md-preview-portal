import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportMarkdownToPdf } from "./exportPdf";
import {
  composePdfOnePageAtATime,
  sanitizeFilename,
} from "./pdf/compose";
import {
  choosePageEnd,
  collectAtomicRegionsCss,
  collectPdfBreakPointsCss,
  getPageHeightCss,
  planPdfPageRanges,
} from "./pdf/pagination";
import { renderPdfMermaidDiagrams } from "./pdf/render";

const saveMock = vi.fn();
const addImageMock = vi.fn();
const addPageMock = vi.fn();
const html2canvasMock = vi.fn();
const mermaidInitializeMock = vi.fn();
const mermaidRenderMock = vi.fn();

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

vi.mock("mermaid", () => ({
  default: {
    initialize: mermaidInitializeMock,
    render: (...args: unknown[]) => mermaidRenderMock(...args),
  },
}));

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

const canvasSpies: Array<{ mockRestore(): void }> = [];

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

describe("composePdfOnePageAtATime", () => {
  it("captures, composes and releases each page before starting the next", async () => {
    const events: string[] = [];
    const canvases = [makeCanvas(794, 400), makeCanvas(794, 300)];
    stubCanvasApis();

    await composePdfOnePageAtATime({
      filename: "sequencial",
      totalPages: 2,
      createPdf: async () => ({
        internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } },
        addImage: () => events.push("compose"),
        addPage: () => events.push("add-page"),
        save: () => events.push("save"),
      }),
      capturePage: async (index) => {
        events.push(`capture-${index}`);
        return canvases[index]!;
      },
      releaseCanvas: (canvas) => {
        events.push("release");
        canvas.width = 0;
        canvas.height = 0;
      },
    });

    expect(events).toEqual([
      "capture-0",
      "compose",
      "release",
      "capture-1",
      "add-page",
      "compose",
      "release",
      "save",
    ]);
    expect(canvases.every((canvas) => canvas.width === 0)).toBe(true);
    restoreCanvasApis();
  });

  it("stops between pages when cancelled and releases the current canvas", async () => {
    const controller = new AbortController();
    const canvas = makeCanvas(794, 400);
    stubCanvasApis();

    await expect(
      composePdfOnePageAtATime({
        filename: "cancelado",
        totalPages: 3,
        signal: controller.signal,
        createPdf: async () => ({
          internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } },
          addImage: vi.fn(),
          addPage: vi.fn(),
          save: vi.fn(),
        }),
        capturePage: async () => canvas,
        releaseCanvas: (current) => {
          current.width = 0;
          current.height = 0;
        },
        onPageComposed: () => controller.abort(),
      }),
    ).rejects.toMatchObject({ name: "PdfExportCancelledError" });
    expect(canvas.width).toBe(0);
    restoreCanvasApis();
  });

  it("moves a fitting Mermaid diagram to the next page instead of slicing it", () => {
    const root = document.createElement("div");
    root.innerHTML = '<div class="mermaid-diagram"><svg></svg></div>';
    const diagram = root.querySelector<HTMLElement>(".mermaid-diagram")!;
    document.body.appendChild(root);
    Object.defineProperty(root, "scrollHeight", { value: 2200, configurable: true });
    vi.spyOn(root, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 2200,
      left: 0,
      right: 794,
      width: 794,
      height: 2200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(diagram, "getBoundingClientRect").mockReturnValue({
      top: 960,
      bottom: 1100,
      left: 0,
      right: 600,
      width: 600,
      height: 140,
      x: 0,
      y: 960,
      toJSON: () => ({}),
    });

    const regions = collectAtomicRegionsCss(root);
    const breakPoints = collectPdfBreakPointsCss(root, 1000);
    const ranges = planPdfPageRanges(2200, 1000, breakPoints, regions);

    expect(regions).toContainEqual({ top: 960, bottom: 1100 });
    expect(ranges[0]?.end).toBe(960);
    root.remove();
  });
});

describe("renderPdfMermaidDiagrams", () => {
  it("replaces Mermaid placeholders with rendered SVG", async () => {
    mermaidRenderMock.mockResolvedValueOnce({ svg: '<svg data-diagram="ok"></svg>' });
    const root = document.createElement("div");
    root.innerHTML = '<div data-mermaid-source="graph TD; A--&gt;B;"></div>';

    await renderPdfMermaidDiagrams(root);

    expect(mermaidInitializeMock).toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: "strict", theme: "default" }),
    );
    expect(mermaidRenderMock).toHaveBeenCalledWith(
      expect.stringMatching(/^pdf-mermaid-/),
      "graph TD; A-->B;",
    );
    expect(root.querySelector("svg[data-diagram=ok]")).not.toBeNull();
    expect(root.querySelector("[data-mermaid-source]")).toBeNull();
  });

  it("keeps an inline error and source when Mermaid syntax is invalid", async () => {
    mermaidRenderMock.mockRejectedValueOnce(new Error("Parse error"));
    const root = document.createElement("div");
    root.innerHTML = '<div data-mermaid-source="invalid diagram"></div>';

    await renderPdfMermaidDiagrams(root);

    expect(root.textContent).toContain("Erro no diagrama Mermaid: Parse error");
    expect(root.querySelector("code")?.textContent).toBe("invalid diagram");
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
    const progress = vi.fn();

    await exportMarkdownToPdf("# Teste", "meu-documento", {
      onProgress: progress,
    });

    expect(renderMarkdownHtml).toHaveBeenCalledWith("# Teste", {
      codeTheme: "light",
      highlight: true,
    });
    expect(html2canvasMock).toHaveBeenCalled();
    expect(saveMock).toHaveBeenCalledWith("meu-documento.pdf");
    expect(progress.mock.calls.map(([value]) => value.phase)).toEqual([
      "preparing",
      "capturing",
      "saving",
    ]);
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
