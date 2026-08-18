import { scaleStrokePoint, scaleStrokeWidth } from "@/lib/annotations/geometry";
import type {
  AnnotationDoc,
  AnnotationDocumentSize,
  Stroke,
} from "@/lib/annotations/types";

const ANNOTATION_STORAGE_PREFIX = "md-annotations:";

type AnnotationStorageResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function annotationStorageKey(documentKey: string): string {
  return `${ANNOTATION_STORAGE_PREFIX}${documentKey}`;
}

function isStroke(value: unknown): value is Stroke {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  if (typeof s.id !== "string") return false;
  if (s.tool !== "pen" && s.tool !== "highlighter") return false;
  if (typeof s.color !== "string") return false;
  if (typeof s.width !== "number" || !Number.isFinite(s.width)) return false;
  if (s.documentSize !== undefined) {
    if (!s.documentSize || typeof s.documentSize !== "object") return false;
    const size = s.documentSize as Record<string, unknown>;
    if (
      typeof size.width !== "number" ||
      !Number.isFinite(size.width) ||
      size.width <= 0 ||
      typeof size.height !== "number" ||
      !Number.isFinite(size.height) ||
      size.height <= 0
    ) {
      return false;
    }
  }
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
    if ((doc.version !== 1 && doc.version !== 2) || !Array.isArray(doc.strokes)) {
      return null;
    }
    if (!doc.strokes.every(isStroke)) return null;
    // Version 1 used absolute points and had no document dimensions. Keeping
    // documentSize absent preserves that legacy coordinate space.
    return { version: 2, strokes: doc.strokes };
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
    return {
      ok: false,
      error: "Não foi possível carregar as anotações armazenadas.",
    };
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
    const doc: AnnotationDoc = { version: 2, strokes };
    window.localStorage.setItem(key, JSON.stringify(doc));
    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: isQuotaExceededError(error)
        ? "Armazenamento de anotações cheio. Limpe desenhos antigos e tente novamente."
        : "Não foi possível salvar as anotações neste navegador.",
    };
  }
}

export function readAnnotationsWithLegacyMigration(
  documentKey: string,
  legacyContentHash?: string,
): AnnotationStorageResult<Stroke[]> {
  if (typeof window === "undefined" || !legacyContentHash) {
    return readAnnotations(documentKey);
  }
  try {
    const currentStorageKey = annotationStorageKey(documentKey);
    const currentRaw = window.localStorage.getItem(currentStorageKey);
    if (currentRaw !== null) {
      return {
        ok: true,
        value: parseAnnotationDoc(currentRaw)?.strokes ?? [],
      };
    }

    const legacyStorageKey = annotationStorageKey(legacyContentHash);
    const legacyDoc = parseAnnotationDoc(
      window.localStorage.getItem(legacyStorageKey),
    );
    if (!legacyDoc) return { ok: true, value: [] };

    const migrated = writeAnnotations(documentKey, legacyDoc.strokes);
    if (!migrated.ok) return migrated;
    window.localStorage.removeItem(legacyStorageKey);
    return { ok: true, value: legacyDoc.strokes };
  } catch {
    return {
      ok: false,
      error: "Não foi possível migrar as anotações armazenadas.",
    };
  }
}

function isQuotaExceededError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.code === 22)
  );
}

/** Hit-test: remove first stroke whose bounding box (padded) contains the point. */
export function eraseStrokeAt(
  strokes: Stroke[],
  x: number,
  y: number,
  pad = 8,
  targetSize?: AnnotationDocumentSize,
): Stroke[] {
  const index = strokes.findIndex((stroke) => {
    if (stroke.points.length === 0) return false;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of stroke.points) {
      const point = targetSize ? scaleStrokePoint(stroke, p, targetSize) : p;
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    const width = targetSize ? scaleStrokeWidth(stroke, targetSize) : stroke.width;
    const half = width / 2 + pad;
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
