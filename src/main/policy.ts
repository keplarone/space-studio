/**
 * Pure checks for the main process (unit-tested in test/policy.test.ts): which API paths the renderer may call, which URLs may
 * open outside the app, and IPC payload validation. Everything the renderer sends is untrusted.
 */
export const API_BASE = "https://keplar.one";
const API_PREFIXES = ["/api/space-studio/", "/api/account/sessions", "/api/account/delete", "/api/account/export"];
const METHODS = new Set(["GET", "POST", "DELETE"]);
const EXTERNAL_HOSTS = ["keplar.one", "www.keplar.one", "roblox.com", "www.roblox.com", "create.roblox.com", "blender.org", "www.blender.org", "docs.blender.org"];

export type ApiRequest = { method: "GET" | "POST" | "DELETE"; path: string; body?: unknown };

export function validateApiRequest(raw: unknown): ApiRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.method !== "string" || !METHODS.has(r.method)) return null;
  if (typeof r.path !== "string" || r.path.length > 300) return null;
  // One absolute path, no scheme/host, no traversal, no backslashes, no encoded dots or slashes.
  if (!r.path.startsWith("/") || r.path.startsWith("//") || /[\\\s]|\.\.|%2e|%2f|%5c/i.test(r.path)) return null;
  const pathOnly = r.path.split("?")[0]!;
  // Prefixes ending in "/" cover a subtree; the others are exact routes.
  if (!API_PREFIXES.some((p) => (p.endsWith("/") ? pathOnly.startsWith(p) && pathOnly.length > p.length : pathOnly === p))) return null;
  if (r.body !== undefined) {
    if (r.method === "GET") return null;
    let size = 0;
    try { size = JSON.stringify(r.body).length; } catch { return null; }
    if (size > 200_000) return null;
  }
  return { method: r.method as ApiRequest["method"], path: r.path, body: r.body };
}

export function apiUrl(path: string, base = API_BASE): string {
  const u = new URL(path, base);
  if (u.origin !== new URL(base).origin) throw new Error("off-origin");
  return u.toString();
}

export function isAllowedExternal(raw: unknown): boolean {
  if (typeof raw !== "string" || raw.length > 2_000) return false;
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  return u.protocol === "https:" && !u.username && !u.password && EXTERNAL_HOSTS.includes(u.hostname);
}

/** Navigation inside the sign-in window is allowed only to these origins (keplar.one and the identity providers it uses). */
export function isAllowedAuthNavigation(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && ["keplar.one", "accounts.google.com", "apis.roblox.com", "authorize.roblox.com", "www.roblox.com"].includes(u.hostname);
  } catch { return false; }
}
