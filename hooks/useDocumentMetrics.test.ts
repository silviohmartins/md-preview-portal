import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDocumentMetrics } from "./useDocumentMetrics";

describe("useDocumentMetrics", () => {
  afterEach(() => vi.useRealTimers());

  it("debounces recalculation when requestIdleCallback is unavailable", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ content }) => useDocumentMetrics(content),
      { initialProps: { content: "uma palavra" } },
    );

    expect(result.current.words).toBe(2);
    rerender({ content: "uma duas três quatro" });
    expect(result.current.words).toBe(2);

    act(() => vi.advanceTimersByTime(100));
    expect(result.current.words).toBe(4);
  });
});
