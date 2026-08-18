import { describe, expect, it } from "vitest";
import {
  clientToDocumentPoint,
  measureContentSize,
  normalizeDocumentPoint,
  scaleStrokePoint,
  scaleStrokeWidth,
} from "./geometry";
import { strokeToSvgPath } from "./freehand";
import type { Stroke } from "./types";

describe("clientToDocumentPoint", () => {
  it("maps client coords relative to content rect (scroll baked into rect)", () => {
    // Scrolled content: top is negative because content moved up
    const contentEl = {
      getBoundingClientRect: () => ({
        left: 100,
        top: -40,
        right: 500,
        bottom: 1960,
        width: 400,
        height: 2000,
        x: 100,
        y: -40,
        toJSON: () => ({}),
      }),
    } as HTMLElement;

    expect(clientToDocumentPoint(150, 100, contentEl)).toEqual({
      x: 50,
      y: 140,
    });
  });
});

describe("measureContentSize", () => {
  it("uses the larger of scroll and offset dimensions", () => {
    const el = {
      scrollWidth: 800,
      scrollHeight: 1200,
      offsetWidth: 400,
      offsetHeight: 300,
    } as HTMLElement;
    expect(measureContentSize(el)).toEqual({ width: 800, height: 1200 });
  });
});

describe("normalized annotation geometry", () => {
  it("normalizes against draw dimensions and scales to the current document", () => {
    const normalized = normalizeDocumentPoint(
      { x: 100, y: 200, p: 0.5 },
      { width: 400, height: 800 },
    );
    const normalizedStroke: Stroke = {
      ...strokeFixture(),
      documentSize: { width: 400, height: 800 },
      points: [normalized],
    };

    expect(normalized).toEqual({ x: 0.25, y: 0.25, p: 0.5 });
    expect(
      scaleStrokePoint(normalizedStroke, normalized, {
        width: 800,
        height: 400,
      }),
    ).toEqual({ x: 200, y: 100, p: 0.5 });
    expect(
      scaleStrokeWidth(normalizedStroke, { width: 800, height: 1600 }),
    ).toBe(4);
  });
});

describe("strokeToSvgPath", () => {
  it("returns empty for no points", () => {
    const stroke: Stroke = {
      id: "1",
      tool: "pen",
      color: "#000",
      width: 2,
      points: [],
    };
    expect(strokeToSvgPath(stroke)).toBe("");
  });

  it("returns a closed SVG path for points", () => {
    const stroke: Stroke = {
      id: "1",
      tool: "pen",
      color: "#e11d48",
      width: 2,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 5 },
        { x: 20, y: 0 },
      ],
    };
    const d = strokeToSvgPath(stroke);
    expect(d.startsWith("M ")).toBe(true);
    expect(d.endsWith(" Z")).toBe(true);
  });
});

function strokeFixture(): Stroke {
  return {
    id: "fixture",
    tool: "pen",
    color: "#000",
    width: 2,
    points: [],
  };
}
