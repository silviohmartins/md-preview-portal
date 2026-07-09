import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DRAFT_KEY } from "@/lib/storage";
import { SAMPLE_MARKDOWN } from "@/lib/markdown";
import { useMarkdownDraft } from "./useMarkdownDraft";

describe("useMarkdownDraft", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hydrates from localStorage when a draft exists", () => {
    localStorage.setItem(DRAFT_KEY, "# salvo");
    const { result } = renderHook(() => useMarkdownDraft());

    expect(result.current.hydrated).toBe(true);
    expect(result.current.markdown).toBe("# salvo");
  });

  it("keeps sample markdown when there is no draft", () => {
    const { result } = renderHook(() => useMarkdownDraft());
    expect(result.current.markdown).toBe(SAMPLE_MARKDOWN);
  });

  it("debounces writes and flush on unmount", () => {
    const { result, unmount } = renderHook(() => useMarkdownDraft());

    act(() => {
      result.current.setMarkdown("# novo");
    });
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(localStorage.getItem(DRAFT_KEY)).toBe("# novo");

    act(() => {
      result.current.setMarkdown("# pendente");
    });
    unmount();
    expect(localStorage.getItem(DRAFT_KEY)).toBe("# pendente");
  });

  it("resetToSample clears draft and restores sample", () => {
    localStorage.setItem(DRAFT_KEY, "# antigo");
    const { result } = renderHook(() => useMarkdownDraft());

    act(() => {
      result.current.resetToSample();
    });

    expect(result.current.markdown).toBe(SAMPLE_MARKDOWN);
    expect(localStorage.getItem(DRAFT_KEY)).toBe(SAMPLE_MARKDOWN);
  });
});
