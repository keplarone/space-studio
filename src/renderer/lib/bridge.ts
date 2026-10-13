/**
 * Thin wrapper over the preload bridge. Every API call is recorded in the activity log
 * (method, path, status, duration) so the bottom panel shows real traffic only.
 * When `window.space` is absent (plain `vite` dev in a browser) calls resolve to
 * `{ status: 0 }` and the UI shows a "Not connected" state. No data is ever fabricated.
 */
export const bridge: SpaceBridge | null = typeof window !== "undefined" && window.space ? window.space : null;
export const connected = bridge !== null;

export interface ActivityEntry {
  id: number;
  method: SpaceMethod;
  path: string;
  status: number | null; // null while pending
  ms: number | null;
  at: number;
}

let entries: ActivityEntry[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const activity = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  get: () => entries,
  clear() {
    entries = [];
    emit();
  },
};

function record(e: ActivityEntry) {
  entries = [e, ...entries.filter((x) => x.id !== e.id)].slice(0, 200);
  emit();
}

export interface ApiResult<T> {
  status: number;
  data: T | null;
  ms: number;
}

export async function api<T>(method: SpaceMethod, path: string, body?: unknown): Promise<ApiResult<T>> {
  const id = ++seq;
  const at = Date.now();
  const t0 = performance.now();
  record({ id, method, path, status: null, ms: null, at });
  if (!bridge) {
    const ms = Math.round(performance.now() - t0);
    record({ id, method, path, status: 0, ms, at });
    return { status: 0, data: null, ms };
  }
  try {
    const res = await bridge.api<T>({ method, path, body });
    const ms = Math.round(performance.now() - t0);
    record({ id, method, path, status: res.status, ms, at });
    return { status: res.status, data: (res.data ?? null) as T | null, ms };
  } catch {
    const ms = Math.round(performance.now() - t0);
    record({ id, method, path, status: 0, ms, at });
    return { status: 0, data: null, ms };
  }
}

export function errorMessage(status: number, data: unknown, fallback = "Something went wrong."): string {
  if (status === 0) return "Not connected — run inside the Space Studio app.";
  const d = data as { error?: unknown } | null;
  if (d && typeof d.error === "string" && d.error) return d.error;
  if (status === 401) return "You're signed out. Sign in to continue.";
  return `${fallback} (HTTP ${status})`;
}

export function errorCode(data: unknown): string | null {
  const d = data as { code?: unknown } | null;
  return d && typeof d.code === "string" ? d.code : null;
}

export async function openExternal(url: string): Promise<void> {
  if (bridge) await bridge.openExternal(url);
}

export const PLANS_URL = "https://keplar.one/space-studio#plans";
