import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { createElement, StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  annotationStorageKey,
  parseAnnotationDoc,
} from "@/lib/annotations/storage";
import { useAnnotationStore } from "./useAnnotationStore";

const size = { width: 400, height: 800 };
let nextFrameId = 1;
let frames = new Map<number, FrameRequestCallback>();

describe("useAnnotationStore", () => {
  beforeEach(() => {
    localStorage.clear();
    frames = new Map();
    nextFrameId = 1;
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        const id = nextFrameId++;
        frames.set(id, callback);
        return id;
      }),
    );
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((id: number) => frames.delete(id)),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("batches a long stroke into at most one state update per frame", () => {
    const { result } = renderHook(() => useAnnotationStore("doc-a"));
    act(() => result.current.setMode("draw"));
    act(() => result.current.beginStroke({ x: 40, y: 80 }, size));

    act(() => {
      for (let index = 1; index <= 100; index++) {
        result.current.appendPoint({ x: 40 + index, y: 80 + index }, size);
      }
    });

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(result.current.strokes[0]?.points).toHaveLength(1);

    const callback = [...frames.values()][0]!;
    act(() => callback(16));

    expect(result.current.strokes[0]?.points).toHaveLength(101);
    expect(result.current.strokes[0]?.documentSize).toEqual(size);
  });

  it("flushes buffered points to the old key before switching documents", async () => {
    const { result, rerender } = renderHook(
      ({ documentKey }) => useAnnotationStore(documentKey),
      { initialProps: { documentKey: "doc-a" } },
    );
    act(() => result.current.setMode("draw"));
    act(() => result.current.beginStroke({ x: 40, y: 80 }, size));
    act(() => result.current.appendPoint({ x: 80, y: 160 }, size));

    rerender({ documentKey: "doc-b" });

    await waitFor(() => {
      const raw = localStorage.getItem(annotationStorageKey("doc-a"));
      expect(parseAnnotationDoc(raw)?.strokes[0]?.points).toHaveLength(2);
    });
    expect(result.current.documentKey).toBe("doc-b");
    expect(result.current.strokes).toEqual([]);
  });

  it("persists immediately when a stroke ends", () => {
    const { result } = renderHook(() => useAnnotationStore("doc-a"));
    act(() => result.current.setMode("draw"));
    act(() => result.current.beginStroke({ x: 40, y: 80 }, size));
    act(() => result.current.appendPoint({ x: 80, y: 160 }, size));
    act(() => result.current.endStroke());

    const raw = localStorage.getItem(annotationStorageKey("doc-a"));
    const persisted = parseAnnotationDoc(raw)?.strokes[0];
    expect(persisted?.points).toHaveLength(2);
    expect(persisted?.documentSize).toEqual(size);
  });

  it("resets and coalesces the persistence debounce", () => {
    vi.useFakeTimers();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { result } = renderHook(() => useAnnotationStore("doc-a"));
    setItem.mockClear();

    act(() => result.current.setMode("draw"));
    act(() => result.current.beginStroke({ x: 40, y: 80 }, size));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current.beginStroke({ x: 80, y: 160 }, size));
    act(() => vi.advanceTimersByTime(299));
    expect(setItem).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(setItem).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("surfaces annotation read failures", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    const { result } = renderHook(() => useAnnotationStore("doc-a"));

    await waitFor(() => {
      expect(result.current.storageError).toContain(
        "Não foi possível carregar as anotações armazenadas",
      );
    });
  });

  it("flushes points already dispatched when unload happens before React commits", () => {
    const { result } = renderHook(() => useAnnotationStore("doc-a"));

    act(() => {
      result.current.setMode("draw");
      result.current.beginStroke({ x: 40, y: 80 }, size);
    });
    act(() => {
      result.current.appendPoint({ x: 80, y: 160 }, size);
      result.current.endStroke();
      window.dispatchEvent(new Event("beforeunload"));
    });

    const raw = localStorage.getItem(annotationStorageKey("doc-a"));
    expect(parseAnnotationDoc(raw)?.strokes[0]?.points).toHaveLength(2);
  });

  it("does not erase preloaded strokes during StrictMode effect cleanup", () => {
    const key = annotationStorageKey("doc-a");
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 2,
        strokes: [
          {
            id: "stored",
            tool: "pen",
            color: "#111827",
            width: 3,
            points: [{ x: 0.1, y: 0.1 }],
            documentSize: size,
          },
        ],
      }),
    );
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(StrictMode, null, children);

    const { unmount } = renderHook(() => useAnnotationStore("doc-a"), {
      wrapper,
    });
    unmount();

    expect(parseAnnotationDoc(localStorage.getItem(key))?.strokes).toHaveLength(1);
  });

  it("surfaces quota failures", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const { result } = renderHook(() => useAnnotationStore("doc-a"));
    act(() => result.current.setMode("draw"));
    act(() => result.current.beginStroke({ x: 40, y: 80 }, size));
    act(() => result.current.endStroke());

    await waitFor(() => {
      expect(result.current.storageError).toContain(
        "Armazenamento de anotações cheio",
      );
    });
  });

  it("keeps a flush error visible when switching document keys", async () => {
    const { result, rerender } = renderHook(
      ({ documentKey }) => useAnnotationStore(documentKey),
      { initialProps: { documentKey: "doc-a" } },
    );
    act(() => result.current.setMode("draw"));
    act(() => result.current.beginStroke({ x: 40, y: 80 }, size));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    rerender({ documentKey: "doc-b" });

    await waitFor(() => {
      expect(result.current.storageError).toContain(
        "Armazenamento de anotações cheio",
      );
    });
  });
});
