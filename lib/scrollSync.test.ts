import { describe, expect, it, vi } from "vitest";
import { attachScrollSync, getSyncedScrollTop } from "./scrollSync";

function fakeScroller(partial: {
  scrollTop?: number;
  scrollHeight: number;
  clientHeight: number;
}) {
  return {
    scrollTop: partial.scrollTop ?? 0,
    scrollHeight: partial.scrollHeight,
    clientHeight: partial.clientHeight,
  };
}

describe("getSyncedScrollTop", () => {
  it("maps proportional scroll between panes", () => {
    const source = fakeScroller({
      scrollTop: 50,
      scrollHeight: 200,
      clientHeight: 100,
    });
    const target = fakeScroller({ scrollHeight: 400, clientHeight: 100 });
    // sourceMax=100, ratio=0.5 → targetMax=300 → 150
    expect(getSyncedScrollTop(source, target)).toBe(150);
  });

  it("returns 0 when either pane cannot scroll", () => {
    expect(
      getSyncedScrollTop(
        fakeScroller({ scrollTop: 10, scrollHeight: 100, clientHeight: 100 }),
        fakeScroller({ scrollHeight: 400, clientHeight: 100 }),
      ),
    ).toBe(0);
    expect(
      getSyncedScrollTop(
        fakeScroller({ scrollTop: 10, scrollHeight: 200, clientHeight: 100 }),
        fakeScroller({ scrollHeight: 80, clientHeight: 100 }),
      ),
    ).toBe(0);
  });
});

describe("attachScrollSync", () => {
  it("syncs target when source scrolls and cleans up listeners", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    const left = document.createElement("div");
    const right = document.createElement("div");

    Object.defineProperty(left, "scrollHeight", { value: 200, configurable: true });
    Object.defineProperty(left, "clientHeight", { value: 100, configurable: true });
    Object.defineProperty(right, "scrollHeight", { value: 400, configurable: true });
    Object.defineProperty(right, "clientHeight", { value: 100, configurable: true });

    left.scrollTop = 50;
    right.scrollTop = 0;

    const detach = attachScrollSync(left, right);
    expect(right.scrollTop).toBe(150);

    left.scrollTop = 100;
    left.dispatchEvent(new Event("scroll"));
    expect(right.scrollTop).toBe(300);

    right.scrollTop = 0;
    right.dispatchEvent(new Event("scroll"));
    expect(left.scrollTop).toBe(0);

    detach();
    left.scrollTop = 50;
    left.dispatchEvent(new Event("scroll"));
    expect(right.scrollTop).toBe(0);

    vi.unstubAllGlobals();
  });
});
