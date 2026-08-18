export type FileEntry = {
  path: string;
  name: string;
  kind: "file";
  sizeBytes?: number;
};

export type DirectoryEnumerationProgress = {
  filesFound: number;
  directoriesVisited: number;
  skippedDirectories: number;
  currentPath: string;
};

export type DirectoryLimits = {
  maxDepth: number;
  fileConfirmationThreshold: number;
};

export type OpenDirectoryOptions = Partial<DirectoryLimits> & {
  signal?: AbortSignal;
  onProgress?: (progress: DirectoryEnumerationProgress) => void;
  confirmManyFiles?: (filesFound: number) => boolean | Promise<boolean>;
};

export type DirectoryEnumerationSummary = Omit<
  DirectoryEnumerationProgress,
  "currentPath"
>;

export type FsCapabilities = {
  canOverwriteInPlace: boolean;
  canPersistDirectoryHandle: boolean;
};

export type OpenDirectoryResult = {
  workspaceId: string;
  folderName: string;
  files: FileEntry[];
  enumeration?: DirectoryEnumerationSummary;
};
