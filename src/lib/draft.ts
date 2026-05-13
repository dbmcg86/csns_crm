const KEY = "cns-crm-intake-draft-v1";

export function loadDraft<T>(): Partial<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<T>;
  } catch {
    return null;
  }
}

export function saveDraft<T>(values: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(values));
  } catch {
    // localStorage quota or unavailable — ignore silently
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
