import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FileSystemPort } from "@/lib/fs";
import type { FileEntry, FsCapabilities, OpenDirectoryResult } from "@/lib/fs";
import { DRAFT_KEY } from "@/lib/storage";
import { SAMPLE_MARKDOWN } from "@/lib/markdown";
import { useWorkspace } from "./useWorkspace";

function createMockPort(
  overrides: Partial<FileSystemPort> = {},
): FileSystemPort {
  const files = new Map<string, string>([
    ["readme.md", "# Hello"],
    ["docs/guide.md", "# Guide"],
  ]);

  const capabilities: FsCapabilities = {
    canOverwriteInPlace: true,
    canPersistDirectoryHandle: true,
  };

  const port: FileSystemPort = {
    getCapabilities: () => capabilities,
    openDirectory: async (): Promise<OpenDirectoryResult> => ({
      folderName: "demo",
      files: [...files.keys()].map(
        (path): FileEntry => ({
          path,
          name: path.split("/").pop()!,
          kind: "file",
        }),
      ),
    }),
    restoreDirectory: async () => null,
    persistDirectoryHandle: async () => undefined,
    clearPersistedDirectory: async () => undefined,
    readText: async (entry) => {
      const text = files.get(entry.path);
      if (text === undefined) throw new Error("missing");
      return text;
    },
    writeText: async (entry, content) => {
      files.set(entry.path, content);
    },
    ...overrides,
  };

  return port;
}

describe("useWorkspace", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hydrates draft from localStorage when no folder is restored", async () => {
    localStorage.setItem(DRAFT_KEY, "# rascunho");
    const port = createMockPort();
    const { result } = renderHook(() => useWorkspace({ port }));

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.markdown).toBe("# rascunho");
    expect(result.current.isFolderOpen).toBe(false);
  });

  it("keeps sample markdown when there is no draft", async () => {
    const port = createMockPort();
    const { result } = renderHook(() => useWorkspace({ port }));

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.markdown).toBe(SAMPLE_MARKDOWN);
  });

  it("opens a folder, lists files, and loads the first file", async () => {
    const port = createMockPort();
    const { result } = renderHook(() => useWorkspace({ port }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      await result.current.openFolder();
    });

    expect(result.current.folderName).toBe("demo");
    expect(result.current.files.map((f) => f.path)).toEqual([
      "readme.md",
      "docs/guide.md",
    ]);
    expect(result.current.activePath).toBe("readme.md");
    expect(result.current.markdown).toBe("# Hello");
    expect(result.current.dirty).toBe(false);
  });

  it("marks dirty on edit and saves via writeText", async () => {
    const writeText = vi.fn(async () => undefined);
    const port = createMockPort({ writeText });
    const { result } = renderHook(() => useWorkspace({ port }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      await result.current.openFolder();
    });

    act(() => {
      result.current.setMarkdown("# Edited");
    });
    expect(result.current.dirty).toBe(true);

    await act(async () => {
      await result.current.save();
    });

    expect(writeText).toHaveBeenCalledWith(
      expect.objectContaining({ path: "readme.md" }),
      "# Edited",
    );
    expect(result.current.dirty).toBe(false);
  });

  it("asks confirmation when switching files while dirty", async () => {
    const confirmDirtyChange = vi.fn(async () => "cancel" as const);
    const port = createMockPort();
    const { result } = renderHook(() =>
      useWorkspace({ port, confirmDirtyChange }),
    );
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      await result.current.openFolder();
    });

    act(() => {
      result.current.setMarkdown("# dirty");
    });

    await act(async () => {
      await result.current.openFile("docs/guide.md");
    });

    expect(confirmDirtyChange).toHaveBeenCalled();
    expect(result.current.activePath).toBe("readme.md");
    expect(result.current.markdown).toBe("# dirty");
  });

  it("discards dirty changes and opens the next file", async () => {
    const confirmDirtyChange = vi.fn(async () => "discard" as const);
    const port = createMockPort();
    const { result } = renderHook(() =>
      useWorkspace({ port, confirmDirtyChange }),
    );
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      await result.current.openFolder();
    });

    act(() => {
      result.current.setMarkdown("# dirty");
    });

    await act(async () => {
      await result.current.openFile("docs/guide.md");
    });

    expect(result.current.activePath).toBe("docs/guide.md");
    expect(result.current.markdown).toBe("# Guide");
    expect(result.current.dirty).toBe(false);
  });

  it("exposes capabilities from the port", async () => {
    const port = createMockPort({
      getCapabilities: () => ({
        canOverwriteInPlace: false,
        canPersistDirectoryHandle: false,
      }),
    });
    const { result } = renderHook(() => useWorkspace({ port }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.capabilities.canOverwriteInPlace).toBe(false);
  });

  it("auto-saves draft only when folder is closed", async () => {
    const port = createMockPort();
    const { result } = renderHook(() => useWorkspace({ port }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => {
      result.current.setMarkdown("# avulso");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(localStorage.getItem(DRAFT_KEY)).toBe("# avulso");

    await act(async () => {
      await result.current.openFolder();
    });

    act(() => {
      result.current.setMarkdown("# pasta");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(localStorage.getItem(DRAFT_KEY)).toBe("# avulso");
  });
});
