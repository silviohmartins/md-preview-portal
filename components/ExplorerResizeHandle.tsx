"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";

type ExplorerResizeHandleProps = {
  width: number;
  onWidthChange: (width: number) => void;
};

export function ExplorerResizeHandle({
  width,
  onWidthChange,
}: ExplorerResizeHandleProps) {
  const originRef = useRef({ x: 0, width: 0 });

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    originRef.current = { x: event.clientX, width };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    onWidthChange(originRef.current.width + event.clientX - originRef.current.x);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next = width;
    if (event.key === "ArrowLeft") next -= event.shiftKey ? 20 : 10;
    else if (event.key === "ArrowRight") next += event.shiftKey ? 20 : 10;
    else if (event.key === "Home") next = 220;
    else if (event.key === "End") next = 320;
    else return;
    event.preventDefault();
    onWidthChange(next);
  };

  return (
    <div
      role="separator"
      aria-label="Redimensionar explorador de arquivos"
      aria-orientation="vertical"
      aria-valuemin={220}
      aria-valuemax={320}
      aria-valuenow={width}
      tabIndex={0}
      className="explorer-resizer relative z-20 w-full cursor-col-resize touch-none bg-transparent outline-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onKeyDown={handleKeyDown}
      data-testid="explorer-resizer"
    />
  );
}
