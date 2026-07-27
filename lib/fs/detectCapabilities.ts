import { supported } from "browser-fs-access";
import type { FsCapabilities } from "@/lib/fs/types";

/**
 * Chromium exposes showDirectoryPicker; Firefox/Safari do not.
 * browser-fs-access.supported mirrors that for the native path.
 */
export function detectFsCapabilities(): FsCapabilities {
  const native =
    typeof window !== "undefined" &&
    supported &&
    "showDirectoryPicker" in window;

  return {
    canOverwriteInPlace: native,
    canPersistDirectoryHandle: native,
  };
}
