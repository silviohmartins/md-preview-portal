import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileTree } from "./FileTree";

describe("FileTree", () => {
  afterEach(cleanup);

  it("virtualizes folders with more than 100 Markdown files", () => {
    const files = Array.from({ length: 250 }, (_, index) => ({
      path: `docs/file-${index.toString().padStart(3, "0")}.md`,
      name: `file-${index}.md`,
      kind: "file" as const,
    }));
    const { container } = render(
      <FileTree
        files={files}
        activePath={null}
        dirty={false}
        folderName="docs"
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
      />,
    );

    const scroller = container.querySelector<HTMLElement>(
      '[data-virtualized="true"]',
    );
    expect(scroller).not.toBeNull();
    expect(screen.getAllByRole("treeitem").length).toBeLessThan(250);
    expect(screen.queryByTestId("file-tree-item-docs/file-200.md")).toBeNull();
    expect(scroller!.querySelector("ul")?.style.height).toBe("10000px");
    expect(screen.getAllByRole("treeitem")[0].className).toContain("h-10");

    scroller!.scrollTop = 200 * 40;
    fireEvent.scroll(scroller!);

    expect(screen.getByTestId("file-tree-item-docs/file-200.md")).toBeTruthy();
  });

  it("keeps off-screen virtualized files reachable by keyboard", async () => {
    const files = Array.from({ length: 250 }, (_, index) => ({
      path: `file-${index.toString().padStart(3, "0")}.md`,
      name: `file-${index}.md`,
      kind: "file" as const,
    }));
    render(
      <FileTree
        files={files}
        activePath="file-000.md"
        dirty={false}
        folderName="docs"
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
      />,
    );

    const first = screen.getByTestId("file-tree-item-file-000.md");
    first.focus();
    fireEvent.keyDown(first, { key: "End" });

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByTestId("file-tree-item-file-249.md"),
      );
    });
  });

  it("keeps one tree item tabbable after switching to a smaller folder", () => {
    const largeFiles = Array.from({ length: 150 }, (_, index) => ({
      path: `file-${index}.md`,
      name: `file-${index}.md`,
      kind: "file" as const,
    }));
    const props = {
      dirty: false,
      folderName: "docs",
      onOpenFile: vi.fn(),
      onOpenFolder: vi.fn(),
    };
    const { rerender } = render(
      <FileTree
        {...props}
        files={largeFiles}
        activePath="file-149.md"
      />,
    );

    rerender(
      <FileTree
        {...props}
        files={largeFiles.slice(0, 2)}
        activePath={null}
      />,
    );

    const tabbableItems = screen
      .getAllByRole("treeitem")
      .filter((item) => item.getAttribute("tabindex") === "0");
    expect(tabbableItems).toHaveLength(1);
  });
});
