export type { FileEntry, FsCapabilities, OpenDirectoryResult } from "@/lib/fs/types";
export type { FileSystemPort } from "@/lib/fs/port";
export { detectFsCapabilities } from "@/lib/fs/detectCapabilities";
export { createBrowserFsAccessAdapter } from "@/lib/fs/browserFsAccessAdapter";
export { isMarkdownFileName, basename } from "@/lib/fs/markdownFiles";
