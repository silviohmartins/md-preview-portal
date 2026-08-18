import type {
  DirectoryEnumerationProgress,
  FileEntry,
  FsCapabilities,
} from "@/lib/fs";
import { SAMPLE_MARKDOWN } from "@/lib/markdown";

export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

type WorkspaceState = {
  markdown: string;
  storageWarning: string | null;
  fsError: string | null;
  hydrated: boolean;
  files: FileEntry[];
  activePath: string | null;
  folderName: string | null;
  workspaceId: string;
  dirty: boolean;
  saving: boolean;
  saveStatus: SaveStatus;
  capabilities: FsCapabilities;
  isEnumerating: boolean;
  enumerationProgress: DirectoryEnumerationProgress | null;
};

type WorkspaceAction =
  | {
      type: "document-committed";
      content: string;
      path: string | null;
    }
  | {
      type: "document-edited";
      content: string;
      dirty: boolean;
      saveStatus?: SaveStatus;
    }
  | {
      type: "directory-committed";
      files: FileEntry[];
      folderName: string | null;
      workspaceId: string;
    }
  | {
      type: "save-state-changed";
      dirty?: boolean;
      saving?: boolean;
      saveStatus?: SaveStatus;
    }
  | { type: "storage-warning-changed"; warning: string | null }
  | { type: "filesystem-error-changed"; error: string | null }
  | { type: "hydration-finished" }
  | { type: "capabilities-changed"; capabilities: FsCapabilities }
  | {
      type: "enumeration-started";
      progress: DirectoryEnumerationProgress;
    }
  | {
      type: "enumeration-progressed";
      progress: DirectoryEnumerationProgress;
    }
  | { type: "enumeration-stopped" };

export function createInitialWorkspaceState(
  capabilities: FsCapabilities,
): WorkspaceState {
  return {
    markdown: SAMPLE_MARKDOWN,
    storageWarning: null,
    fsError: null,
    hydrated: false,
    files: [],
    activePath: null,
    folderName: null,
    workspaceId: "standalone-draft",
    dirty: false,
    saving: false,
    saveStatus: "saved",
    capabilities,
    isEnumerating: false,
    enumerationProgress: null,
  };
}

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  switch (action.type) {
    case "document-committed":
      return {
        ...state,
        markdown: action.content,
        activePath: action.path,
        dirty: false,
        saveStatus: "saved",
      };
    case "document-edited":
      return {
        ...state,
        markdown: action.content,
        dirty: action.dirty,
        saveStatus: action.saveStatus ?? state.saveStatus,
      };
    case "directory-committed":
      return {
        ...state,
        files: action.files,
        folderName: action.folderName,
        workspaceId: action.workspaceId,
      };
    case "save-state-changed":
      return {
        ...state,
        dirty: action.dirty ?? state.dirty,
        saving: action.saving ?? state.saving,
        saveStatus: action.saveStatus ?? state.saveStatus,
      };
    case "storage-warning-changed":
      return { ...state, storageWarning: action.warning };
    case "filesystem-error-changed":
      return { ...state, fsError: action.error };
    case "hydration-finished":
      return { ...state, hydrated: true };
    case "capabilities-changed":
      return { ...state, capabilities: action.capabilities };
    case "enumeration-started":
    case "enumeration-progressed":
      return {
        ...state,
        isEnumerating: true,
        enumerationProgress: action.progress,
      };
    case "enumeration-stopped":
      return {
        ...state,
        isEnumerating: false,
        enumerationProgress: null,
      };
  }
}
