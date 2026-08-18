export const DRAFT_KEY = "md-draft";
export const THEME_KEY = "md-theme";

export type ThemeMode = "light" | "dark";

type StorageResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function safeGetItem(key: string): StorageResult<string | null> {
  if (typeof window === "undefined") {
    return { ok: true, value: null };
  }
  try {
    return { ok: true, value: window.localStorage.getItem(key) };
  } catch {
    return { ok: false, error: "O armazenamento local não está disponível." };
  }
}

function safeSetItem(key: string, value: string): StorageResult<void> {
  if (typeof window === "undefined") {
    return { ok: true, value: undefined };
  }
  try {
    window.localStorage.setItem(key, value);
    return { ok: true, value: undefined };
  } catch {
    return { ok: false, error: "Não foi possível salvar no armazenamento local." };
  }
}

export function readDraft(): StorageResult<string | null> {
  return safeGetItem(DRAFT_KEY);
}

export function writeDraftImmediate(content: string): StorageResult<void> {
  return safeSetItem(DRAFT_KEY, content);
}

export function readTheme(): StorageResult<ThemeMode | null> {
  const result = safeGetItem(THEME_KEY);
  if (!result.ok) return result;
  if (result.value === "light" || result.value === "dark") {
    return { ok: true, value: result.value };
  }
  return { ok: true, value: null };
}

export function writeTheme(mode: ThemeMode): StorageResult<void> {
  return safeSetItem(THEME_KEY, mode);
}

export function clearDraft(): StorageResult<void> {
  if (typeof window === "undefined") {
    return { ok: true, value: undefined };
  }
  try {
    window.localStorage.removeItem(DRAFT_KEY);
    return { ok: true, value: undefined };
  } catch {
    return { ok: false, error: "Não foi possível limpar o rascunho salvo." };
  }
}

export function createDebouncedDraftWriter(delayMs = 500) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let memoryFallback: string | null = null;

  return {
    write(content: string, onError?: (message: string) => void) {
      memoryFallback = content;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const result = writeDraftImmediate(content);
        if (!result.ok) {
          onError?.(result.error);
        }
      }, delayMs);
    },
    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (memoryFallback !== null) {
        return writeDraftImmediate(memoryFallback);
      }
      return { ok: true as const, value: undefined };
    },
    getMemoryFallback() {
      return memoryFallback;
    },
  };
}

export function parseDraftOrSample(
  raw: string | null,
  sample: string,
): string {
  return raw === null ? sample : raw;
}

export function parseStoredTheme(raw: string | null): ThemeMode | null {
  if (raw === "light" || raw === "dark") return raw;
  return null;
}
