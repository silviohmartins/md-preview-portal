const DB_NAME = "mdstudio-fs";
const DB_VERSION = 1;
const STORE_NAME = "handles";
const WORKSPACE_DIR_KEY = "workspace-dir";
const WORKSPACE_REGISTRY_KEY = "workspace-registry";

type WorkspaceDirectoryRecord = {
  workspaceId: string;
  handle: FileSystemDirectoryHandle;
};

function workspaceIdKey(key: string): string {
  return `${key}:id`;
}

async function sameDirectory(
  left: FileSystemDirectoryHandle,
  right: FileSystemDirectoryHandle,
): Promise<boolean> {
  if (left === right) return true;
  if (typeof left.isSameEntry !== "function") return false;
  try {
    return await left.isSameEntry(right);
  } catch {
    return false;
  }
}

async function loadWorkspaceRegistry(): Promise<WorkspaceDirectoryRecord[]> {
  const db = await openDb();
  try {
    return await new Promise<WorkspaceDirectoryRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      tx.onerror = () => reject(tx.error ?? new Error("Não foi possível ler o IndexedDB."));
      tx.onabort = () => reject(tx.error ?? new Error("A leitura do IndexedDB foi interrompida."));
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onerror = () =>
        reject(request.error ?? new Error("A solicitação ao IndexedDB falhou."));
      request.onsuccess = () => {
        const records = request.result.flatMap((value) =>
          Array.isArray(value) ? value : [value],
        );
        resolve(
          records.filter(
            (value): value is WorkspaceDirectoryRecord =>
              typeof value === "object" &&
              value !== null &&
              typeof value.workspaceId === "string" &&
              typeof value.handle === "object" &&
              value.handle !== null,
          ),
        );
      };
    });
  } finally {
    db.close();
  }
}

async function saveWorkspaceRecord(
  record: WorkspaceDirectoryRecord,
): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Não foi possível gravar no IndexedDB."));
      tx.onabort = () => reject(tx.error ?? new Error("A gravação no IndexedDB foi interrompida."));
      tx.objectStore(STORE_NAME).put(
        record,
        `${WORKSPACE_REGISTRY_KEY}:${record.workspaceId}`,
      );
    });
  } finally {
    db.close();
  }
}

export async function findDirectoryWorkspaceId(
  handle: FileSystemDirectoryHandle,
): Promise<string | null> {
  const records = await loadWorkspaceRegistry();
  for (const record of records) {
    if (await sameDirectory(record.handle, handle)) return record.workspaceId;
  }
  return null;
}

export async function rememberDirectoryWorkspace(
  handle: FileSystemDirectoryHandle,
  workspaceId: string,
): Promise<void> {
  const records = await loadWorkspaceRegistry();
  for (const record of records) {
    if (await sameDirectory(record.handle, handle)) return;
  }
  await saveWorkspaceRecord({ handle, workspaceId });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("O IndexedDB não está disponível."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let settled = false;
    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    request.onerror = () =>
      rejectOnce(request.error ?? new Error("Não foi possível abrir o IndexedDB."));
    request.onblocked = () =>
      rejectOnce(new Error("Outra aba bloqueou a abertura do IndexedDB."));
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      resolve(request.result);
    };
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
  workspaceId?: string,
): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Não foi possível gravar no IndexedDB."));
      tx.onabort = () => reject(tx.error ?? new Error("A gravação no IndexedDB foi interrompida."));
      const store = tx.objectStore(STORE_NAME);
      store.put(handle, key);
      if (workspaceId) store.put(workspaceId, workspaceIdKey(key));
    });
  } finally {
    db.close();
  }
}

export async function loadDirectoryWorkspaceId(
  key = WORKSPACE_DIR_KEY,
): Promise<string | null> {
  const db = await openDb();
  try {
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      tx.onerror = () => reject(tx.error ?? new Error("Não foi possível ler o IndexedDB."));
      tx.onabort = () => reject(tx.error ?? new Error("A leitura do IndexedDB foi interrompida."));
      const request = tx.objectStore(STORE_NAME).get(workspaceIdKey(key));
      request.onerror = () =>
        reject(request.error ?? new Error("A solicitação ao IndexedDB falhou."));
      request.onsuccess = () =>
        resolve(typeof request.result === "string" ? request.result : null);
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
      tx.onerror = () => reject(tx.error ?? new Error("Não foi possível ler o IndexedDB."));
      tx.onabort = () => reject(tx.error ?? new Error("A leitura do IndexedDB foi interrompida."));
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onerror = () =>
        reject(request.error ?? new Error("A solicitação ao IndexedDB falhou."));
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
      tx.onerror = () => reject(tx.error ?? new Error("Não foi possível limpar o IndexedDB."));
      tx.onabort = () => reject(tx.error ?? new Error("A limpeza do IndexedDB foi interrompida."));
      const store = tx.objectStore(STORE_NAME);
      store.delete(key);
      store.delete(workspaceIdKey(key));
    });
  } finally {
    db.close();
  }
}
