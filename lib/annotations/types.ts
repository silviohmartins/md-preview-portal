export type AnnotationMode = "navigate" | "draw";

export type AnnotationTool = "pen" | "highlighter" | "eraser";

export type StrokePoint = {
  x: number;
  y: number;
  p?: number;
};

export type AnnotationDocumentSize = {
  width: number;
  height: number;
};

export type Stroke = {
  id: string;
  tool: Exclude<AnnotationTool, "eraser">;
  color: string;
  width: number;
  /** Present for normalized points created by the v2 annotation pipeline. */
  documentSize?: AnnotationDocumentSize;
  points: StrokePoint[];
};

export type AnnotationDoc = {
  version: 2;
  strokes: Stroke[];
};

export type AnnotationDocumentIdentity = {
  workspaceId: string;
  relativePath: string;
  contentVersion: string;
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

export const ANNOTATION_CONTENT_VERSION = "live-v2";
export const MAX_ANNOTATION_HISTORY = 50;
