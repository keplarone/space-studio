/**
 * Safety gates for every desktop-side operation that touches the file system, starts a process (Blender, Roblox Studio) or
 * calls a local service. Each operation gets a hard timeout (15 s unless the caller has a documented reason to allow more) and
 * every failure becomes a Troubleshoot card for the UI, so nothing here can hang the window or crash the app.
 *
 * New file writes, Blender background runs or Luau checks MUST go through `safely()`.
 */
import type { Gated, Troubleshoot } from "../core/troubleshoot";

export const DEFAULT_TIMEOUT_MS = 15_000;

export class TimeoutError extends Error {
  constructor(public readonly label: string, public readonly ms: number) {
    super(`${label} took longer than ${Math.round(ms / 1000)} s and was stopped.`);
    this.name = "TimeoutError";
  }
}

/** Resolves with the work, or rejects with TimeoutError after `ms`. `onTimeout` lets the caller abort the underlying work. */
export function withTimeout<T>(work: Promise<T>, ms: number, label: string, onTimeout?: () => void): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { try { onTimeout?.(); } catch { /* ignore */ } reject(new TimeoutError(label, ms)); }, ms);
  });
  return Promise.race([work, limit]).finally(() => clearTimeout(timer));
}

const clip = (s: string, n = 600) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function errorText(e: unknown): string {
  if (e instanceof Error) return clip(`${e.name === "Error" ? "" : `${e.name}: `}${e.message}`);
  return clip(String(e));
}

/**
 * Runs `fn` under a timeout and turns any failure into a Troubleshoot card. `explain` maps an error to a title and steps;
 * without it the card carries the generic steps for that operation.
 */
export async function safely<T>(
  label: string,
  fn: (signal: AbortSignal) => Promise<T>,
  opts: { timeoutMs?: number; explain?: (e: unknown) => Partial<Troubleshoot> } = {},
): Promise<Gated<T>> {
  const ms = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const ctrl = new AbortController();
  try {
    const value = await withTimeout(Promise.resolve().then(() => fn(ctrl.signal)), ms, label, () => ctrl.abort());
    return { ok: true, value };
  } catch (e) {
    const timedOut = e instanceof TimeoutError;
    const base: Troubleshoot = {
      kind: "troubleshoot",
      code: timedOut ? "timeout" : "failed",
      title: timedOut ? `${label} took too long` : `${label} didn't work`,
      error: errorText(e),
      steps: timedOut
        ? ["Try again; the first run after starting a program is often the slowest.", "If it keeps happening, close other heavy apps and try once more."]
        : ["Try again.", "If it keeps failing, copy the error and send it to Keplar support."],
      actions: ["retry", "copy_error"],
    };
    let extra: Partial<Troubleshoot> = {};
    try { extra = opts.explain?.(e) ?? {}; } catch { /* the explainer itself must not throw */ }
    return { ok: false, troubleshoot: { ...base, ...extra, kind: "troubleshoot" } };
  }
}
