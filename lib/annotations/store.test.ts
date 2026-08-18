import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAnnotationDocumentKey, hashMarkdown } from "./hash";
import {
  annotationReducer,
  createInitialAnnotationState,
} from "./store";
import {
  eraseStrokeAt,
  annotationStorageKey,
  parseAnnotationDoc,
  readAnnotations,
  readAnnotationsWithLegacyMigration,
  writeAnnotations,
} from "./storage";
import { MAX_ANNOTATION_HISTORY } from "./types";
import type { Stroke } from "./types";

const documentSize = { width: 400, height: 800 };

function stroke(
  id: string,
  points: Array<{ x: number; y: number }>,
): Stroke {
  return {
    id,
    tool: "pen",
    color: "#e11d48",
    width: 2,
    points,
  };
}

describe("hashMarkdown", () => {
  it("is stable for the same content", () => {
    expect(hashMarkdown("# Hello")).toBe(hashMarkdown("# Hello"));
  });

  it("changes when content changes", () => {
    expect(hashMarkdown("# A")).not.toBe(hashMarkdown("# B"));
  });

  it("builds storage key with prefix", () => {
    expect(annotationStorageKey("abcd1234")).toBe("md-annotations:abcd1234");
  });

  it("isolates identical content by workspace and relative path", () => {
    const first = createAnnotationDocumentKey({
      workspaceId: "folder:docs",
      relativePath: "a/readme.md",
      contentVersion: "live-v2",
    });
    const second = createAnnotationDocumentKey({
      workspaceId: "folder:docs",
      relativePath: "b/readme.md",
      contentVersion: "live-v2",
    });
    const otherWorkspace = createAnnotationDocumentKey({
      workspaceId: "folder:outro",
      relativePath: "a/readme.md",
      contentVersion: "live-v2",
    });

    expect(first).not.toBe(second);
    expect(first).not.toBe(otherWorkspace);
  });
});

describe("parseAnnotationDoc", () => {
  it("returns null for invalid JSON", () => {
    expect(parseAnnotationDoc("{")).toBeNull();
    expect(parseAnnotationDoc(null)).toBeNull();
  });

  it("parses valid doc", () => {
    const s = stroke("1", [{ x: 1, y: 2 }]);
    const raw = JSON.stringify({ version: 1, strokes: [s] });
    expect(parseAnnotationDoc(raw)).toEqual({ version: 2, strokes: [s] });
  });

  it("rejects strokes with bad tool", () => {
    const raw = JSON.stringify({
      version: 1,
      strokes: [{ ...stroke("1", [{ x: 0, y: 0 }]), tool: "eraser" }],
    });
    expect(parseAnnotationDoc(raw)).toBeNull();
  });
});

describe("annotation storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("writes and reads strokes", () => {
    const s = stroke("a", [{ x: 10, y: 20 }]);
    expect(writeAnnotations("hash1", [s]).ok).toBe(true);
    expect(readAnnotations("hash1")).toEqual({ ok: true, value: [s] });
  });

  it("removes key when strokes empty", () => {
    writeAnnotations("hash1", [stroke("a", [{ x: 1, y: 1 }])]);
    writeAnnotations("hash1", []);
    expect(localStorage.getItem("md-annotations:hash1")).toBeNull();
  });

  it("returns a specific message when localStorage quota is exceeded", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("full", "QuotaExceededError");
      });

    expect(writeAnnotations("hash1", [stroke("a", [{ x: 1, y: 1 }])])).toEqual({
      ok: false,
      error:
        "Armazenamento de anotações cheio. Limpe desenhos antigos e tente novamente.",
    });
    setItem.mockRestore();
  });

  it("migrates a legacy content-hash key to the stable document key", () => {
    const legacyStroke = stroke("legacy", [{ x: 10, y: 20 }]);
    localStorage.setItem(
      annotationStorageKey("old-content-hash"),
      JSON.stringify({ version: 1, strokes: [legacyStroke] }),
    );

    expect(
      readAnnotationsWithLegacyMigration("live-v2:workspace:path", "old-content-hash"),
    ).toEqual({ ok: true, value: [legacyStroke] });
    expect(localStorage.getItem(annotationStorageKey("old-content-hash"))).toBeNull();
    expect(readAnnotations("live-v2:workspace:path")).toEqual({
      ok: true,
      value: [legacyStroke],
    });
  });
});

describe("eraseStrokeAt", () => {
  it("removes stroke under point", () => {
    const strokes = [
      stroke("a", [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ]),
      stroke("b", [
        { x: 100, y: 100 },
        { x: 110, y: 110 },
      ]),
    ];
    const next = eraseStrokeAt(strokes, 5, 5);
    expect(next.map((s) => s.id)).toEqual(["b"]);
  });

  it("returns same array when miss", () => {
    const strokes = [stroke("a", [{ x: 0, y: 0 }, { x: 10, y: 10 }])];
    expect(eraseStrokeAt(strokes, 500, 500)).toBe(strokes);
  });

  it("hit-tests normalized strokes at the current document size", () => {
    const normalized: Stroke = {
      ...stroke("normalized", [{ x: 0.25, y: 0.25 }]),
      documentSize,
    };

    expect(
      eraseStrokeAt(
        [normalized],
        200,
        100,
        8,
        { width: 800, height: 400 },
      ),
    ).toEqual([]);
  });
});

describe("annotationReducer", () => {
  it("begin/append/end stroke", () => {
    let state = createInitialAnnotationState();
    state = annotationReducer(state, { type: "setMode", mode: "draw" });
    state = annotationReducer(state, {
      type: "beginStroke",
      point: { x: 1, y: 1 },
      documentSize,
    });
    expect(state.strokes).toHaveLength(1);
    expect(state.activeStrokeId).toBeTruthy();
    expect(state.past).toHaveLength(1);

    state = annotationReducer(state, {
      type: "appendPoints",
      points: [{ x: 2, y: 2 }],
    });
    expect(state.strokes[0]!.points).toHaveLength(2);

    state = annotationReducer(state, { type: "endStroke" });
    expect(state.activeStrokeId).toBeNull();
  });

  it("ignores beginStroke in navigate mode", () => {
    let state = createInitialAnnotationState();
    state = annotationReducer(state, {
      type: "beginStroke",
      point: { x: 1, y: 1 },
      documentSize,
    });
    expect(state.strokes).toHaveLength(0);
  });

  it("undo and redo", () => {
    let state = createInitialAnnotationState();
    state = annotationReducer(state, { type: "setMode", mode: "draw" });
    state = annotationReducer(state, {
      type: "beginStroke",
      point: { x: 1, y: 1 },
      documentSize,
    });
    state = annotationReducer(state, { type: "endStroke" });
    expect(state.strokes).toHaveLength(1);

    state = annotationReducer(state, { type: "undo" });
    expect(state.strokes).toHaveLength(0);

    state = annotationReducer(state, { type: "redo" });
    expect(state.strokes).toHaveLength(1);
  });

  it("clear pushes past and empties strokes", () => {
    let state = createInitialAnnotationState([
      stroke("a", [{ x: 0, y: 0 }]),
    ]);
    state = annotationReducer(state, { type: "clear" });
    expect(state.strokes).toHaveLength(0);
    expect(state.past).toHaveLength(1);
  });

  it("eraseAt removes stroke and supports undo", () => {
    let state = createInitialAnnotationState([
      stroke("a", [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ]),
    ]);
    state = annotationReducer(state, { type: "setMode", mode: "draw" });
    state = annotationReducer(state, {
      type: "eraseAt",
      x: 5,
      y: 5,
      targetSize: documentSize,
    });
    expect(state.strokes).toHaveLength(0);
    state = annotationReducer(state, { type: "undo" });
    expect(state.strokes).toHaveLength(1);
  });

  it("load replaces strokes and resets history", () => {
    let state = createInitialAnnotationState([stroke("old", [{ x: 0, y: 0 }])]);
    state = annotationReducer(state, { type: "setMode", mode: "draw" });
    state = annotationReducer(state, {
      type: "load",
      strokes: [stroke("new", [{ x: 9, y: 9 }])],
    });
    expect(state.strokes[0]!.id).toBe("new");
    expect(state.past).toHaveLength(0);
    expect(state.mode).toBe("draw");
  });

  it("limits undo history to the configured maximum", () => {
    let state = createInitialAnnotationState();
    state = annotationReducer(state, { type: "setMode", mode: "draw" });

    for (let index = 0; index < MAX_ANNOTATION_HISTORY + 10; index++) {
      state = annotationReducer(state, {
        type: "beginStroke",
        point: { x: index / 100, y: index / 100 },
        documentSize,
      });
      state = annotationReducer(state, { type: "endStroke" });
    }

    expect(state.past).toHaveLength(MAX_ANNOTATION_HISTORY);
  });
});
