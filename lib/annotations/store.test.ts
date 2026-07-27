import { describe, expect, it, beforeEach } from "vitest";
import { hashMarkdown, annotationStorageKey } from "./hash";
import {
  annotationReducer,
  createInitialAnnotationState,
} from "./store";
import {
  eraseStrokeAt,
  parseAnnotationDoc,
  readAnnotations,
  writeAnnotations,
} from "./storage";
import type { Stroke } from "./types";

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
});

describe("parseAnnotationDoc", () => {
  it("returns null for invalid JSON", () => {
    expect(parseAnnotationDoc("{")).toBeNull();
    expect(parseAnnotationDoc(null)).toBeNull();
  });

  it("parses valid doc", () => {
    const s = stroke("1", [{ x: 1, y: 2 }]);
    const raw = JSON.stringify({ version: 1, strokes: [s] });
    expect(parseAnnotationDoc(raw)).toEqual({ version: 1, strokes: [s] });
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
});

describe("annotationReducer", () => {
  it("begin/append/end stroke", () => {
    let state = createInitialAnnotationState();
    state = annotationReducer(state, { type: "setMode", mode: "draw" });
    state = annotationReducer(state, {
      type: "beginStroke",
      point: { x: 1, y: 1 },
    });
    expect(state.strokes).toHaveLength(1);
    expect(state.activeStrokeId).toBeTruthy();
    expect(state.past).toHaveLength(1);

    state = annotationReducer(state, {
      type: "appendPoint",
      point: { x: 2, y: 2 },
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
    });
    expect(state.strokes).toHaveLength(0);
  });

  it("undo and redo", () => {
    let state = createInitialAnnotationState();
    state = annotationReducer(state, { type: "setMode", mode: "draw" });
    state = annotationReducer(state, {
      type: "beginStroke",
      point: { x: 1, y: 1 },
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
    state = annotationReducer(state, { type: "eraseAt", x: 5, y: 5 });
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
});
