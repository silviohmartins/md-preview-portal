import {
  createStrokeId,
  eraseStrokeAt,
} from "@/lib/annotations/storage";
import type {
  AnnotationMode,
  AnnotationTool,
  Stroke,
  StrokePoint,
} from "@/lib/annotations/types";
import {
  DEFAULT_ANNOTATION_COLOR,
  DEFAULT_ANNOTATION_WIDTH,
} from "@/lib/annotations/types";

export type AnnotationState = {
  mode: AnnotationMode;
  tool: AnnotationTool;
  color: string;
  width: number;
  strokes: Stroke[];
  past: Stroke[][];
  future: Stroke[][];
  activeStrokeId: string | null;
};

export type AnnotationAction =
  | { type: "setMode"; mode: AnnotationMode }
  | { type: "setTool"; tool: AnnotationTool }
  | { type: "setColor"; color: string }
  | { type: "setWidth"; width: number }
  | { type: "load"; strokes: Stroke[] }
  | { type: "beginStroke"; point: StrokePoint }
  | { type: "appendPoint"; point: StrokePoint }
  | { type: "endStroke" }
  | { type: "eraseAt"; x: number; y: number }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "clear" };

export function createInitialAnnotationState(
  strokes: Stroke[] = [],
): AnnotationState {
  return {
    mode: "navigate",
    tool: "pen",
    color: DEFAULT_ANNOTATION_COLOR,
    width: DEFAULT_ANNOTATION_WIDTH,
    strokes,
    past: [],
    future: [],
    activeStrokeId: null,
  };
}

function pushPast(state: AnnotationState, nextStrokes: Stroke[]): AnnotationState {
  return {
    ...state,
    strokes: nextStrokes,
    past: [...state.past, state.strokes],
    future: [],
    activeStrokeId: null,
  };
}

export function annotationReducer(
  state: AnnotationState,
  action: AnnotationAction,
): AnnotationState {
  switch (action.type) {
    case "setMode":
      return {
        ...state,
        mode: action.mode,
        activeStrokeId: action.mode === "navigate" ? null : state.activeStrokeId,
      };
    case "setTool":
      return { ...state, tool: action.tool, activeStrokeId: null };
    case "setColor":
      return { ...state, color: action.color };
    case "setWidth":
      return { ...state, width: action.width };
    case "load":
      return {
        ...createInitialAnnotationState(action.strokes),
        mode: state.mode,
        tool: state.tool,
        color: state.color,
        width: state.width,
      };
    case "beginStroke": {
      if (state.mode !== "draw") return state;
      if (state.tool === "eraser") return state;
      const id = createStrokeId();
      const stroke: Stroke = {
        id,
        tool: state.tool,
        color: state.color,
        width: state.width,
        points: [action.point],
      };
      return {
        ...state,
        strokes: [...state.strokes, stroke],
        past: [...state.past, state.strokes],
        future: [],
        activeStrokeId: id,
      };
    }
    case "appendPoint": {
      if (!state.activeStrokeId) return state;
      return {
        ...state,
        strokes: state.strokes.map((s) =>
          s.id === state.activeStrokeId
            ? { ...s, points: [...s.points, action.point] }
            : s,
        ),
      };
    }
    case "endStroke": {
      if (!state.activeStrokeId) return state;
      const active = state.strokes.find((s) => s.id === state.activeStrokeId);
      // Drop degenerate strokes (single identical point with no movement is still ok for dots)
      if (active && active.points.length === 0) {
        return {
          ...state,
          strokes: state.strokes.filter((s) => s.id !== state.activeStrokeId),
          activeStrokeId: null,
        };
      }
      return { ...state, activeStrokeId: null };
    }
    case "eraseAt": {
      if (state.mode !== "draw") return state;
      const next = eraseStrokeAt(state.strokes, action.x, action.y);
      if (next === state.strokes || next.length === state.strokes.length) {
        return state;
      }
      return pushPast(state, next);
    }
    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1]!;
      return {
        ...state,
        strokes: previous,
        past: state.past.slice(0, -1),
        future: [state.strokes, ...state.future],
        activeStrokeId: null,
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return {
        ...state,
        strokes: next!,
        past: [...state.past, state.strokes],
        future: rest,
        activeStrokeId: null,
      };
    }
    case "clear": {
      if (state.strokes.length === 0) return state;
      return pushPast(state, []);
    }
    default:
      return state;
  }
}
