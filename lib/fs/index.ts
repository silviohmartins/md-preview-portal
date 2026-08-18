export type {
  DirectoryEnumerationProgress,
  DirectoryEnumerationSummary,
  DirectoryLimits,
  FileEntry,
  FsCapabilities,
  OpenDirectoryOptions,
  OpenDirectoryResult,
} from "@/lib/fs/types";
export type { FileSystemPort } from "@/lib/fs/port";
export {
  createBrowserFsAccessAdapter,
  DEFAULT_FILE_CONFIRMATION_THRESHOLD,
  DEFAULT_MAX_DIRECTORY_DEPTH,
} from "@/lib/fs/browserFsAccessAdapter";
export {
  isMarkdownFileName,
} from "@/lib/fs/markdownFiles";
