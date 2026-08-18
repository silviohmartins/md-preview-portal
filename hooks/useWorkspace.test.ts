import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FileSystemPort } from "@/lib/fs";
import type { FileEntry, FsCapabilities, OpenDirectoryResult } from "@/lib/fs";
import { DRAFT_KEY } from "@/lib/storage";
import { SAMPLE_MARKDOWN } from "@/lib/markdown";
import { type DirtyDecision, useWorkspace } from "./useWorkspace";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

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
      workspaceId: "workspace-demo",
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
    commitDirectory: () => undefined,
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

  it("clears the standalone document instead of restoring the sample", async () => {
    localStorage.setItem(DRAFT_KEY, "# rascunho a apagar");
    const port = createMockPort();
    const { result } = renderHook(() => useWorkspace({ port }));

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => result.current.clearDocument());

    expect(result.current.markdown).toBe("");
    expect(result.current.isFolderOpen).toBe(false);
    expect(localStorage.getItem(DRAFT_KEY)).toBe("");
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

  it("exposes folder enumeration progress until the candidate is ready", async () => {
    const pendingDirectory = deferred<OpenDirectoryResult>();
    const openDirectory = vi.fn<FileSystemPort["openDirectory"]>((options) => {
      options?.onProgress?.({
        filesFound: 125,
        directoriesVisited: 8,
        skippedDirectories: 0,
        currentPath: "docs/guias",
      });
      return pendingDirectory.promise;
    });
    const port = createMockPort({ openDirectory });
    const { result } = renderHook(() => useWorkspace({ port }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let opening!: Promise<void>;
    act(() => {
      opening = result.current.openFolder();
    });
    await waitFor(() => expect(result.current.isEnumerating).toBe(true));
    expect(result.current.enumerationProgress).toMatchObject({
      filesFound: 125,
      currentPath: "docs/guias",
    });

    pendingDirectory.resolve({
      workspaceId: "workspace-grande",
      folderName: "docs",
      files: [],
    });
    await act(async () => opening);

    expect(result.current.isEnumerating).toBe(false);
    expect(result.current.enumerationProgress).toBeNull();
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

  it("finishes hydration when directory restoration fails", async () => {
    const port = createMockPort({
      restoreDirectory: async () => {
        throw new Error("restauração indisponível");
      },
    });
    const { result } = renderHook(() => useWorkspace({ port }));

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.isFolderOpen).toBe(false);
    expect(result.current.markdown).toBe(SAMPLE_MARKDOWN);
    expect(result.current.storageWarning).toBe("restauração indisponível");
  });

  it("restores an empty folder as a valid session", async () => {
    const restored: OpenDirectoryResult = {
      workspaceId: "workspace-vazia",
      folderName: "vazia",
      files: [],
    };
    const commitDirectory = vi.fn();
    const port = createMockPort({
      restoreDirectory: async () => restored,
      commitDirectory,
    });
    const { result } = renderHook(() => useWorkspace({ port }));

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(commitDirectory).toHaveBeenCalledWith(restored);
    expect(result.current.folderName).toBe("vazia");
    expect(result.current.files).toEqual([]);
    expect(result.current.activePath).toBeNull();
    expect(result.current.markdown).toBe("");
    expect(result.current.fsError).toBeNull();
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

  it("opens an empty folder as a valid session", async () => {
    const directory: OpenDirectoryResult = {
      workspaceId: "workspace-vazia",
      folderName: "vazia",
      files: [],
    };
    const commitDirectory = vi.fn();
    const port = createMockPort({
      openDirectory: async () => directory,
      commitDirectory,
    });
    const { result } = renderHook(() => useWorkspace({ port }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      await result.current.openFolder();
    });

    expect(commitDirectory).toHaveBeenLastCalledWith(directory);
    expect(result.current.folderName).toBe("vazia");
    expect(result.current.files).toEqual([]);
    expect(result.current.activePath).toBeNull();
    expect(result.current.markdown).toBe("");
    expect(result.current.fsError).toBeNull();
  });

  it("does not block folder opening on handle persistence", async () => {
    const pendingPersistence = deferred<void>();
    const persistDirectoryHandle = vi.fn(() => pendingPersistence.promise);
    const port = createMockPort({ persistDirectoryHandle });
    const { result } = renderHook(() => useWorkspace({ port }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      await result.current.openFolder();
    });

    expect(result.current.folderName).toBe("demo");
    expect(result.current.activePath).toBe("readme.md");
    expect(persistDirectoryHandle).toHaveBeenCalledTimes(1);
    pendingPersistence.resolve(undefined);
  });

  it("reports handle persistence failure without closing the folder", async () => {
    const persistDirectoryHandle = vi.fn(async () => {
      throw new Error("IndexedDB bloqueado");
    });
    const port = createMockPort({ persistDirectoryHandle });
    const { result } = renderHook(() => useWorkspace({ port }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      await result.current.openFolder();
    });
    await waitFor(() =>
      expect(result.current.storageWarning).toBe("IndexedDB bloqueado"),
    );

    expect(result.current.folderName).toBe("demo");
    expect(result.current.activePath).toBe("readme.md");
  });

  it("recovers from persisted-handle cleanup failure when closing", async () => {
    const commitDirectory = vi.fn();
    const port = createMockPort({
      commitDirectory,
      clearPersistedDirectory: async () => {
        throw new Error("não foi possível limpar IndexedDB");
      },
    });
    const { result } = renderHook(() => useWorkspace({ port }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.openFolder();
    });

    await act(async () => {
      await result.current.closeFolder();
    });

    expect(commitDirectory).toHaveBeenLastCalledWith(null);
    expect(result.current.isFolderOpen).toBe(false);
    expect(result.current.storageWarning).toBe(
      "não foi possível limpar IndexedDB",
    );
  });

  it("shares one dirty confirmation and honors the latest file request", async () => {
    const decision = deferred<DirtyDecision>();
    const confirmDirtyChange = vi.fn(() => decision.promise);
    const entries: FileEntry[] = ["readme.md", "guide.md", "notes.md"].map(
      (path) => ({ path, name: path, kind: "file" }),
    );
    const contents = new Map([
      ["readme.md", "# Readme"],
      ["guide.md", "# Guide"],
      ["notes.md", "# Notes"],
    ]);
    const port = createMockPort({
      openDirectory: async () => ({
        workspaceId: "workspace-demo",
        folderName: "demo",
        files: entries,
      }),
      readText: async (entry) => contents.get(entry.path) ?? "",
    });
    const { result } = renderHook(() =>
      useWorkspace({ port, confirmDirtyChange }),
    );
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.openFolder();
    });
    act(() => result.current.setMarkdown("# dirty"));

    let openGuide!: Promise<void>;
    let openNotes!: Promise<void>;
    act(() => {
      openGuide = result.current.openFile("guide.md");
      openNotes = result.current.openFile("notes.md");
    });
    await waitFor(() => expect(confirmDirtyChange).toHaveBeenCalledTimes(1));
    decision.resolve("discard");
    await act(async () => Promise.all([openGuide, openNotes]));

    expect(result.current.activePath).toBe("notes.md");
    expect(result.current.markdown).toBe("# Notes");
  });

  it("keeps dirty when the buffer changes during a save", async () => {
    const pendingWrite = deferred<void>();
    const writeText = vi
      .fn<FileSystemPort["writeText"]>()
      .mockImplementation(() => pendingWrite.promise);
    const port = createMockPort({ writeText });
    const { result } = renderHook(() => useWorkspace({ port }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      await result.current.openFolder();
    });
    act(() => result.current.setMarkdown("# primeira edição"));

    let savePromise!: Promise<void>;
    act(() => {
      savePromise = result.current.save();
    });
    await waitFor(() => expect(result.current.saving).toBe(true));
    expect(result.current.saveStatus).toBe("saving");

    act(() => result.current.setMarkdown("# edição durante salvamento"));
    expect(writeText).toHaveBeenCalledWith(
      expect.objectContaining({ path: "readme.md" }),
      "# primeira edição",
    );
    pendingWrite.resolve(undefined);
    await act(async () => savePromise);

    expect(result.current.markdown).toBe("# edição durante salvamento");
    expect(result.current.dirty).toBe(true);
    expect(result.current.saveStatus).toBe("unsaved");
  });

  it("coalesces two concurrent saves into one write", async () => {
    const pendingWrite = deferred<void>();
    const writeText = vi.fn(() => pendingWrite.promise);
    const port = createMockPort({ writeText });
    const { result } = renderHook(() => useWorkspace({ port }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      await result.current.openFolder();
    });
    act(() => result.current.setMarkdown("# conteúdo novo"));

    let firstSave!: Promise<void>;
    let secondSave!: Promise<void>;
    act(() => {
      firstSave = result.current.save();
      secondSave = result.current.save();
    });
    await waitFor(() => expect(result.current.saving).toBe(true));
    pendingWrite.resolve(undefined);
    await act(async () => Promise.all([firstSave, secondSave]));

    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it("does not report an edit between concurrent save requests as saved", async () => {
    const pendingWrite = deferred<void>();
    const writeText = vi
      .fn<FileSystemPort["writeText"]>()
      .mockImplementation(() => pendingWrite.promise);
    const port = createMockPort({ writeText });
    const { result } = renderHook(() => useWorkspace({ port }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.openFolder();
    });
    act(() => result.current.setMarkdown("# revisão capturada"));

    let firstSave!: Promise<void>;
    let secondSave!: Promise<void>;
    act(() => {
      firstSave = result.current.save();
    });
    await waitFor(() => expect(result.current.saving).toBe(true));
    act(() => {
      result.current.setMarkdown("# revisão posterior");
      secondSave = result.current.save();
    });
    pendingWrite.resolve(undefined);
    await act(async () => Promise.all([firstSave, secondSave]));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]?.[1]).toBe("# revisão capturada");
    expect(result.current.markdown).toBe("# revisão posterior");
    expect(result.current.dirty).toBe(true);
    expect(result.current.saveStatus).toBe("unsaved");
  });

  it("increments the document revision monotonically", async () => {
    const port = createMockPort();
    const { result } = renderHook(() => useWorkspace({ port }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.openFolder();
    });
    const openedRevision = result.current.documentRevision;

    act(() => result.current.setMarkdown("# primeira"));
    const firstEditRevision = result.current.documentRevision;
    act(() => result.current.setMarkdown("# segunda"));
    const secondEditRevision = result.current.documentRevision;
    act(() => result.current.setMarkdown("# segunda"));

    expect(firstEditRevision).toBeGreaterThan(openedRevision);
    expect(secondEditRevision).toBeGreaterThan(firstEditRevision);
    expect(result.current.documentRevision).toBe(secondEditRevision);
  });

  it("does not switch files when the buffer changes during dirty-guard save", async () => {
    const pendingWrite = deferred<void>();
    const writeText = vi.fn(() => pendingWrite.promise);
    const confirmDirtyChange = vi.fn(async () => "save" as const);
    const port = createMockPort({ writeText });
    const { result } = renderHook(() =>
      useWorkspace({ port, confirmDirtyChange }),
    );
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.openFolder();
    });
    act(() => result.current.setMarkdown("# revisão a salvar"));

    let switchPromise!: Promise<void>;
    act(() => {
      switchPromise = result.current.openFile("docs/guide.md");
    });
    await waitFor(() => expect(result.current.saving).toBe(true));
    expect(result.current.activePath).toBe("readme.md");

    act(() => result.current.setMarkdown("# revisão ainda mais nova"));
    pendingWrite.resolve(undefined);
    await act(async () => switchPromise);

    expect(writeText).toHaveBeenCalledWith(
      expect.objectContaining({ path: "readme.md" }),
      "# revisão a salvar",
    );
    expect(result.current.activePath).toBe("readme.md");
    expect(result.current.markdown).toBe("# revisão ainda mais nova");
    expect(result.current.dirty).toBe(true);
    expect(result.current.saveStatus).toBe("unsaved");
  });

  it("preserves an edit made after dirty-guard save while the next file is reading", async () => {
    const pendingWrite = deferred<void>();
    const guideRead = deferred<string>();
    const writeText = vi.fn(() => pendingWrite.promise);
    const readText = vi.fn(async (entry: FileEntry) => {
      if (entry.path === "docs/guide.md") return guideRead.promise;
      return "# Hello";
    });
    const confirmDirtyChange = vi.fn(async () => "save" as const);
    const port = createMockPort({ readText, writeText });
    const { result } = renderHook(() =>
      useWorkspace({ port, confirmDirtyChange }),
    );
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.openFolder();
    });
    act(() => result.current.setMarkdown("# revisão salva pelo guard"));

    let switchPromise!: Promise<void>;
    act(() => {
      switchPromise = result.current.openFile("docs/guide.md");
    });
    await waitFor(() => expect(result.current.saving).toBe(true));
    pendingWrite.resolve(undefined);
    await waitFor(() => expect(readText).toHaveBeenCalledTimes(2));

    act(() => result.current.setMarkdown("# edição feita durante a leitura"));
    guideRead.resolve("# Guide");
    await act(async () => switchPromise);

    expect(result.current.activePath).toBe("readme.md");
    expect(result.current.markdown).toBe("# edição feita durante a leitura");
    expect(result.current.dirty).toBe(true);
    expect(result.current.fsError).toBeNull();
  });

  it("waits for an ordinary save and keeps navigation blocked after a newer edit", async () => {
    const pendingWrite = deferred<void>();
    const writeText = vi.fn(() => pendingWrite.promise);
    const confirmDirtyChange = vi.fn(async () => "cancel" as const);
    const port = createMockPort({ writeText });
    const { result } = renderHook(() =>
      useWorkspace({ port, confirmDirtyChange }),
    );
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.openFolder();
    });
    act(() => result.current.setMarkdown("# revisão em escrita"));

    let savePromise!: Promise<void>;
    let switchPromise!: Promise<void>;
    act(() => {
      savePromise = result.current.save();
      switchPromise = result.current.openFile("docs/guide.md");
    });
    await waitFor(() => expect(result.current.saving).toBe(true));
    act(() => result.current.setMarkdown("# revisão posterior"));
    pendingWrite.resolve(undefined);
    await act(async () => Promise.all([savePromise, switchPromise]));

    expect(confirmDirtyChange).toHaveBeenCalledTimes(1);
    expect(result.current.activePath).toBe("readme.md");
    expect(result.current.markdown).toBe("# revisão posterior");
    expect(result.current.dirty).toBe(true);
  });

  it("switches files only after dirty-guard save finishes", async () => {
    const pendingWrite = deferred<void>();
    const writeText = vi.fn(() => pendingWrite.promise);
    const confirmDirtyChange = vi.fn(async () => "save" as const);
    const port = createMockPort({ writeText });
    const { result } = renderHook(() =>
      useWorkspace({ port, confirmDirtyChange }),
    );
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.openFolder();
    });
    act(() => result.current.setMarkdown("# pronto para salvar"));

    let switchPromise!: Promise<void>;
    act(() => {
      switchPromise = result.current.openFile("docs/guide.md");
    });
    await waitFor(() => expect(result.current.saving).toBe(true));
    expect(result.current.activePath).toBe("readme.md");

    pendingWrite.resolve(undefined);
    await act(async () => switchPromise);

    expect(result.current.activePath).toBe("docs/guide.md");
    expect(result.current.markdown).toBe("# Guide");
    expect(result.current.dirty).toBe(false);
    expect(result.current.saveStatus).toBe("saved");
  });

  it("preserves edits made while a replacement folder is opening", async () => {
    const nextDirectory = deferred<OpenDirectoryResult>();
    const previousEntries: FileEntry[] = [
      { path: "readme.md", name: "readme.md", kind: "file" },
      { path: "docs/guide.md", name: "guide.md", kind: "file" },
    ];
    const openDirectory = vi
      .fn<FileSystemPort["openDirectory"]>()
      .mockResolvedValueOnce({
        workspaceId: "workspace-anterior",
        folderName: "anterior",
        files: previousEntries,
      })
      .mockImplementationOnce(() => nextDirectory.promise);
    const confirmDirtyChange = vi.fn(async () => "save" as const);
    const port = createMockPort({ openDirectory });
    const { result } = renderHook(() =>
      useWorkspace({ port, confirmDirtyChange }),
    );
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.openFolder();
    });
    act(() => result.current.setMarkdown("# revisão antes da pasta"));

    let folderPromise!: Promise<void>;
    act(() => {
      folderPromise = result.current.openFolder();
    });
    await waitFor(() => expect(openDirectory).toHaveBeenCalledTimes(2));
    act(() => result.current.setMarkdown("# edição durante abertura da pasta"));
    nextDirectory.resolve({
      workspaceId: "workspace-nova",
      folderName: "nova",
      files: [{ path: "next.md", name: "next.md", kind: "file" }],
    });
    await act(async () => folderPromise);

    expect(result.current.folderName).toBe("anterior");
    expect(result.current.files).toEqual(previousEntries);
    expect(result.current.activePath).toBe("readme.md");
    expect(result.current.markdown).toBe("# edição durante abertura da pasta");
    expect(result.current.dirty).toBe(true);
    expect(result.current.fsError).toBeNull();
  });

  it("commits close before slow cleanup and preserves subsequent draft edits", async () => {
    const pendingClear = deferred<void>();
    const clearPersistedDirectory = vi.fn(() => pendingClear.promise);
    const confirmDirtyChange = vi.fn(async () => "save" as const);
    const port = createMockPort({ clearPersistedDirectory });
    const { result } = renderHook(() =>
      useWorkspace({ port, confirmDirtyChange }),
    );
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.openFolder();
    });
    act(() => result.current.setMarkdown("# revisão antes de fechar"));

    let closePromise!: Promise<void>;
    act(() => {
      closePromise = result.current.closeFolder();
    });
    await waitFor(() => expect(clearPersistedDirectory).toHaveBeenCalled());
    act(() => result.current.setMarkdown("# edição durante fechamento"));
    pendingClear.resolve(undefined);
    await act(async () => closePromise);

    expect(result.current.folderName).toBeNull();
    expect(result.current.activePath).toBeNull();
    expect(result.current.markdown).toBe("# edição durante fechamento");
    expect(result.current.dirty).toBe(false);
    expect(result.current.fsError).toBeNull();
  });

  it("keeps the buffer dirty and exposes save failure", async () => {
    const writeText = vi.fn(async () => {
      throw new Error("disco indisponível");
    });
    const port = createMockPort({ writeText });
    const { result } = renderHook(() => useWorkspace({ port }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.openFolder();
    });
    act(() => result.current.setMarkdown("# conteúdo preservado"));

    await act(async () => {
      await result.current.save();
    });

    expect(result.current.markdown).toBe("# conteúdo preservado");
    expect(result.current.dirty).toBe(true);
    expect(result.current.saving).toBe(false);
    expect(result.current.saveStatus).toBe("error");
    expect(result.current.fsError).toBe("disco indisponível");
  });

  it("keeps dirty without a failure status when the save is aborted", async () => {
    const abortError = Object.assign(new Error("cancelado"), {
      name: "AbortError",
    });
    const writeText = vi.fn(async () => {
      throw abortError;
    });
    const port = createMockPort({ writeText });
    const { result } = renderHook(() => useWorkspace({ port }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.openFolder();
    });
    act(() => result.current.setMarkdown("# conteúdo não salvo"));

    await act(async () => {
      await result.current.save();
    });

    expect(result.current.markdown).toBe("# conteúdo não salvo");
    expect(result.current.dirty).toBe(true);
    expect(result.current.saveStatus).toBe("unsaved");
    expect(result.current.fsError).toBeNull();
  });

  it("recovers from a synchronous filesystem write failure", async () => {
    const writeText = vi.fn(() => {
      throw new Error("falha síncrona");
    }) as unknown as FileSystemPort["writeText"];
    const port = createMockPort({ writeText });
    const { result } = renderHook(() => useWorkspace({ port }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.openFolder();
    });
    act(() => result.current.setMarkdown("# conteúdo preservado"));

    await act(async () => {
      await result.current.save();
    });

    expect(result.current.dirty).toBe(true);
    expect(result.current.saving).toBe(false);
    expect(result.current.saveStatus).toBe("error");
    expect(result.current.fsError).toBe("falha síncrona");
  });

  it("retries the latest buffer after a failed write", async () => {
    const writeText = vi
      .fn<FileSystemPort["writeText"]>()
      .mockRejectedValueOnce(new Error("primeira falha"))
      .mockResolvedValueOnce(undefined);
    const port = createMockPort({ writeText });
    const { result } = renderHook(() => useWorkspace({ port }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.openFolder();
    });
    act(() => result.current.setMarkdown("# primeira tentativa"));
    await act(async () => {
      await result.current.save();
    });
    act(() => result.current.setMarkdown("# revisão para retry"));

    await act(async () => {
      await result.current.save();
    });

    expect(writeText).toHaveBeenCalledTimes(2);
    expect(writeText.mock.calls[1]?.[1]).toBe("# revisão para retry");
    expect(result.current.dirty).toBe(false);
    expect(result.current.saveStatus).toBe("saved");
    expect(result.current.fsError).toBeNull();
  });

  it("saves the newer revision on an explicit retry", async () => {
    const firstWrite = deferred<void>();
    const writeText = vi
      .fn<FileSystemPort["writeText"]>()
      .mockImplementationOnce(() => firstWrite.promise)
      .mockResolvedValueOnce(undefined);
    const port = createMockPort({ writeText });
    const { result } = renderHook(() => useWorkspace({ port }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.openFolder();
    });
    act(() => result.current.setMarkdown("# revisão 1"));

    let firstSave!: Promise<void>;
    act(() => {
      firstSave = result.current.save();
    });
    await waitFor(() => expect(result.current.saving).toBe(true));
    act(() => result.current.setMarkdown("# revisão 2"));
    firstWrite.resolve(undefined);
    await act(async () => firstSave);

    await act(async () => {
      await result.current.save();
    });

    expect(writeText).toHaveBeenCalledTimes(2);
    expect(writeText.mock.calls[1]?.[1]).toBe("# revisão 2");
    expect(result.current.dirty).toBe(false);
    expect(result.current.saveStatus).toBe("saved");
  });

  it("keeps the last selected file after two rapid opens", async () => {
    const guideRead = deferred<string>();
    const notesRead = deferred<string>();
    const entries: FileEntry[] = ["readme.md", "guide.md", "notes.md"].map(
      (path) => ({ path, name: path, kind: "file" }),
    );
    const port = createMockPort({
      openDirectory: async () => ({
        workspaceId: "workspace-demo",
        folderName: "demo",
        files: entries,
      }),
      readText: async (entry) => {
        if (entry.path === "guide.md") return guideRead.promise;
        if (entry.path === "notes.md") return notesRead.promise;
        return "# inicial";
      },
    });
    const { result } = renderHook(() => useWorkspace({ port }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.openFolder();
    });

    let openGuide!: Promise<void>;
    let openNotes!: Promise<void>;
    act(() => {
      openGuide = result.current.openFile("guide.md");
      openNotes = result.current.openFile("notes.md");
    });
    notesRead.resolve("# notes");
    await act(async () => openNotes);
    guideRead.resolve("# guide");
    await act(async () => openGuide);

    expect(result.current.activePath).toBe("notes.md");
    expect(result.current.markdown).toBe("# notes");
  });

  it("keeps the latest folder request when two candidates resolve out of order", async () => {
    const folderB = deferred<OpenDirectoryResult>();
    const folderC = deferred<OpenDirectoryResult>();
    const initial: OpenDirectoryResult = {
      workspaceId: "workspace-a",
      folderName: "A",
      files: [{ path: "a.md", name: "a.md", kind: "file" }],
    };
    const openDirectory = vi
      .fn<FileSystemPort["openDirectory"]>()
      .mockResolvedValueOnce(initial)
      .mockImplementationOnce(() => folderB.promise)
      .mockImplementationOnce(() => folderC.promise);
    const commitDirectory = vi.fn();
    const port = createMockPort({
      openDirectory,
      commitDirectory,
      readText: async (entry, directory) =>
        `# ${directory?.folderName ?? "active"}:${entry.path}`,
    });
    const { result } = renderHook(() => useWorkspace({ port }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.openFolder();
    });

    let openB!: Promise<void>;
    let openC!: Promise<void>;
    act(() => {
      openB = result.current.openFolder();
    });
    await waitFor(() => expect(openDirectory).toHaveBeenCalledTimes(2));
    act(() => {
      openC = result.current.openFolder();
    });
    await waitFor(() => expect(openDirectory).toHaveBeenCalledTimes(3));
    folderC.resolve({
      workspaceId: "workspace-c",
      folderName: "C",
      files: [{ path: "c.md", name: "c.md", kind: "file" }],
    });
    await act(async () => openC);
    folderB.resolve({
      workspaceId: "workspace-b",
      folderName: "B",
      files: [{ path: "b.md", name: "b.md", kind: "file" }],
    });
    await act(async () => openB);

    expect(result.current.folderName).toBe("C");
    expect(result.current.activePath).toBe("c.md");
    expect(result.current.markdown).toBe("# C:c.md");
    expect(commitDirectory).not.toHaveBeenCalledWith(
      expect.objectContaining({ folderName: "B" }),
    );
  });

  it("keeps discarded edits dirty when the candidate is invalid", async () => {
    const oldEntry: FileEntry = {
      path: "old.md",
      name: "old.md",
      kind: "file",
    };
    const invalidEntry: FileEntry = {
      path: "duplicate.md",
      name: "duplicate.md",
      kind: "file",
    };
    const openDirectory = vi
      .fn<FileSystemPort["openDirectory"]>()
      .mockResolvedValueOnce({
        workspaceId: "workspace-anterior",
        folderName: "anterior",
        files: [oldEntry],
      })
      .mockResolvedValueOnce({
        workspaceId: "workspace-invalida",
        folderName: "inválida",
        files: [invalidEntry, invalidEntry],
      });
    const port = createMockPort({
      openDirectory,
      readText: async (entry) => `# ${entry.path}`,
    });
    const confirmDirtyChange = vi.fn(async () => "discard" as const);
    const { result } = renderHook(() =>
      useWorkspace({ port, confirmDirtyChange }),
    );
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.openFolder();
    });
    act(() => result.current.setMarkdown("# edição ainda não descartada"));
    await act(async () => {
      await result.current.openFolder();
    });

    expect(result.current.folderName).toBe("anterior");
    expect(result.current.files).toEqual([oldEntry]);
    expect(result.current.activePath).toBe("old.md");
    expect(result.current.markdown).toBe("# edição ainda não descartada");
    expect(result.current.dirty).toBe(true);
    expect(result.current.saveStatus).toBe("unsaved");
    expect(result.current.fsError).toContain("duplicado");
  });

  it("restores a persisted empty draft as empty", async () => {
    localStorage.setItem(DRAFT_KEY, "");
    const port = createMockPort();
    const { result } = renderHook(() => useWorkspace({ port }));

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.markdown).toBe("");
  });

  it("preserves the previous folder when the next read is incomplete", async () => {
    const oldEntry: FileEntry = {
      path: "old.md",
      name: "old.md",
      kind: "file",
    };
    const nextEntry: FileEntry = {
      path: "next.md",
      name: "next.md",
      kind: "file",
    };
    const openDirectory = vi
      .fn<FileSystemPort["openDirectory"]>()
      .mockResolvedValueOnce({
        workspaceId: "workspace-anterior",
        folderName: "anterior",
        files: [oldEntry],
      })
      .mockResolvedValueOnce({
        workspaceId: "workspace-nova",
        folderName: "nova",
        files: [nextEntry],
      });
    const port = createMockPort({
      openDirectory,
      readText: async (entry) => {
        if (entry.path === "next.md") throw new Error("leitura interrompida");
        return "# pasta anterior";
      },
    });
    const { result } = renderHook(() => useWorkspace({ port }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.openFolder();
    });
    await act(async () => {
      await result.current.openFolder();
    });

    expect(result.current.folderName).toBe("anterior");
    expect(result.current.files).toEqual([oldEntry]);
    expect(result.current.activePath).toBe("old.md");
    expect(result.current.markdown).toBe("# pasta anterior");
  });
});
