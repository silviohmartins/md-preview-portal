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

  it("parseDraftOrSample uses sample only when the draft is absent", () => {
    expect(parseDraftOrSample(null, SAMPLE)).toBe(SAMPLE);
    expect(parseDraftOrSample("", SAMPLE)).toBe("");
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

  it("flush writes pending draft immediately", () => {
    const writer = createDebouncedDraftWriter(500);
    writer.write("pending");
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(writer.flush()).toEqual({ ok: true, value: undefined });
    expect(localStorage.getItem(DRAFT_KEY)).toBe("pending");
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
