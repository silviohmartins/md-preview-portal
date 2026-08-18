import {
  directoryOpen,
  fileSave,
  type FileWithDirectoryAndFileHandle,
  type FileWithHandle,
} from "browser-fs-access";
import { detectFsCapabilities } from "@/lib/fs/detectCapabilities";
import {
  clearDirectoryHandle,
  findDirectoryWorkspaceId,
  loadDirectoryHandle,
  loadDirectoryWorkspaceId,
  rememberDirectoryWorkspace,
  saveDirectoryHandle,
} from "@/lib/fs/indexedDbHandles";
import {
  basename,
  isMarkdownFileName,
  normalizeRelativePath,
} from "@/lib/fs/markdownFiles";
import type { FileSystemPort } from "@/lib/fs/port";
import type {
  DirectoryEnumerationProgress,
  DirectoryEnumerationSummary,
  FileEntry,
  OpenDirectoryOptions,
  OpenDirectoryResult,
} from "@/lib/fs/types";

export const DEFAULT_MAX_DIRECTORY_DEPTH = 20;
export const DEFAULT_FILE_CONFIRMATION_THRESHOLD = 500;
const FALLBACK_ENUMERATION_YIELD_INTERVAL = 50;

type SessionFile = {
  handle?: FileSystemFileHandle;
  file?: File;
};

type AdapterSession = {
  workspaceId: string;
  files: Map<string, SessionFile>;
  rootHandle: FileSystemDirectoryHandle | null;
  folderName: string;
};

function createEmptySession(): AdapterSession {
  return {
    workspaceId: "standalone-draft",
    files: new Map(),
    rootHandle: null,
    folderName: "pasta",
  };
}

function createWorkspaceId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `workspace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function relativePathFromFile(file: File): string {
  const withRelativePaths = file as File & {
    relativePath?: string;
    webkitRelativePath?: string;
  };
  return normalizeRelativePath(
    withRelativePaths.webkitRelativePath ||
      withRelativePaths.relativePath ||
      file.name,
  );
}

function toEntries(files: Map<string, SessionFile>): FileEntry[] {
  return [...files.entries()]
    .sort(([a], [b]) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    )
    .map(([path, item]) => ({
      path,
      name: basename(path),
      kind: "file" as const,
      sizeBytes: item.file?.size,
    }));
}

type EnumerationContext = {
  signal?: AbortSignal;
  maxDepth: number;
  fileConfirmationThreshold: number;
  confirmManyFiles?: OpenDirectoryOptions["confirmManyFiles"];
  onProgress?: OpenDirectoryOptions["onProgress"];
  progress: DirectoryEnumerationProgress;
  confirmationRequested: boolean;
  lastProgressAt: number;
  skippedDirectoryPaths: Set<string>;
};

function createEnumerationContext(
  options: OpenDirectoryOptions = {},
): EnumerationContext {
  const maxDepth = normalizeLimit(
    options.maxDepth,
    DEFAULT_MAX_DIRECTORY_DEPTH,
  );
  const fileConfirmationThreshold = normalizeLimit(
    options.fileConfirmationThreshold,
    DEFAULT_FILE_CONFIRMATION_THRESHOLD,
  );
  return {
    signal: options.signal,
    maxDepth,
    fileConfirmationThreshold,
    confirmManyFiles: options.confirmManyFiles,
    onProgress: options.onProgress,
    progress: {
      filesFound: 0,
      directoriesVisited: 0,
      skippedDirectories: 0,
      currentPath: "",
    },
    confirmationRequested: false,
    lastProgressAt: 0,
    skippedDirectoryPaths: new Set(),
  };
}

function registerSkippedDirectory(
  context: EnumerationContext,
  path: string,
): void {
  if (context.skippedDirectoryPaths.has(path)) return;
  context.skippedDirectoryPaths.add(path);
  context.progress.skippedDirectories += 1;
  reportProgress(context, path);
}

function throwIfEnumerationAborted(context: EnumerationContext): void {
  if (!context.signal?.aborted) return;
  const reason = context.signal.reason;
  if (reason instanceof Error) throw reason;
  throw new DOMException("Abertura da pasta cancelada.", "AbortError");
}

async function yieldEnumerationTask(
  context: EnumerationContext,
  currentPath: string,
): Promise<void> {
  reportProgress(context, currentPath, true);
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  throwIfEnumerationAborted(context);
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function reportProgress(
  context: EnumerationContext,
  currentPath: string,
  force = false,
): void {
  context.progress.currentPath = currentPath;
  const now = Date.now();
  if (!force && now - context.lastProgressAt < 50) return;
  context.lastProgressAt = now;
  context.onProgress?.({ ...context.progress });
}

async function registerMarkdownFile(
  context: EnumerationContext,
  path: string,
): Promise<void> {
  throwIfEnumerationAborted(context);
  context.progress.filesFound += 1;
  reportProgress(context, path);
  throwIfEnumerationAborted(context);
  if (
    context.confirmationRequested ||
    context.fileConfirmationThreshold === 0 ||
    context.progress.filesFound < context.fileConfirmationThreshold
  ) {
    return;
  }

  context.confirmationRequested = true;
  const confirmed = await context.confirmManyFiles?.(
    context.progress.filesFound,
  );
  throwIfEnumerationAborted(context);
  if (confirmed === false) {
    throw new DOMException("Abertura da pasta cancelada.", "AbortError");
  }
}

function enumerationSummary(
  context: EnumerationContext,
): DirectoryEnumerationSummary {
  const { filesFound, directoriesVisited, skippedDirectories } =
    context.progress;
  return { filesFound, directoriesVisited, skippedDirectories };
}

async function ensureReadWritePermission(
  handle: FileSystemHandle,
): Promise<boolean> {
  const withPerms = handle as FileSystemHandle & {
    queryPermission?: (d?: { mode?: string }) => Promise<PermissionState>;
    requestPermission?: (d?: { mode?: string }) => Promise<PermissionState>;
  };
  if (typeof withPerms.queryPermission !== "function") return true;
  const opts = { mode: "readwrite" as const };
  let state = await withPerms.queryPermission(opts);
  if (state === "granted") return true;
  if (typeof withPerms.requestPermission !== "function") return false;
  state = await withPerms.requestPermission(opts);
  return state === "granted";
}

async function collectMarkdownFromDirectory(
  dir: FileSystemDirectoryHandle,
  context: EnumerationContext,
  prefix = "",
  depth = 0,
): Promise<Map<string, SessionFile>> {
  throwIfEnumerationAborted(context);
  const result = new Map<string, SessionFile>();
  context.progress.directoriesVisited += 1;
  reportProgress(context, prefix || dir.name);
  for await (const [name, handle] of dir.entries()) {
    throwIfEnumerationAborted(context);
    if (name.startsWith(".")) continue;
    const path = normalizeRelativePath(prefix ? `${prefix}/${name}` : name);
    if (handle.kind === "file") {
      if (isMarkdownFileName(name)) {
        if (!path || result.has(path)) {
          throw new Error(`Caminho de arquivo inválido ou duplicado: ${path}`);
        }
        result.set(path, { handle: handle as FileSystemFileHandle });
        await registerMarkdownFile(context, path);
      }
    } else if (handle.kind === "directory") {
      if (depth >= context.maxDepth) {
        registerSkippedDirectory(context, path);
        continue;
      }
      const nested = await collectMarkdownFromDirectory(
        handle as FileSystemDirectoryHandle,
        context,
        path,
        depth + 1,
      );
      for (const [nestedPath, nestedHandle] of nested) {
        if (result.has(nestedPath)) {
          throw new Error(`Caminho de arquivo duplicado: ${nestedPath}`);
        }
        result.set(nestedPath, nestedHandle);
      }
    }
  }
  reportProgress(context, prefix || dir.name);
  return result;
}

export function createBrowserFsAccessAdapter(): FileSystemPort {
  let activeSession = createEmptySession();
  let persistenceQueue = Promise.resolve();
  const candidates = new WeakMap<OpenDirectoryResult, AdapterSession>();
  const knownWorkspaceIds = new WeakMap<FileSystemDirectoryHandle, string>();

  async function resolveWorkspaceId(
    handle: FileSystemDirectoryHandle,
    preferredId?: string,
  ): Promise<string> {
    const cached = knownWorkspaceIds.get(handle);
    if (cached) return cached;

    let workspaceId = preferredId;
    if (!workspaceId) {
      try {
        workspaceId = (await findDirectoryWorkspaceId(handle)) ?? undefined;
      } catch {
        // Opening the folder still works when IndexedDB is unavailable.
      }
    }
    workspaceId ??= createWorkspaceId();
    knownWorkspaceIds.set(handle, workspaceId);
    try {
      await rememberDirectoryWorkspace(handle, workspaceId);
    } catch {
      // The current session remains isolated even if its registry cannot persist.
    }
    return workspaceId;
  }

  function enqueuePersistence(task: () => Promise<void>): Promise<void> {
    const queuedTask = persistenceQueue.catch(() => undefined).then(task);
    persistenceQueue = queuedTask;
    return queuedTask;
  }

  function buildCandidate(
    session: AdapterSession,
    enumeration?: DirectoryEnumerationSummary,
  ): OpenDirectoryResult {
    const result: OpenDirectoryResult = {
      workspaceId: session.workspaceId,
      folderName: session.folderName,
      files: toEntries(session.files),
      enumeration,
    };
    candidates.set(result, session);
    return result;
  }

  function resolveSession(directory?: OpenDirectoryResult): AdapterSession {
    if (!directory) return activeSession;
    const candidate = candidates.get(directory);
    if (!candidate) {
      throw new Error("Sessão de pasta candidata inválida ou expirada.");
    }
    return candidate;
  }

  async function loadFromDirectoryHandle(
    dir: FileSystemDirectoryHandle,
    preferredWorkspaceId?: string,
    options?: OpenDirectoryOptions,
  ): Promise<OpenDirectoryResult> {
    const granted = await ensureReadWritePermission(dir);
    if (!granted) {
      throw new Error("Permissão de acesso à pasta negada.");
    }
    const context = createEnumerationContext(options);
    throwIfEnumerationAborted(context);
    reportProgress(context, dir.name || "pasta", true);
    const files = await collectMarkdownFromDirectory(dir, context);
    reportProgress(context, dir.name || "pasta", true);
    const workspaceId = await resolveWorkspaceId(dir, preferredWorkspaceId);
    return buildCandidate(
      {
        workspaceId,
        files,
        rootHandle: dir,
        folderName: dir.name || "pasta",
      },
      enumerationSummary(context),
    );
  }

  async function loadFromOpenedFiles(
    openedFiles: Array<FileWithHandle | FileWithDirectoryAndFileHandle>,
    options?: OpenDirectoryOptions,
  ): Promise<OpenDirectoryResult> {
    const files = new Map<string, SessionFile>();
    const context = createEnumerationContext(options);
    const visitedDirectories = new Set<string>();
    let selectedRootSegment: string | null | undefined;
    let inferredFolder: string | null = null;
    let directoryHandle: FileSystemDirectoryHandle | undefined;

    for (let fileIndex = 0; fileIndex < openedFiles.length; fileIndex += 1) {
      const file = openedFiles[fileIndex]!;
      if (
        fileIndex > 0 &&
        fileIndex % FALLBACK_ENUMERATION_YIELD_INTERVAL === 0
      ) {
        await yieldEnumerationTask(context, file.name);
      }
      throwIfEnumerationAborted(context);
      if (!isMarkdownFileName(file.name)) continue;
      const path = relativePathFromFile(file);
      const directoryParts = path.split("/").slice(0, -1);
      if (selectedRootSegment === undefined) {
        selectedRootSegment = directoryParts[0] ?? null;
      }
      const relativeDirectoryParts =
        selectedRootSegment && directoryParts[0] === selectedRootSegment
          ? directoryParts.slice(1)
          : directoryParts;
      if (relativeDirectoryParts.length > context.maxDepth) {
        const skippedPath = [
          selectedRootSegment,
          ...relativeDirectoryParts.slice(0, context.maxDepth + 1),
        ]
          .filter(Boolean)
          .join("/");
        registerSkippedDirectory(context, skippedPath);
        continue;
      }
      visitedDirectories.add("");
      for (let index = 1; index <= relativeDirectoryParts.length; index += 1) {
        visitedDirectories.add(relativeDirectoryParts.slice(0, index).join("/"));
      }
      if (!path || files.has(path)) {
        throw new Error(`Caminho de arquivo inválido ou duplicado: ${path}`);
      }
      files.set(path, {
        handle: file.handle,
        file,
      });
      context.progress.directoriesVisited = Math.max(
        1,
        visitedDirectories.size,
      );
      await registerMarkdownFile(context, path);
      if (!inferredFolder) {
        const slash = path.indexOf("/");
        inferredFolder = slash > 0 ? path.slice(0, slash) : null;
      }
      const withDir = file as FileWithDirectoryAndFileHandle;
      if (withDir.directoryHandle) {
        directoryHandle = withDir.directoryHandle;
      }
    }

    const workspaceId = directoryHandle
      ? await resolveWorkspaceId(directoryHandle)
      : createWorkspaceId();
    reportProgress(context, inferredFolder || "pasta", true);
    return buildCandidate(
      {
        workspaceId,
        files,
        rootHandle: directoryHandle ?? null,
        folderName: directoryHandle?.name || inferredFolder || "pasta",
      },
      enumerationSummary(context),
    );
  }

  return {
    getCapabilities() {
      return detectFsCapabilities();
    },

    async openDirectory(options) {
      const capabilities = detectFsCapabilities();

      if (
        capabilities.canOverwriteInPlace &&
        typeof window.showDirectoryPicker === "function"
      ) {
        const dir = await window.showDirectoryPicker({
          mode: "readwrite",
          id: "mdstudio-workspace",
        });
        return loadFromDirectoryHandle(dir, undefined, options);
      }

      const opened = await directoryOpen({
        recursive: true,
        mode: "read",
        id: "mdstudio-workspace",
        skipDirectory: (entry) => entry.name.startsWith("."),
      });
      return loadFromOpenedFiles(opened, options);
    },

    async restoreDirectory(options) {
      const capabilities = detectFsCapabilities();
      if (!capabilities.canPersistDirectoryHandle) return null;

      try {
        const [stored, storedWorkspaceId] = await Promise.all([
          loadDirectoryHandle(),
          loadDirectoryWorkspaceId(),
        ]);
        if (!stored) return null;
        return await loadFromDirectoryHandle(
          stored,
          storedWorkspaceId ?? createWorkspaceId(),
          options,
        );
      } catch {
        return null;
      }
    },

    commitDirectory(directory) {
      if (!directory) {
        activeSession = createEmptySession();
        return;
      }
      activeSession = resolveSession(directory);
      candidates.delete(directory);
    },

    async persistDirectoryHandle() {
      const handle = activeSession.rootHandle;
      const workspaceId = activeSession.workspaceId;
      if (!handle) return;
      const capabilities = detectFsCapabilities();
      if (!capabilities.canPersistDirectoryHandle) return;
      await enqueuePersistence(() =>
        saveDirectoryHandle(handle, undefined, workspaceId),
      );
    },

    async clearPersistedDirectory() {
      await enqueuePersistence(clearDirectoryHandle);
    },

    async readText(entry, directory) {
      const session = resolveSession(directory);
      const item = session.files.get(entry.path);
      if (!item) {
        throw new Error(`Arquivo não encontrado: ${entry.path}`);
      }
      if (item.file) {
        return item.file.text();
      }
      if (item.handle) {
        const file = await item.handle.getFile();
        item.file = file;
        return file.text();
      }
      throw new Error(`Não foi possível ler: ${entry.path}`);
    },

    async writeText(entry, content) {
      const item = activeSession.files.get(entry.path);
      if (!item) {
        throw new Error(`Arquivo não encontrado: ${entry.path}`);
      }

      const blob = new Blob([content], { type: "text/markdown" });
      const options = {
        fileName: entry.name,
        extensions: [".md", ".markdown"],
        mimeTypes: ["text/markdown"],
        description: "Markdown",
        id: "mdstudio-save",
      };

      if (item.handle) {
        const nextHandle = await fileSave(blob, options, item.handle, true);
        if (nextHandle) {
          item.handle = nextHandle;
        }
        item.file = undefined;
        return;
      }

      const nextHandle = await fileSave(blob, options);
      if (nextHandle) {
        item.handle = nextHandle;
        item.file = undefined;
      } else {
        item.file = new File([blob], entry.name, { type: "text/markdown" });
      }
    },
  };
}
