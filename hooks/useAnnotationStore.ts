"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { normalizeDocumentPoint } from "@/lib/annotations/geometry";
import {
  annotationReducer,
  createInitialAnnotationState,
} from "@/lib/annotations/store";
import {
  readAnnotationsWithLegacyMigration,
  writeAnnotations,
} from "@/lib/annotations/storage";
import type {
  AnnotationDocumentSize,
  AnnotationMode,
  AnnotationTool,
  Stroke,
  StrokePoint,
} from "@/lib/annotations/types";

const ANNOTATION_PERSIST_DEBOUNCE_MS = 300;

export function useAnnotationStore(
  documentKey: string,
  legacyContentHash?: string,
) {
  const [state, dispatch] = useReducer(
    annotationReducer,
    undefined,
    () => createInitialAnnotationState(),
  );
  const [storageError, setStorageError] = useState<string | null>(null);
  const stateRef = useRef(state);
  const documentKeyRef = useRef(documentKey);
  const legacyContentHashRef = useRef(legacyContentHash);
  const loadedRef = useRef(false);
  const loadedStrokesToSkipRef = useRef<Stroke[] | null>(null);
  const flushAfterNextStateRef = useRef(false);
  const pointBufferRef = useRef<StrokePoint[]>([]);
  const dispatchedPointsRef = useRef<StrokePoint[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  stateRef.current = state;
  legacyContentHashRef.current = legacyContentHash;

  const cancelPointFrame = useCallback(() => {
    if (animationFrameRef.current === null) return;
    window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }, []);

  const snapshotWithPendingPoints = useCallback((): Stroke[] => {
    const current = stateRef.current;
    const strokes = loadedStrokesToSkipRef.current ?? current.strokes;
    const pending = [
      ...dispatchedPointsRef.current,
      ...pointBufferRef.current,
    ];
    if (!current.activeStrokeId || pending.length === 0) return strokes;
    return strokes.map((stroke) =>
      stroke.id === current.activeStrokeId
        ? { ...stroke, points: [...stroke.points, ...pending] }
        : stroke,
    );
  }, []);

  useLayoutEffect(() => {
    dispatchedPointsRef.current = [];
  }, [state.strokes]);

  const persistSnapshot = useCallback(
    (key: string, strokes: Stroke[], reportError = true) => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      const result = writeAnnotations(key, strokes);
      if (reportError) setStorageError(result.ok ? null : result.error);
      return result;
    },
    [],
  );

  const flushPendingPoints = useCallback(() => {
    cancelPointFrame();
    if (pointBufferRef.current.length === 0) return;
    const points = pointBufferRef.current;
    pointBufferRef.current = [];
    dispatchedPointsRef.current.push(...points);
    dispatch({ type: "appendPoints", points });
  }, [cancelPointFrame]);

  useEffect(() => {
    let previousWriteError: string | null = null;
    if (loadedRef.current) {
      cancelPointFrame();
      const flushed = persistSnapshot(
        documentKeyRef.current,
        snapshotWithPendingPoints(),
        false,
      );
      if (!flushed.ok) previousWriteError = flushed.error;
      pointBufferRef.current = [];
      dispatchedPointsRef.current = [];
    }

    documentKeyRef.current = documentKey;
    const result = readAnnotationsWithLegacyMigration(
      documentKey,
      legacyContentHashRef.current,
    );
    setStorageError(result.ok ? previousWriteError : result.error);
    const loadedStrokes = result.ok ? result.value : [];
    dispatchedPointsRef.current = [];
    loadedStrokesToSkipRef.current = loadedStrokes;
    loadedRef.current = true;
    dispatch({ type: "load", strokes: loadedStrokes });
  }, [cancelPointFrame, documentKey, persistSnapshot, snapshotWithPendingPoints]);

  useEffect(() => {
    const loadedStrokes = loadedStrokesToSkipRef.current;
    if (loadedStrokes) {
      if (state.strokes === loadedStrokes) {
        loadedStrokesToSkipRef.current = null;
      }
      return;
    }
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);

    if (flushAfterNextStateRef.current) {
      flushAfterNextStateRef.current = false;
      persistSnapshot(documentKeyRef.current, state.strokes);
      return;
    }

    persistTimerRef.current = setTimeout(() => {
      persistSnapshot(documentKeyRef.current, stateRef.current.strokes);
    }, ANNOTATION_PERSIST_DEBOUNCE_MS);
  }, [persistSnapshot, state.strokes]);

  useEffect(() => {
    const flush = () => {
      persistSnapshot(
        documentKeyRef.current,
        snapshotWithPendingPoints(),
        document.visibilityState !== "hidden",
      );
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      cancelPointFrame();
      if (flushFallbackTimerRef.current) clearTimeout(flushFallbackTimerRef.current);
      persistSnapshot(documentKeyRef.current, snapshotWithPendingPoints(), false);
    };
  }, [cancelPointFrame, persistSnapshot, snapshotWithPendingPoints]);

  const requestFlushAfterState = useCallback(() => {
    flushAfterNextStateRef.current = true;
    if (flushFallbackTimerRef.current) clearTimeout(flushFallbackTimerRef.current);
    flushFallbackTimerRef.current = setTimeout(() => {
      if (!flushAfterNextStateRef.current) return;
      flushAfterNextStateRef.current = false;
      persistSnapshot(documentKeyRef.current, stateRef.current.strokes);
    }, 0);
  }, [persistSnapshot]);

  const endStroke = useCallback(() => {
    flushPendingPoints();
    requestFlushAfterState();
    dispatch({ type: "endStroke" });
  }, [flushPendingPoints, requestFlushAfterState]);

  const setMode = useCallback(
    (mode: AnnotationMode) => {
      if (
        mode === "navigate" &&
        (stateRef.current.activeStrokeId || pointBufferRef.current.length > 0)
      ) {
        endStroke();
      }
      dispatch({ type: "setMode", mode });
    },
    [endStroke],
  );

  const setTool = useCallback(
    (tool: AnnotationTool) => {
      if (stateRef.current.activeStrokeId || pointBufferRef.current.length > 0) {
        endStroke();
      }
      dispatch({ type: "setTool", tool });
    },
    [endStroke],
  );

  const setColor = useCallback((color: string) => {
    dispatch({ type: "setColor", color });
  }, []);

  const setWidth = useCallback((width: number) => {
    dispatch({ type: "setWidth", width });
  }, []);

  const beginStroke = useCallback(
    (point: StrokePoint, documentSize: AnnotationDocumentSize) => {
      flushPendingPoints();
      dispatch({
        type: "beginStroke",
        point: normalizeDocumentPoint(point, documentSize),
        documentSize,
      });
    },
    [flushPendingPoints],
  );

  const appendPoint = useCallback(
    (point: StrokePoint, documentSize: AnnotationDocumentSize) => {
      pointBufferRef.current.push(normalizeDocumentPoint(point, documentSize));
      if (animationFrameRef.current !== null) return;
      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = null;
        if (pointBufferRef.current.length === 0) return;
        const points = pointBufferRef.current;
        pointBufferRef.current = [];
        dispatchedPointsRef.current.push(...points);
        dispatch({ type: "appendPoints", points });
      });
    },
    [],
  );

  const eraseAt = useCallback(
    (x: number, y: number, targetSize: AnnotationDocumentSize) => {
      dispatch({ type: "eraseAt", x, y, targetSize });
    },
    [],
  );

  const undo = useCallback(() => {
    requestFlushAfterState();
    dispatch({ type: "undo" });
  }, [requestFlushAfterState]);

  const redo = useCallback(() => {
    requestFlushAfterState();
    dispatch({ type: "redo" });
  }, [requestFlushAfterState]);

  const clear = useCallback(() => {
    requestFlushAfterState();
    dispatch({ type: "clear" });
  }, [requestFlushAfterState]);

  return {
    documentKey,
    mode: state.mode,
    setMode,
    tool: state.tool,
    setTool,
    color: state.color,
    setColor,
    width: state.width,
    setWidth,
    strokes: state.strokes,
    beginStroke,
    appendPoint,
    endStroke,
    eraseAt,
    undo,
    redo,
    clear,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    storageError,
    clearStorageError: () => setStorageError(null),
  };
}

export type AnnotationStore = ReturnType<typeof useAnnotationStore>;
