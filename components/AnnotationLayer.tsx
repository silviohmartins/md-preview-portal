"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";
import { strokeToSvgPath } from "@/lib/annotations/freehand";
import {
  clientToDocumentPoint,
  measureContentSize,
} from "@/lib/annotations/geometry";
import type { AnnotationStore } from "@/hooks/useAnnotationStore";
import type { Stroke } from "@/lib/annotations/types";

type AnnotationLayerProps = {
  store: AnnotationStore;
  contentRef: RefObject<HTMLElement | null>;
  scrollRef: RefObject<HTMLElement | null>;
};

export function AnnotationLayer({
  store,
  contentRef,
  scrollRef,
}: AnnotationLayerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drawingRef = useRef(false);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const {
    mode,
    tool,
    strokes,
    beginStroke,
    appendPoint,
    endStroke,
    eraseAt,
  } = store;

  const syncSize = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    setSize(measureContentSize(content));
  }, [contentRef]);

  useEffect(() => {
    syncSize();
    const content = contentRef.current;
    if (!content) return;

    const ro = new ResizeObserver(() => syncSize());
    ro.observe(content);
    const mo = new MutationObserver(() => syncSize());
    mo.observe(content, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [contentRef, syncSize, strokes.length]);

  const toDocPoint = useCallback(
    (clientX: number, clientY: number) => {
      const content = contentRef.current;
      if (!content) return null;
      return clientToDocumentPoint(clientX, clientY, content, scrollRef.current ?? undefined);
    },
    [contentRef, scrollRef],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (mode !== "draw") return;
      if (event.button !== 0) return;
      const point = toDocPoint(event.clientX, event.clientY);
      if (!point) return;

      event.currentTarget.setPointerCapture(event.pointerId);
      drawingRef.current = true;

      if (tool === "eraser") {
        eraseAt(point.x, point.y);
        return;
      }

      beginStroke({
        x: point.x,
        y: point.y,
        p: event.pressure > 0 ? event.pressure : undefined,
      });
    },
    [mode, tool, toDocPoint, eraseAt, beginStroke],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (!drawingRef.current || mode !== "draw") return;
      const point = toDocPoint(event.clientX, event.clientY);
      if (!point) return;

      if (tool === "eraser") {
        eraseAt(point.x, point.y);
        return;
      }

      appendPoint({
        x: point.x,
        y: point.y,
        p: event.pressure > 0 ? event.pressure : undefined,
      });
    },
    [mode, tool, toDocPoint, eraseAt, appendPoint],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (tool !== "eraser") endStroke();
    },
    [tool, endStroke],
  );

  return (
    <svg
      ref={svgRef}
      data-testid="annotation-layer"
      className="absolute left-0 top-0 z-10 touch-none"
      width={size.width || "100%"}
      height={size.height || "100%"}
      style={{
        pointerEvents: mode === "draw" ? "auto" : "none",
        cursor:
          mode === "draw"
            ? tool === "eraser"
              ? "cell"
              : "crosshair"
            : "default",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {strokes.map((stroke) => (
        <StrokePath key={stroke.id} stroke={stroke} />
      ))}
    </svg>
  );
}

function StrokePath({ stroke }: { stroke: Stroke }) {
  const d = strokeToSvgPath(stroke);
  if (!d) return null;
  return (
    <path
      d={d}
      fill={stroke.color}
      fillOpacity={stroke.tool === "highlighter" ? 0.35 : 1}
      stroke="none"
    />
  );
}
