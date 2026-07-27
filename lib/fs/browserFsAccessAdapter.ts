import {
  directoryOpen,
  fileSave,
  type FileWithDirectoryAndFileHandle,
  type FileWithHandle,
} from "browser-fs-access";
import { detectFsCapabilities } from "@/lib/fs/detectCapabilities";
import {
  clearDirectoryHandle,
  loadDirectoryHandle,
  saveDirectoryHandle,
} from "@/lib/fs/indexedDbHandles";
import { basename, isMarkdownFileName } from "@/lib/fs/markdownFiles";
import type { FileSystemPort } from "@/lib/fs/port";
import type { FileEntry, OpenDirectoryResult } from "@/lib/fs/types";

type SessionFile = {
  handle?: FileSystemFileHandle;
  file?: File;
};

function relativePathFromFile(file: File): string {
  const relative = (file as File & { webkitRelativePath?: string })
    .webkitRelativePath;
  if (relative && relative.length > 0) return relative.replace(/\\/g, "/");
  return file.name;
}

function toEntries(paths: string[]): FileEntry[] {
  return paths
    .slice()
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map((path) => ({
      path,
      name: basename(path),
      kind: "file" as const,
    }));
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
  prefix = "",
): Promise<Map<string, FileSystemFileHandle>> {
  const result = new Map<string, FileSystemFileHandle>();
  for await (const [name, handle] of dir.entries()) {
    if (name.startsWith(".")) continue;
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === "file") {
      if (isMarkdownFileName(name)) {
        result.set(path, handle as FileSystemFileHandle);
      }
    } else if (handle.kind === "directory") {
      const nested = await collectMarkdownFromDirectory(
        handle as FileSystemDirectoryHandle,
        path,
      );
      for (const [nestedPath, nestedHandle] of nested) {
        result.set(nestedPath, nestedHandle);
      }
    }
  }
  return result;
}

export function createBrowserFsAccessAdapter(): FileSystemPort {
  const session = new Map<string, SessionFile>();
  let rootHandle: FileSystemDirectoryHandle | null = null;
  let folderName: string | null = null;

  function resetSession() {
    session.clear();
    rootHandle = null;
    folderName = null;
  }

  function buildResult(): OpenDirectoryResult {
    return {
      folderName: folderName ?? "pasta",
      files: toEntries([...session.keys()]),
    };
  }

  async function loadFromDirectoryHandle(
    dir: FileSystemDirectoryHandle,
  ): Promise<OpenDirectoryResult> {
    const granted = await ensureReadWritePermission(dir);
    if (!granted) {
      throw new Error("Permissão de acesso à pasta negada.");
    }
    resetSession();
    rootHandle = dir;
    folderName = dir.name;
    const handles = await collectMarkdownFromDirectory(dir);
    for (const [path, handle] of handles) {
      session.set(path, { handle });
    }
    return buildResult();
  }

  async function loadFromOpenedFiles(
    files: Array<FileWithHandle | FileWithDirectoryAndFileHandle>,
  ): Promise<OpenDirectoryResult> {
    resetSession();
    let inferredFolder: string | null = null;
    let directoryHandle: FileSystemDirectoryHandle | undefined;

    for (const file of files) {
      if (!isMarkdownFileName(file.name)) continue;
      const path = relativePathFromFile(file);
      session.set(path, {
        handle: file.handle,
        file,
      });
      if (!inferredFolder) {
        const slash = path.indexOf("/");
        inferredFolder = slash > 0 ? path.slice(0, slash) : null;
      }
      const withDir = file as FileWithDirectoryAndFileHandle;
      if (withDir.directoryHandle) {
        directoryHandle = withDir.directoryHandle;
      }
    }

    if (directoryHandle) {
      rootHandle = directoryHandle;
      folderName = directoryHandle.name;
    } else {
      folderName = inferredFolder ?? "pasta";
    }

    return buildResult();
  }

  return {
    getCapabilities() {
      return detectFsCapabilities();
    },

    async openDirectory() {
      const capabilities = detectFsCapabilities();

      if (
        capabilities.canOverwriteInPlace &&
        typeof window.showDirectoryPicker === "function"
      ) {
        const dir = await window.showDirectoryPicker({
          mode: "readwrite",
          id: "mdstudio-workspace",
        });
        const result = await loadFromDirectoryHandle(dir);
        await saveDirectoryHandle(dir);
        return result;
      }

      const opened = await directoryOpen({
        recursive: true,
        mode: "read",
        id: "mdstudio-workspace",
        skipDirectory: (entry) => entry.name.startsWith("."),
      });
      return loadFromOpenedFiles(opened);
    },

    async restoreDirectory() {
      const capabilities = detectFsCapabilities();
      if (!capabilities.canPersistDirectoryHandle) return null;

      const stored = await loadDirectoryHandle();
      if (!stored) return null;

      try {
        return await loadFromDirectoryHandle(stored);
      } catch {
        return null;
      }
    },

    async persistDirectoryHandle() {
      if (!rootHandle) return;
      const capabilities = detectFsCapabilities();
      if (!capabilities.canPersistDirectoryHandle) return;
      await saveDirectoryHandle(rootHandle);
    },

    async clearPersistedDirectory() {
      resetSession();
      await clearDirectoryHandle();
    },

    async readText(entry) {
      const item = session.get(entry.path);
      if (!item) {
        throw new Error(`Arquivo não encontrado: ${entry.path}`);
      }
      if (item.handle) {
        const file = await item.handle.getFile();
        item.file = file;
        return file.text();
      }
      if (item.file) {
        return item.file.text();
      }
      throw new Error(`Não foi possível ler: ${entry.path}`);
    },

    async writeText(entry, content) {
      const item = session.get(entry.path);
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
        item.file = new File([content], entry.name, { type: "text/markdown" });
        return;
      }

      const nextHandle = await fileSave(blob, options);
      if (nextHandle) {
        item.handle = nextHandle;
      }
      item.file = new File([content], entry.name, { type: "text/markdown" });
    },
  };
}
