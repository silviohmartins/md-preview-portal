const DB_NAME = "mdstudio-fs";
const DB_VERSION = 1;
const STORE_NAME = "handles";
export const WORKSPACE_DIR_KEY = "workspace-dir";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function saveDirectoryHandle(
  handle: FileSystemDirectoryHandle,
  key = WORKSPACE_DIR_KEY,
): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
      tx.objectStore(STORE_NAME).put(handle, key);
    });
  } finally {
    db.close();
  }
}

export async function loadDirectoryHandle(
  key = WORKSPACE_DIR_KEY,
): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb();
  try {
    return await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB read failed"));
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => {
        resolve((request.result as FileSystemDirectoryHandle | undefined) ?? null);
      };
    });
  } finally {
    db.close();
  }
}

export async function clearDirectoryHandle(
  key = WORKSPACE_DIR_KEY,
): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB clear failed"));
      tx.objectStore(STORE_NAME).delete(key);
    });
  } finally {
    db.close();
  }
}
