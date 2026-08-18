import type {
  FileEntry,
  OpenDirectoryOptions,
  FsCapabilities,
  OpenDirectoryResult,
} from "@/lib/fs/types";

export type FileSystemPort = {
  getCapabilities(): FsCapabilities;
  openDirectory(options?: OpenDirectoryOptions): Promise<OpenDirectoryResult>;
  restoreDirectory(
    options?: OpenDirectoryOptions,
  ): Promise<OpenDirectoryResult | null>;
  commitDirectory(directory: OpenDirectoryResult | null): void;
  persistDirectoryHandle(): Promise<void>;
  clearPersistedDirectory(): Promise<void>;
  readText(
    entry: FileEntry,
    directory?: OpenDirectoryResult,
  ): Promise<string>;
  writeText(entry: FileEntry, content: string): Promise<void>;
};
