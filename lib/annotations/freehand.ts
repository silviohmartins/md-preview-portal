import getStroke from "perfect-freehand";
import type { Stroke, StrokePoint } from "@/lib/annotations/types";

export function strokeToSvgPath(
  stroke: Stroke,
  options?: { size?: number },
): string {
  if (stroke.points.length === 0) return "";

  const size = options?.size ?? stroke.width;
  const input: number[][] = stroke.points.map((p: StrokePoint) =>
    p.p !== undefined ? [p.x, p.y, p.p] : [p.x, p.y],
  );

  const outline = getStroke(input, {
    size: stroke.tool === "highlighter" ? size * 3 : size * 1.5,
    thinning: stroke.tool === "highlighter" ? 0 : 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    last: true,
  });

  return outlineToPath(outline);
}

function outlineToPath(points: number[][]): string {
  if (points.length === 0) return "";
  const first = points[0]!;
  let d = `M ${first[0]} ${first[1]}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    d += ` L ${p[0]} ${p[1]}`;
  }
  return `${d} Z`;
}
