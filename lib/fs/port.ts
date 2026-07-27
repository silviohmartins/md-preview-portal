import type {
  FileEntry,
  FsCapabilities,
  OpenDirectoryResult,
} from "@/lib/fs/types";

export type FileSystemPort = {
  getCapabilities(): FsCapabilities;
  openDirectory(): Promise<OpenDirectoryResult>;
  restoreDirectory(): Promise<OpenDirectoryResult | null>;
  persistDirectoryHandle(): Promise<void>;
  clearPersistedDirectory(): Promise<void>;
  readText(entry: FileEntry): Promise<string>;
  writeText(entry: FileEntry, content: string): Promise<void>;
};
