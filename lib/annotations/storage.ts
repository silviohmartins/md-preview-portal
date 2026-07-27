import { annotationStorageKey } from "@/lib/annotations/hash";
import type { AnnotationDoc, Stroke } from "@/lib/annotations/types";

export type AnnotationStorageResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function isStroke(value: unknown): value is Stroke {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  if (typeof s.id !== "string") return false;
  if (s.tool !== "pen" && s.tool !== "highlighter") return false;
  if (typeof s.color !== "string") return false;
  if (typeof s.width !== "number" || !Number.isFinite(s.width)) return false;
  if (!Array.isArray(s.points)) return false;
  return s.points.every((p) => {
    if (!p || typeof p !== "object") return false;
    const pt = p as Record<string, unknown>;
    return (
      typeof pt.x === "number" &&
      typeof pt.y === "number" &&
      (pt.p === undefined || typeof pt.p === "number")
    );
  });
}

export function parseAnnotationDoc(raw: string | null): AnnotationDoc | null {
  if (raw === null || raw === "") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const doc = parsed as Record<string, unknown>;
    if (doc.version !== 1 || !Array.isArray(doc.strokes)) return null;
    if (!doc.strokes.every(isStroke)) return null;
    return { version: 1, strokes: doc.strokes };
  } catch {
    return null;
  }
}

export function readAnnotations(
  documentHash: string,
): AnnotationStorageResult<Stroke[]> {
  if (typeof window === "undefined") {
    return { ok: true, value: [] };
  }
  try {
    const raw = window.localStorage.getItem(annotationStorageKey(documentHash));
    const doc = parseAnnotationDoc(raw);
    return { ok: true, value: doc?.strokes ?? [] };
  } catch {
    return { ok: false, error: "localStorage unavailable" };
  }
}

export function writeAnnotations(
  documentHash: string,
  strokes: Stroke[],
): AnnotationStorageResult<void> {
  if (typeof window === "undefined") {
    return { ok: true, value: undefined };
  }
  try {
    const key = annotationStorageKey(documentHash);
    if (strokes.length === 0) {
      window.localStorage.removeItem(key);
      return { ok: true, value: undefined };
    }
    const doc: AnnotationDoc = { version: 1, strokes };
    window.localStorage.setItem(key, JSON.stringify(doc));
    return { ok: true, value: undefined };
  } catch {
    return { ok: false, error: "Could not save annotations" };
  }
}

/** Hit-test: remove first stroke whose bounding box (padded) contains the point. */
export function eraseStrokeAt(
  strokes: Stroke[],
  x: number,
  y: number,
  pad = 8,
): Stroke[] {
  const index = strokes.findIndex((stroke) => {
    if (stroke.points.length === 0) return false;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of stroke.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const half = stroke.width / 2 + pad;
    return (
      x >= minX - half &&
      x <= maxX + half &&
      y >= minY - half &&
      y <= maxY + half
    );
  });
  if (index < 0) return strokes;
  return [...strokes.slice(0, index), ...strokes.slice(index + 1)];
}

export function createStrokeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
