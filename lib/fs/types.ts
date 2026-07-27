export type FileEntry = {
  path: string;
  name: string;
  kind: "file";
};

export type FsCapabilities = {
  canOverwriteInPlace: boolean;
  canPersistDirectoryHandle: boolean;
};

export type OpenDirectoryResult = {
  folderName: string;
  files: FileEntry[];
};
