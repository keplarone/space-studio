/** localStorage wrapper that never throws (private windows, blocked storage). */
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`space-studio:${key}`);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(`space-studio:${key}`, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep in-memory state only */
  }
}
