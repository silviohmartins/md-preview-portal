import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBrowserFsAccessAdapter } from "./browserFsAccessAdapter";
import {
  clearDirectoryHandle,
  findDirectoryWorkspaceId,
  loadDirectoryHandle,
  loadDirectoryWorkspaceId,
  rememberDirectoryWorkspace,
  saveDirectoryHandle,
} from "./indexedDbHandles";

const {
  capabilities,
  directoryOpenMock,
  fileSaveMock,
  showDirectoryPickerMock,
} = vi.hoisted(() => ({
  capabilities: {
    canOverwriteInPlace: true,
    canPersistDirectoryHandle: true,
  },
  directoryOpenMock: vi.fn(),
  fileSaveMock: vi.fn(),
  showDirectoryPickerMock: vi.fn(),
}));

vi.mock("browser-fs-access", () => ({
  directoryOpen: directoryOpenMock,
  fileSave: fileSaveMock,
}));

vi.mock("./detectCapabilities", () => ({
  detectFsCapabilities: () => ({ ...capabilities }),
}));

vi.mock("./indexedDbHandles", () => ({
  clearDirectoryHandle: vi.fn(),
  findDirectoryWorkspaceId: vi.fn(),
  loadDirectoryHandle: vi.fn(),
  loadDirectoryWorkspaceId: vi.fn(),
  rememberDirectoryWorkspace: vi.fn(),
  saveDirectoryHandle: vi.fn(),
}));

function createFileHandle(
  name: string,
  content: string,
): FileSystemFileHandle {
  return {
    kind: "file",
    name,
    getFile: async () =>
      ({
        name,
        text: async () => content,
      }) as File,
  } as unknown as FileSystemFileHandle;
}

function createDirectoryHandle(
  name: string,
  entries: Array<[string, FileSystemHandle]>,
): FileSystemDirectoryHandle {
  return {
    kind: "directory",
    name,
    async *entries() {
      yield* entries;
    },
  } as unknown as FileSystemDirectoryHandle;
}

describe("browser filesystem session baseline", () => {
  beforeEach(() => {
    capabilities.canOverwriteInPlace = true;
    capabilities.canPersistDirectoryHandle = true;
    directoryOpenMock.mockReset();
    fileSaveMock.mockReset();
    showDirectoryPickerMock.mockReset();
    vi.mocked(clearDirectoryHandle).mockReset().mockResolvedValue(undefined);
    vi.mocked(findDirectoryWorkspaceId).mockReset().mockResolvedValue(null);
    vi.mocked(loadDirectoryHandle).mockReset().mockResolvedValue(null);
    vi.mocked(loadDirectoryWorkspaceId).mockReset().mockResolvedValue(null);
    vi.mocked(rememberDirectoryWorkspace).mockReset().mockResolvedValue(undefined);
    vi.mocked(saveDirectoryHandle).mockReset().mockResolvedValue(undefined);
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: showDirectoryPickerMock,
    });
  });

  it("continues without a restored folder when IndexedDB is unavailable", async () => {
    vi.mocked(loadDirectoryHandle).mockRejectedValue(
      new Error("O IndexedDB não está disponível."),
    );
    const adapter = createBrowserFsAccessAdapter();

    await expect(adapter.restoreDirectory()).resolves.toBeNull();
  });

  it("keeps a candidate isolated until it is committed", async () => {
    const directory = createDirectoryHandle("docs", [
      ["readme.md", createFileHandle("readme.md", "# candidato")],
    ]);
    showDirectoryPickerMock.mockResolvedValue(directory);
    const adapter = createBrowserFsAccessAdapter();

    const candidate = await adapter.openDirectory();
    const entry = candidate.files[0]!;
    await expect(adapter.readText(entry)).rejects.toThrow(
      "Arquivo não encontrado",
    );
    await expect(adapter.readText(entry, candidate)).resolves.toBe(
      "# candidato",
    );

    adapter.commitDirectory(candidate);
    await expect(adapter.readText(entry)).resolves.toBe("# candidato");
  });

  it("assigns different identities to folders with the same display name", async () => {
    const firstDirectory = createDirectoryHandle("docs", [
      ["readme.md", createFileHandle("readme.md", "# primeiro")],
    ]);
    const secondDirectory = createDirectoryHandle("docs", [
      ["readme.md", createFileHandle("readme.md", "# segundo")],
    ]);
    showDirectoryPickerMock
      .mockResolvedValueOnce(firstDirectory)
      .mockResolvedValueOnce(secondDirectory);
    const adapter = createBrowserFsAccessAdapter();

    const first = await adapter.openDirectory();
    const second = await adapter.openDirectory();

    expect(first.folderName).toBe(second.folderName);
    expect(first.workspaceId).not.toBe(second.workspaceId);
  });

  it("reuses the identity when the same folder is selected again", async () => {
    const directory = createDirectoryHandle("docs", [
      ["readme.md", createFileHandle("readme.md", "# conteúdo")],
    ]);
    showDirectoryPickerMock.mockResolvedValue(directory);
    const adapter = createBrowserFsAccessAdapter();

    const first = await adapter.openDirectory();
    const reopened = await adapter.openDirectory();

    expect(reopened.workspaceId).toBe(first.workspaceId);
  });

  it("restores the persisted workspace identity", async () => {
    const directory = createDirectoryHandle("docs", [
      ["readme.md", createFileHandle("readme.md", "# restaurado")],
    ]);
    vi.mocked(loadDirectoryHandle).mockResolvedValue(directory);
    vi.mocked(loadDirectoryWorkspaceId).mockResolvedValue("workspace-stable");
    const adapter = createBrowserFsAccessAdapter();

    const restored = await adapter.restoreDirectory();

    expect(restored?.workspaceId).toBe("workspace-stable");
  });

  it("preserves the active session when the next enumeration fails", async () => {
    const activeDirectory = createDirectoryHandle("anterior", [
      ["old.md", createFileHandle("old.md", "# anterior")],
    ]);
    const brokenDirectory = {
      kind: "directory",
      name: "quebrada",
      async *entries() {
        throw new Error("enumeração interrompida");
      },
    } as unknown as FileSystemDirectoryHandle;
    showDirectoryPickerMock
      .mockResolvedValueOnce(activeDirectory)
      .mockResolvedValueOnce(brokenDirectory);
    const adapter = createBrowserFsAccessAdapter();
    const active = await adapter.openDirectory();
    adapter.commitDirectory(active);

    await expect(adapter.openDirectory()).rejects.toThrow(
      "enumeração interrompida",
    );
    await expect(adapter.readText(active.files[0]!)).resolves.toBe(
      "# anterior",
    );
  });

  it("does not reset the active session when persistence operations fail", async () => {
    const directory = createDirectoryHandle("docs", [
      ["readme.md", createFileHandle("readme.md", "# ativo")],
    ]);
    showDirectoryPickerMock.mockResolvedValue(directory);
    vi.mocked(saveDirectoryHandle).mockRejectedValue(
      new Error("persistência indisponível"),
    );
    vi.mocked(clearDirectoryHandle).mockRejectedValue(
      new Error("limpeza indisponível"),
    );
    const adapter = createBrowserFsAccessAdapter();
    const active = await adapter.openDirectory();
    adapter.commitDirectory(active);

    await expect(adapter.persistDirectoryHandle()).rejects.toThrow(
      "persistência indisponível",
    );
    await expect(adapter.clearPersistedDirectory()).rejects.toThrow(
      "limpeza indisponível",
    );
    await expect(adapter.readText(active.files[0]!)).resolves.toBe("# ativo");
  });

  it("normalizes fallback paths consistently", async () => {
    capabilities.canOverwriteInPlace = false;
    capabilities.canPersistDirectoryHandle = false;
    const file = {
      name: "guide.md",
      webkitRelativePath: "docs\\guides\\guide.md",
      text: async () => "# fallback",
    } as File;
    directoryOpenMock.mockResolvedValue([file]);
    const adapter = createBrowserFsAccessAdapter();

    const candidate = await adapter.openDirectory();

    expect(candidate.files[0]?.path).toBe("docs/guides/guide.md");
    await expect(
      adapter.readText(candidate.files[0]!, candidate),
    ).resolves.toBe("# fallback");
  });

  it("applies max depth consistently to fallback paths with a root segment", async () => {
    capabilities.canOverwriteInPlace = false;
    capabilities.canPersistDirectoryHandle = false;
    const fallbackFile = (name: string, path: string) =>
      ({
        name,
        webkitRelativePath: path,
        text: async () => `# ${name}`,
      }) as File;
    directoryOpenMock.mockResolvedValue([
      fallbackFile("root.md", "docs/root.md"),
      fallbackFile("guide.md", "docs/guides/guide.md"),
      fallbackFile("deep.md", "docs/guides/deep/deep.md"),
    ]);
    const adapter = createBrowserFsAccessAdapter();

    const candidate = await adapter.openDirectory({ maxDepth: 1 });

    expect(candidate.files.map((file) => file.path)).toEqual([
      "docs/guides/guide.md",
      "docs/root.md",
    ]);
    expect(candidate.enumeration?.skippedDirectories).toBe(1);
  });

  it("yields fallback enumeration so progress paints and abort can run", async () => {
    capabilities.canOverwriteInPlace = false;
    capabilities.canPersistDirectoryHandle = false;
    const files = Array.from({ length: 120 }, (_, index) =>
      ({
        name: `file-${index}.md`,
        webkitRelativePath: `docs/file-${index}.md`,
        text: async () => "# file",
      }) as File,
    );
    directoryOpenMock.mockResolvedValue(files);
    const controller = new AbortController();
    const onProgress = vi.fn();
    const adapter = createBrowserFsAccessAdapter();
    window.setTimeout(() => controller.abort(), 0);

    await expect(
      adapter.openDirectory({ signal: controller.signal, onProgress }),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ filesFound: 50 }),
    );
  });

  it("reports enumeration progress and respects the configured depth", async () => {
    const directory = createDirectoryHandle("docs", [
      ["root.md", createFileHandle("root.md", "# root")],
      [
        "level-1",
        createDirectoryHandle("level-1", [
          ["nested.md", createFileHandle("nested.md", "# nested")],
          [
            "level-2",
            createDirectoryHandle("level-2", [
              ["ignored.md", createFileHandle("ignored.md", "# ignored")],
            ]),
          ],
        ]),
      ],
    ]);
    showDirectoryPickerMock.mockResolvedValue(directory);
    const onProgress = vi.fn();
    const adapter = createBrowserFsAccessAdapter();

    const candidate = await adapter.openDirectory({ maxDepth: 1, onProgress });

    expect(candidate.files.map((file) => file.path)).toEqual([
      "level-1/nested.md",
      "root.md",
    ]);
    expect(candidate.enumeration).toEqual({
      filesFound: 2,
      directoriesVisited: 2,
      skippedDirectories: 1,
    });
    expect(onProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({ filesFound: 2, skippedDirectories: 1 }),
    );
  });

  it("reports progress and limits depth while restoring a folder", async () => {
    const directory = createDirectoryHandle("docs", [
      ["root.md", createFileHandle("root.md", "# root")],
      [
        "nested",
        createDirectoryHandle("nested", [
          ["ignored.md", createFileHandle("ignored.md", "# ignored")],
        ]),
      ],
    ]);
    vi.mocked(loadDirectoryHandle).mockResolvedValue(directory);
    const onProgress = vi.fn();
    const adapter = createBrowserFsAccessAdapter();

    const restored = await adapter.restoreDirectory({
      maxDepth: 0,
      onProgress,
    });

    expect(restored?.files.map((file) => file.path)).toEqual(["root.md"]);
    expect(restored?.enumeration?.skippedDirectories).toBe(1);
    expect(onProgress).toHaveBeenCalled();
  });

  it("asks before continuing past the configured file threshold", async () => {
    const directory = createDirectoryHandle("docs", [
      ["a.md", createFileHandle("a.md", "# a")],
      ["b.md", createFileHandle("b.md", "# b")],
      ["c.md", createFileHandle("c.md", "# c")],
    ]);
    showDirectoryPickerMock.mockResolvedValue(directory);
    const confirmManyFiles = vi.fn().mockResolvedValue(false);
    const adapter = createBrowserFsAccessAdapter();

    await expect(
      adapter.openDirectory({
        fileConfirmationThreshold: 2,
        confirmManyFiles,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(confirmManyFiles).toHaveBeenCalledOnce();
    expect(confirmManyFiles).toHaveBeenCalledWith(2);
  });

  it("stops enumerating when a newer workspace operation aborts the signal", async () => {
    const directory = createDirectoryHandle("docs", [
      ["a.md", createFileHandle("a.md", "# a")],
      ["b.md", createFileHandle("b.md", "# b")],
    ]);
    showDirectoryPickerMock.mockResolvedValue(directory);
    const controller = new AbortController();
    const adapter = createBrowserFsAccessAdapter();

    await expect(
      adapter.openDirectory({
        signal: controller.signal,
        fileConfirmationThreshold: 1,
        confirmManyFiles: () => {
          controller.abort();
          return true;
        },
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
