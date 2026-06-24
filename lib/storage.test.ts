import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  clearDraft,
  createDebouncedDraftWriter,
  DRAFT_KEY,
  parseDraftOrSample,
  parseStoredTheme,
  readDraft,
  writeDraftImmediate,
  writeTheme,
  THEME_KEY,
} from "./storage";

const SAMPLE = "# Hello";

describe("storage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads and writes draft", () => {
    writeDraftImmediate("# test");
    expect(readDraft()).toEqual({ ok: true, value: "# test" });
  });

  it("parseDraftOrSample returns sample when empty", () => {
    expect(parseDraftOrSample(null, SAMPLE)).toBe(SAMPLE);
    expect(parseDraftOrSample("", SAMPLE)).toBe(SAMPLE);
  });

  it("parseDraftOrSample returns stored content", () => {
    expect(parseDraftOrSample("# saved", SAMPLE)).toBe("# saved");
  });

  it("debounces draft writes", () => {
    const writer = createDebouncedDraftWriter(500);
    writer.write("a");
    writer.write("ab");
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    vi.advanceTimersByTime(500);
    expect(localStorage.getItem(DRAFT_KEY)).toBe("ab");
  });

  it("falls back when localStorage throws on write", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota");
    });
    const onError = vi.fn();
    const writer = createDebouncedDraftWriter(100);
    writer.write("x", onError);
    vi.advanceTimersByTime(100);
    expect(onError).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("handles corrupt theme parse", () => {
    expect(parseStoredTheme("invalid")).toBeNull();
    expect(parseStoredTheme("dark")).toBe("dark");
  });

  it("persists theme preference", () => {
    writeTheme("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  });

  it("clears draft", () => {
    writeDraftImmediate("x");
    clearDraft();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});
