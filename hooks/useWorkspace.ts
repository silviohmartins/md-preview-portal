"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  createBrowserFsAccessAdapter,
  DEFAULT_FILE_CONFIRMATION_THRESHOLD,
  DEFAULT_MAX_DIRECTORY_DEPTH,
  type DirectoryLimits,
  isMarkdownFileName,
  type FileEntry,
  type FileSystemPort,
  type OpenDirectoryResult,
} from "@/lib/fs";
import { SAMPLE_MARKDOWN } from "@/lib/markdown";
import {
  clearDraft,
  createDebouncedDraftWriter,
  parseDraftOrSample,
  readDraft,
  writeDraftImmediate,
} from "@/lib/storage";
import {
  createInitialWorkspaceState,
  type SaveStatus,
  workspaceReducer,
} from "@/hooks/workspaceReducer";

export type DirtyDecision = "cancel" | "discard" | "save";
export type { SaveStatus } from "@/hooks/workspaceReducer";

type UseWorkspaceOptions = {
  port?: FileSystemPort;
  /** Called when leaving a dirty buffer; default is window.confirm → discard/cancel. */
  confirmDirtyChange?: () => DirtyDecision | Promise<DirtyDecision>;
  confirmLargeFolder?: (filesFound: number) => boolean | Promise<boolean>;
  directoryLimits?: Partial<DirectoryLimits>;
};

type SaveSnapshot = {
  path: string;
  content: string;
  revision: number;
  workspaceRevision: number;
};

type SaveResult = {
  ok: boolean;
  matchesCurrentRevision: boolean;
};

export function useWorkspace(options: UseWorkspaceOptions = {}) {
  const portRef = useRef<FileSystemPort>(
    options.port ?? createBrowserFsAccessAdapter(),
  );
  const confirmDirtyRef = useRef(options.confirmDirtyChange);
  confirmDirtyRef.current = options.confirmDirtyChange;
  const confirmLargeFolderRef = useRef(options.confirmLargeFolder);
  confirmLargeFolderRef.current = options.confirmLargeFolder;
  const directoryLimitsRef = useRef(options.directoryLimits);
  directoryLimitsRef.current = options.directoryLimits;

  const [state, dispatch] = useReducer(
    workspaceReducer,
    portRef.current.getCapabilities(),
    createInitialWorkspaceState,
  );

  const writerRef = useRef(createDebouncedDraftWriter(500));
  const markdownRef = useRef(SAMPLE_MARKDOWN);
  const documentRevisionRef = useRef(0);
  const workspaceRevisionRef = useRef(0);
  const operationIdRef = useRef(0);
  const savedSnapshotRef = useRef<{
    path: string | null;
    content: string;
    revision: number;
  }>({ path: null, content: SAMPLE_MARKDOWN, revision: 0 });
  const filesRef = useRef<FileEntry[]>([]);
  const activePathRef = useRef<string | null>(null);
  const folderOpenRef = useRef(false);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const saveStatusRef = useRef<SaveStatus>("saved");
  const saveInFlightRef = useRef<Promise<SaveResult> | null>(null);
  const dirtyGuardInFlightRef = useRef<Promise<boolean> | null>(null);
  const enumerationAbortRef = useRef<AbortController | null>(null);

  const isFolderOpen = state.folderName !== null;

  const updateDirty = useCallback((value: boolean) => {
    dirtyRef.current = value;
    dispatch({ type: "save-state-changed", dirty: value });
  }, []);

  const updateSaving = useCallback((value: boolean) => {
    savingRef.current = value;
    dispatch({ type: "save-state-changed", saving: value });
  }, []);

  const updateSaveStatus = useCallback((value: SaveStatus) => {
    saveStatusRef.current = value;
    dispatch({ type: "save-state-changed", saveStatus: value });
  }, []);

  const updateFiles = useCallback((value: FileEntry[]) => {
    filesRef.current = value;
  }, []);

  const updateFolderName = useCallback((value: string | null) => {
    folderOpenRef.current = value !== null;
  }, []);

  const commitSavedBuffer = useCallback(
    (path: string | null, content: string) => {
      const revision = documentRevisionRef.current + 1;
      documentRevisionRef.current = revision;
      markdownRef.current = content;
      activePathRef.current = path;
      savedSnapshotRef.current = { path, content, revision };
      dispatch({ type: "document-committed", content, path });
      updateDirty(false);
      updateSaveStatus("saved");
    },
    [updateDirty, updateSaveStatus],
  );

  const commitDirectorySession = useCallback(
    (
      directory: OpenDirectoryResult,
      path: string | null,
      content: string,
    ) => {
      validateDirectory(directory);
      portRef.current.commitDirectory(directory);
      workspaceRevisionRef.current += 1;
      updateFolderName(directory.folderName);
      updateFiles(directory.files);
      dispatch({
        type: "directory-committed",
        files: directory.files,
        folderName: directory.folderName,
        workspaceId: directory.workspaceId,
      });
      commitSavedBuffer(path, content);
    },
    [commitSavedBuffer, updateFiles, updateFolderName],
  );

  const commitDraftSession = useCallback(
    (content: string) => {
      portRef.current.commitDirectory(null);
      workspaceRevisionRef.current += 1;
      updateFolderName(null);
      updateFiles([]);
      dispatch({
        type: "directory-committed",
        files: [],
        folderName: null,
        workspaceId: "standalone-draft",
      });
      commitSavedBuffer(null, content);
    },
    [commitSavedBuffer, updateFiles, updateFolderName],
  );

  const cancelEnumeration = useCallback(() => {
    enumerationAbortRef.current?.abort();
    enumerationAbortRef.current = null;
    dispatch({ type: "enumeration-stopped" });
  }, []);

  const beginOperation = useCallback(() => {
    cancelEnumeration();
    operationIdRef.current += 1;
    return operationIdRef.current;
  }, [cancelEnumeration]);

  const isCurrentOperation = useCallback(
    (operationId: number) => operationIdRef.current === operationId,
    [],
  );

  useEffect(() => {
    dispatch({
      type: "capabilities-changed",
      capabilities: portRef.current.getCapabilities(),
    });

    let cancelled = false;
    const operationId = beginOperation();
    const restoreController = new AbortController();
    enumerationAbortRef.current = restoreController;
    dispatch({ type: "enumeration-started", progress: {
      filesFound: 0,
      directoriesVisited: 0,
      skippedDirectories: 0,
      currentPath: "Restaurando pasta…",
    } });
    (async () => {
      const stored = readDraft();
      const initial =
        stored.ok && stored.value !== null
          ? parseDraftOrSample(stored.value, SAMPLE_MARKDOWN)
          : SAMPLE_MARKDOWN;

      try {
        const restored = await portRef.current.restoreDirectory({
          maxDepth:
            directoryLimitsRef.current?.maxDepth ??
            DEFAULT_MAX_DIRECTORY_DEPTH,
          fileConfirmationThreshold:
            directoryLimitsRef.current?.fileConfirmationThreshold ??
            DEFAULT_FILE_CONFIRMATION_THRESHOLD,
          signal: restoreController.signal,
          onProgress: (progress) => {
            if (!cancelled && isCurrentOperation(operationId)) {
              dispatch({ type: "enumeration-progressed", progress });
            }
          },
          confirmManyFiles: (filesFound) => {
            if (confirmLargeFolderRef.current) {
              return confirmLargeFolderRef.current(filesFound);
            }
            return window.confirm(
              `A pasta restaurada contém pelo menos ${filesFound} arquivos Markdown. Continuar a abertura?`,
            );
          },
        });
        if (cancelled || !isCurrentOperation(operationId)) return;

        if (!restored) {
          commitDraftSession(initial);
          return;
        }

        validateDirectory(restored);
        const first = restored.files[0];
        const text = first
          ? await portRef.current.readText(first, restored)
          : "";
        if (cancelled || !isCurrentOperation(operationId)) return;
        commitDirectorySession(restored, first?.path ?? null, text);
      } catch (error) {
        if (cancelled || !isCurrentOperation(operationId)) return;
        commitDraftSession(initial);
        dispatch({
          type: "storage-warning-changed",
          warning: errorMessage(
            error,
            "Não foi possível restaurar a pasta anterior.",
          ),
        });
      } finally {
        if (!cancelled) {
          if (enumerationAbortRef.current === restoreController) {
            enumerationAbortRef.current = null;
          }
          dispatch({ type: "enumeration-stopped" });
          dispatch({ type: "hydration-finished" });
        }
      }
    })();

    return () => {
      cancelled = true;
      restoreController.abort();
      if (enumerationAbortRef.current === restoreController) {
        enumerationAbortRef.current = null;
      }
      operationIdRef.current += 1;
    };
  }, [
    beginOperation,
    commitDirectorySession,
    commitDraftSession,
    isCurrentOperation,
  ]);

  // Draft auto-save only when no folder is open
  useEffect(() => {
    if (!state.hydrated || isFolderOpen) return;
    writerRef.current.write(state.markdown, (warning) =>
      dispatch({ type: "storage-warning-changed", warning }),
    );
  }, [state.markdown, state.hydrated, isFolderOpen]);

  useEffect(() => {
    const writer = writerRef.current;
    const persistDraft = () => {
      if (folderOpenRef.current) return;
      const result = writer.flush();
      if (!result.ok) {
        dispatch({ type: "storage-warning-changed", warning: result.error });
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") persistDraft();
    };

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      persistDraft();
      if (state.dirty) {
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
  }, [state.dirty]);

  const setMarkdown = useCallback(
    (value: string | ((prev: string) => string)) => {
      const previous = markdownRef.current;
      const next = typeof value === "function" ? value(previous) : value;
      if (next === previous) return;

      markdownRef.current = next;
      documentRevisionRef.current += 1;
      operationIdRef.current += 1;
      cancelEnumeration();
      if (!folderOpenRef.current) {
        updateDirty(false);
        dispatch({
          type: "document-edited",
          content: next,
          dirty: false,
        });
        return;
      }

      const saved = savedSnapshotRef.current;
      const nextDirty = savingRef.current
        ? true
        : saved.path !== activePathRef.current || saved.content !== next;
      updateDirty(nextDirty);

      if (savingRef.current) {
        dispatch({
          type: "document-edited",
          content: next,
          dirty: true,
        });
        return;
      }
      let nextSaveStatus: SaveStatus | undefined;
      if (!nextDirty) {
        nextSaveStatus = "saved";
        updateSaveStatus("saved");
      } else if (saveStatusRef.current !== "error") {
        nextSaveStatus = "unsaved";
        updateSaveStatus("unsaved");
      }
      dispatch({
        type: "document-edited",
        content: next,
        dirty: nextDirty,
        saveStatus: nextSaveStatus,
      });
    },
    [cancelEnumeration, updateDirty, updateSaveStatus],
  );

  const performSave = useCallback((): Promise<SaveResult> => {
    const pending = saveInFlightRef.current;
    if (pending) return pending;

    const path = activePathRef.current;
    if (!folderOpenRef.current || !path) {
      return Promise.resolve({
        ok: false,
        matchesCurrentRevision: false,
      });
    }
    if (!dirtyRef.current) {
      return Promise.resolve({ ok: true, matchesCurrentRevision: true });
    }

    const entry = filesRef.current.find((file) => file.path === path);
    if (!entry) {
      updateDirty(true);
      updateSaveStatus("error");
      dispatch({
        type: "filesystem-error-changed",
        error: "Arquivo ativo não encontrado na lista.",
      });
      return Promise.resolve({
        ok: false,
        matchesCurrentRevision: false,
      });
    }

    const snapshot: SaveSnapshot = {
      path,
      content: markdownRef.current,
      revision: documentRevisionRef.current,
      workspaceRevision: workspaceRevisionRef.current,
    };

    dispatch({ type: "filesystem-error-changed", error: null });
    updateSaving(true);
    updateSaveStatus("saving");

    const operation = Promise.resolve().then(async (): Promise<SaveResult> => {
      try {
        await portRef.current.writeText(entry, snapshot.content);
        const sameDocument =
          workspaceRevisionRef.current === snapshot.workspaceRevision &&
          activePathRef.current === snapshot.path;
        const matchesCurrentRevision =
          sameDocument && documentRevisionRef.current === snapshot.revision;
        if (sameDocument) {
          savedSnapshotRef.current = snapshot;
          updateDirty(!matchesCurrentRevision);
          updateSaveStatus(matchesCurrentRevision ? "saved" : "unsaved");
        }
        return { ok: true, matchesCurrentRevision };
      } catch (error) {
        if (
          workspaceRevisionRef.current === snapshot.workspaceRevision &&
          activePathRef.current === snapshot.path
        ) {
          updateDirty(true);
          if (isAbortError(error)) {
            updateSaveStatus("unsaved");
          } else {
            updateSaveStatus("error");
            dispatch({
              type: "filesystem-error-changed",
              error: errorMessage(error, "Não foi possível salvar o arquivo."),
            });
          }
        }
        return { ok: false, matchesCurrentRevision: false };
      } finally {
        updateSaving(false);
        if (saveInFlightRef.current === operation) {
          saveInFlightRef.current = null;
        }
      }
    });

    saveInFlightRef.current = operation;
    return operation;
  }, [updateDirty, updateSaveStatus, updateSaving]);

  const resolveDirtyGuard = useCallback((): Promise<boolean> => {
    const pendingGuard = dirtyGuardInFlightRef.current;
    if (pendingGuard) return pendingGuard;

    const guardedRevision = documentRevisionRef.current;
    const runGuard = Promise.resolve().then(async () => {
      const pendingSave = saveInFlightRef.current;
      if (pendingSave) {
        const pendingResult = await pendingSave;
        if (!pendingResult.ok) return false;
        if (!dirtyRef.current) return true;
      }

      if (!dirtyRef.current) return true;

      const decision = confirmDirtyRef.current
        ? await confirmDirtyRef.current()
        : window.confirm("Há alterações não salvas. Descartar?")
          ? "discard"
          : "cancel";

      if (decision === "cancel") return false;
      if (decision === "discard") {
        if (documentRevisionRef.current !== guardedRevision) return false;
        return true;
      }

      const result = await performSave();
      return result.ok && result.matchesCurrentRevision;
    });

    const trackedGuard = runGuard.finally(() => {
      if (dirtyGuardInFlightRef.current === trackedGuard) {
        dirtyGuardInFlightRef.current = null;
      }
    });
    dirtyGuardInFlightRef.current = trackedGuard;
    return trackedGuard;
  }, [performSave]);

  const openFolder = useCallback(async () => {
    const operationId = beginOperation();
    dispatch({ type: "filesystem-error-changed", error: null });
    try {
      const proceed = await resolveDirtyGuard();
      if (!proceed || !isCurrentOperation(operationId)) return;

      dispatch({ type: "enumeration-started", progress: {
        filesFound: 0,
        directoriesVisited: 0,
        skippedDirectories: 0,
        currentPath: "Selecionando pasta…",
      } });
      const limits = {
        maxDepth:
          directoryLimitsRef.current?.maxDepth ??
          DEFAULT_MAX_DIRECTORY_DEPTH,
        fileConfirmationThreshold:
          directoryLimitsRef.current?.fileConfirmationThreshold ??
          DEFAULT_FILE_CONFIRMATION_THRESHOLD,
      };
      const enumerationController = new AbortController();
      enumerationAbortRef.current = enumerationController;
      const directory = await portRef.current.openDirectory({
        ...limits,
        signal: enumerationController.signal,
        onProgress: (progress) => {
          if (isCurrentOperation(operationId)) {
            dispatch({ type: "enumeration-progressed", progress });
          }
        },
        confirmManyFiles: (filesFound) => {
          if (confirmLargeFolderRef.current) {
            return confirmLargeFolderRef.current(filesFound);
          }
          return window.confirm(
            `A pasta contém pelo menos ${filesFound} arquivos Markdown. Continuar a abertura?`,
          );
        },
      });
      if (!isCurrentOperation(operationId)) return;
      validateDirectory(directory);

      const first = directory.files[0];
      const text = first
        ? await portRef.current.readText(first, directory)
        : "";
      if (!isCurrentOperation(operationId)) return;

      commitDirectorySession(directory, first?.path ?? null, text);
      dispatch({
        type: "capabilities-changed",
        capabilities: portRef.current.getCapabilities(),
      });
      const skipped = directory.enumeration?.skippedDirectories ?? 0;
      dispatch({
        type: "storage-warning-changed",
        warning:
          skipped > 0
            ? `${skipped} ${skipped === 1 ? "subpasta foi ignorada" : "subpastas foram ignoradas"} além da profundidade máxima de ${limits.maxDepth} níveis.`
            : null,
      });

      const committedWorkspaceRevision = workspaceRevisionRef.current;
      void portRef.current.persistDirectoryHandle().catch((error) => {
        if (workspaceRevisionRef.current !== committedWorkspaceRevision) return;
        dispatch({
          type: "storage-warning-changed",
          warning: errorMessage(
            error,
            "Não foi possível persistir o acesso à pasta para a próxima sessão.",
          ),
        });
      });
    } catch (error) {
      if (isAbortError(error) || !isCurrentOperation(operationId)) return;
      dispatch({
        type: "filesystem-error-changed",
        error: errorMessage(error, "Não foi possível abrir a pasta."),
      });
    } finally {
      if (enumerationAbortRef.current?.signal.aborted) {
        enumerationAbortRef.current = null;
      }
      if (isCurrentOperation(operationId)) {
        enumerationAbortRef.current = null;
        dispatch({ type: "enumeration-stopped" });
      }
    }
  }, [
    beginOperation,
    commitDirectorySession,
    isCurrentOperation,
    resolveDirtyGuard,
  ]);

  const openFile = useCallback(
    async (path: string) => {
      if (path === activePathRef.current) return;
      const operationId = beginOperation();
      dispatch({ type: "filesystem-error-changed", error: null });

      const proceed = await resolveDirtyGuard();
      if (!proceed || !isCurrentOperation(operationId)) return;

      const entry = filesRef.current.find((file) => file.path === path);
      if (!entry) {
        dispatch({
          type: "filesystem-error-changed",
          error: `Arquivo não listado: ${path}`,
        });
        return;
      }

      try {
        const text = await portRef.current.readText(entry);
        if (!isCurrentOperation(operationId)) return;
        commitSavedBuffer(path, text);
      } catch (error) {
        if (!isCurrentOperation(operationId)) return;
        dispatch({
          type: "filesystem-error-changed",
          error: errorMessage(error, "Não foi possível ler o arquivo."),
        });
      }
    },
    [
      beginOperation,
      commitSavedBuffer,
      isCurrentOperation,
      resolveDirtyGuard,
    ],
  );

  const save = useCallback(async () => {
    await performSave();
  }, [performSave]);

  const closeFolder = useCallback(async () => {
    const operationId = beginOperation();
    dispatch({ type: "filesystem-error-changed", error: null });
    const proceed = await resolveDirtyGuard();
    if (!proceed || !isCurrentOperation(operationId)) return;

    const stored = readDraft();
    const draft =
      stored.ok && stored.value !== null
        ? parseDraftOrSample(stored.value, SAMPLE_MARKDOWN)
        : SAMPLE_MARKDOWN;
    commitDraftSession(draft);
    dispatch({ type: "storage-warning-changed", warning: null });

    const closedWorkspaceRevision = workspaceRevisionRef.current;
    try {
      await portRef.current.clearPersistedDirectory();
    } catch (error) {
      if (workspaceRevisionRef.current !== closedWorkspaceRevision) return;
      dispatch({
        type: "storage-warning-changed",
        warning: errorMessage(
          error,
          "Não foi possível remover a pasta persistida.",
        ),
      });
    }
  }, [
    beginOperation,
    commitDraftSession,
    isCurrentOperation,
    resolveDirtyGuard,
  ]);

  const clearDocument = useCallback(() => {
    if (folderOpenRef.current) return;
    cancelEnumeration();
    operationIdRef.current += 1;
    const cleared = clearDraft();
    const written = writeDraftImmediate("");
    commitSavedBuffer(null, "");
    dispatch({
      type: "storage-warning-changed",
      warning: !cleared.ok
        ? cleared.error
        : !written.ok
          ? written.error
          : null,
    });
  }, [cancelEnumeration, commitSavedBuffer]);

  return {
    markdown: state.markdown,
    setMarkdown,
    documentRevision: documentRevisionRef.current,
    hydrated: state.hydrated,
    storageWarning: state.storageWarning,
    fsError: state.fsError,
    clearDocument,
    files: state.files,
    activePath: state.activePath,
    folderName: state.folderName,
    workspaceId: state.workspaceId,
    isFolderOpen,
    dirty: state.dirty,
    saving: state.saving,
    saveStatus: state.saveStatus,
    isEnumerating: state.isEnumerating,
    enumerationProgress: state.enumerationProgress,
    capabilities: state.capabilities,
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

function validateDirectory(directory: OpenDirectoryResult): void {
  if (!directory.workspaceId.trim()) {
    throw new Error("A pasta selecionada não possui uma identidade válida.");
  }
  if (!directory.folderName.trim()) {
    throw new Error("A pasta selecionada não possui um nome válido.");
  }

  const paths = new Set<string>();
  for (const file of directory.files) {
    if (
      file.kind !== "file" ||
      !file.path.trim() ||
      !isMarkdownFileName(file.path)
    ) {
      throw new Error(`Entrada de arquivo inválida: ${file.path}`);
    }
    if (paths.has(file.path)) {
      throw new Error(`Arquivo duplicado na pasta: ${file.path}`);
    }
    paths.add(file.path);
  }
}
