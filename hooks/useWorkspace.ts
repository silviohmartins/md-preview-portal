"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createBrowserFsAccessAdapter,
  type FileEntry,
  type FileSystemPort,
  type FsCapabilities,
} from "@/lib/fs";
import { SAMPLE_MARKDOWN } from "@/lib/markdown";
import {
  clearDraft,
  createDebouncedDraftWriter,
  parseDraftOrSample,
  readDraft,
  writeDraftImmediate,
} from "@/lib/storage";

export type DirtyDecision = "cancel" | "discard" | "save";

type UseWorkspaceOptions = {
  port?: FileSystemPort;
  /** Called when leaving a dirty buffer; default is window.confirm → discard/cancel. */
  confirmDirtyChange?: () => DirtyDecision | Promise<DirtyDecision>;
};

export function useWorkspace(options: UseWorkspaceOptions = {}) {
  const portRef = useRef<FileSystemPort>(
    options.port ?? createBrowserFsAccessAdapter(),
  );
  const confirmDirtyRef = useRef(options.confirmDirtyChange);
  confirmDirtyRef.current = options.confirmDirtyChange;

  const [markdown, setMarkdownState] = useState(SAMPLE_MARKDOWN);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [fsError, setFsError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [capabilities, setCapabilities] = useState<FsCapabilities>(() =>
    portRef.current.getCapabilities(),
  );

  const writerRef = useRef(createDebouncedDraftWriter(500));
  const savedContentRef = useRef(SAMPLE_MARKDOWN);
  const folderOpenRef = useRef(false);

  const isFolderOpen = folderName !== null;

  useEffect(() => {
    folderOpenRef.current = isFolderOpen;
  }, [isFolderOpen]);

  useEffect(() => {
    setCapabilities(portRef.current.getCapabilities());

    let cancelled = false;
    (async () => {
      const stored = readDraft();
      let initial = SAMPLE_MARKDOWN;
      if (stored.ok && stored.value) {
        initial = parseDraftOrSample(stored.value, SAMPLE_MARKDOWN);
      }

      const restored = await portRef.current.restoreDirectory();
      if (cancelled) return;

      if (restored && restored.files.length > 0) {
        setFolderName(restored.folderName);
        setFiles(restored.files);
        const first = restored.files[0];
        try {
          const text = await portRef.current.readText(first);
          if (cancelled) return;
          savedContentRef.current = text;
          setMarkdownState(text);
          setActivePath(first.path);
          setDirty(false);
        } catch {
          savedContentRef.current = initial;
          setMarkdownState(initial);
        }
      } else {
        savedContentRef.current = initial;
        setMarkdownState(initial);
      }

      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Draft auto-save only when no folder is open
  useEffect(() => {
    if (!hydrated || isFolderOpen) return;
    writerRef.current.write(markdown, (msg) => setStorageWarning(msg));
  }, [markdown, hydrated, isFolderOpen]);

  useEffect(() => {
    const writer = writerRef.current;
    const persistDraft = () => {
      if (folderOpenRef.current) return;
      const result = writer.flush();
      if (!result.ok) {
        setStorageWarning(result.error);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") persistDraft();
    };

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      persistDraft();
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      persistDraft();
    };
  }, [dirty]);

  const setMarkdown = useCallback(
    (value: string | ((prev: string) => string)) => {
      setMarkdownState(value);
    },
    [],
  );

  useEffect(() => {
    if (!isFolderOpen) {
      setDirty(false);
      return;
    }
    setDirty(markdown !== savedContentRef.current);
  }, [markdown, isFolderOpen, activePath]);

  const resolveDirtyGuard = useCallback(async (): Promise<boolean> => {
    if (!dirty) return true;

    const decision = confirmDirtyRef.current
      ? await confirmDirtyRef.current()
      : window.confirm("Há alterações não salvas. Descartar?")
        ? "discard"
        : "cancel";

    if (decision === "cancel") return false;
    if (decision === "discard") {
      setDirty(false);
      return true;
    }

    // save
    if (!isFolderOpen || !activePath) return false;
    setFsError(null);
    setSaving(true);
    try {
      const entry = files.find((f) => f.path === activePath);
      if (!entry) {
        throw new Error("Arquivo ativo não encontrado na lista.");
      }
      await portRef.current.writeText(entry, markdown);
      savedContentRef.current = markdown;
      setDirty(false);
      return true;
    } catch (error) {
      if (isAbortError(error)) return false;
      setFsError(errorMessage(error, "Não foi possível salvar o arquivo."));
      return false;
    } finally {
      setSaving(false);
    }
  }, [activePath, dirty, files, isFolderOpen, markdown]);

  const openFolder = useCallback(async () => {
    setFsError(null);
    try {
      const proceed = await resolveDirtyGuard();
      if (!proceed) return;

      const result = await portRef.current.openDirectory();
      setCapabilities(portRef.current.getCapabilities());
      setFolderName(result.folderName);
      setFiles(result.files);
      setDirty(false);
      setStorageWarning(null);

      if (result.files.length === 0) {
        setActivePath(null);
        savedContentRef.current = "";
        setMarkdownState("");
        setFsError("Nenhum arquivo Markdown (.md) encontrado nesta pasta.");
        return;
      }

      const first = result.files[0];
      const text = await portRef.current.readText(first);
      savedContentRef.current = text;
      setMarkdownState(text);
      setActivePath(first.path);
    } catch (error) {
      if (isAbortError(error)) return;
      setFsError(errorMessage(error, "Não foi possível abrir a pasta."));
    }
  }, [resolveDirtyGuard]);

  const openFile = useCallback(
    async (path: string) => {
      if (path === activePath) return;
      setFsError(null);

      const proceed = await resolveDirtyGuard();
      if (!proceed) return;

      const entry = files.find((f) => f.path === path);
      if (!entry) {
        setFsError(`Arquivo não listado: ${path}`);
        return;
      }

      try {
        const text = await portRef.current.readText(entry);
        savedContentRef.current = text;
        setMarkdownState(text);
        setActivePath(path);
        setDirty(false);
      } catch (error) {
        setFsError(errorMessage(error, "Não foi possível ler o arquivo."));
      }
    },
    [activePath, files, resolveDirtyGuard],
  );

  const save = useCallback(async () => {
    if (!isFolderOpen || !activePath || !dirty) return;
    setFsError(null);
    setSaving(true);
    try {
      const entry = files.find((f) => f.path === activePath);
      if (!entry) {
        throw new Error("Arquivo ativo não encontrado na lista.");
      }
      await portRef.current.writeText(entry, markdown);
      savedContentRef.current = markdown;
      setDirty(false);
    } catch (error) {
      if (isAbortError(error)) return;
      setFsError(errorMessage(error, "Não foi possível salvar o arquivo."));
    } finally {
      setSaving(false);
    }
  }, [activePath, dirty, files, isFolderOpen, markdown]);

  const closeFolder = useCallback(async () => {
    const proceed = await resolveDirtyGuard();
    if (!proceed) return;

    await portRef.current.clearPersistedDirectory();
    setFolderName(null);
    setFiles([]);
    setActivePath(null);
    setDirty(false);
    setFsError(null);

    const stored = readDraft();
    const draft =
      stored.ok && stored.value
        ? parseDraftOrSample(stored.value, SAMPLE_MARKDOWN)
        : SAMPLE_MARKDOWN;
    savedContentRef.current = draft;
    setMarkdownState(draft);
  }, [resolveDirtyGuard]);

  const resetToSample = useCallback(() => {
    if (isFolderOpen) return;
    clearDraft();
    writeDraftImmediate(SAMPLE_MARKDOWN);
    savedContentRef.current = SAMPLE_MARKDOWN;
    setMarkdownState(SAMPLE_MARKDOWN);
    setStorageWarning(null);
    setDirty(false);
  }, [isFolderOpen]);

  return {
    markdown,
    setMarkdown,
    hydrated,
    storageWarning,
    fsError,
    clearFsError: () => setFsError(null),
    resetToSample,
    files,
    activePath,
    folderName,
    isFolderOpen,
    dirty,
    saving,
    capabilities,
    openFolder,
    openFile,
    save,
    closeFolder,
  };
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: string }).name === "AbortError"
  );
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
