export type AnnotationMode = "navigate" | "draw";

export type AnnotationTool = "pen" | "highlighter" | "eraser";

export type StrokePoint = {
  x: number;
  y: number;
  p?: number;
};

export type Stroke = {
  id: string;
  tool: Exclude<AnnotationTool, "eraser">;
  color: string;
  width: number;
  points: StrokePoint[];
};

export type AnnotationDoc = {
  version: 1;
  strokes: Stroke[];
};

export const ANNOTATION_COLORS = [
  "#e11d48", // rose
  "#2563eb", // blue
  "#ccff00", // highlighter yellow
  "#111827", // near-black
] as const;

export const ANNOTATION_WIDTHS = [2, 8] as const;

export const DEFAULT_ANNOTATION_COLOR = ANNOTATION_COLORS[0];
export const DEFAULT_ANNOTATION_WIDTH = ANNOTATION_WIDTHS[0];

export const ANNOTATION_STORAGE_PREFIX = "md-annotations:";
