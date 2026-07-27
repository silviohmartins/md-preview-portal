"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  annotationReducer,
  createInitialAnnotationState,
} from "@/lib/annotations/store";
import { readAnnotations, writeAnnotations } from "@/lib/annotations/storage";
import type {
  AnnotationMode,
  AnnotationTool,
  StrokePoint,
} from "@/lib/annotations/types";

export function useAnnotationStore(documentKey: string) {
  const [state, dispatch] = useReducer(
    annotationReducer,
    undefined,
    () => createInitialAnnotationState(),
  );
  const documentKeyRef = useRef(documentKey);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const strokesRef = useRef(state.strokes);
  const skipNextPersistRef = useRef(false);
  strokesRef.current = state.strokes;

  useEffect(() => {
    documentKeyRef.current = documentKey;
    skipNextPersistRef.current = true;
    const result = readAnnotations(documentKey);
    dispatch({
      type: "load",
      strokes: result.ok ? result.value : [],
    });
  }, [documentKey]);

  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    const key = documentKeyRef.current;
    persistTimerRef.current = setTimeout(() => {
      writeAnnotations(key, strokesRef.current);
    }, 300);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [state.strokes, documentKey]);

  useEffect(() => {
    const flush = () => {
      writeAnnotations(documentKeyRef.current, strokesRef.current);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, []);

  const setMode = useCallback((mode: AnnotationMode) => {
    dispatch({ type: "setMode", mode });
  }, []);

  const setTool = useCallback((tool: AnnotationTool) => {
    dispatch({ type: "setTool", tool });
  }, []);

  const setColor = useCallback((color: string) => {
    dispatch({ type: "setColor", color });
  }, []);

  const setWidth = useCallback((width: number) => {
    dispatch({ type: "setWidth", width });
  }, []);

  const beginStroke = useCallback((point: StrokePoint) => {
    dispatch({ type: "beginStroke", point });
  }, []);

  const appendPoint = useCallback((point: StrokePoint) => {
    dispatch({ type: "appendPoint", point });
  }, []);

  const endStroke = useCallback(() => {
    dispatch({ type: "endStroke" });
  }, []);

  const eraseAt = useCallback((x: number, y: number) => {
    dispatch({ type: "eraseAt", x, y });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: "undo" });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: "redo" });
  }, []);

  const clear = useCallback(() => {
    dispatch({ type: "clear" });
  }, []);

  return {
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
  };
}

export type AnnotationStore = ReturnType<typeof useAnnotationStore>;
