/**
 * Space Studio main process.
 *
 * Hardening: the renderer has no Node, runs sandboxed with context isolation and a CSP with no network access; it talks only
 * through the narrow preload bridge. Every IPC message is checked for its sender (our own window and page) and its shape.
 * The keplar.one session lives in a dedicated partition: the main process makes the API calls, so cookies never reach page
 * script. Navigation and new windows are blocked everywhere except the sign-in window's allow-list. Nothing model-generated
 * is executed here.
 */
import { app, BrowserWindow, clipboard, ipcMain, session, shell, type IpcMainInvokeEvent, type WebContents } from "electron";
import path from "node:path";
import { detect } from "./detect";
import { API_BASE, apiUrl, isAllowedAuthNavigation, isAllowedExternal, signInStartUrl, validateApiRequest } from "./policy";

const PARTITION = "persist:space-studio";
const RENDERER_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: https:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
let main: BrowserWindow | null = null;
const rendererIndex = () => path.join(__dirname, "..", "renderer", "index.html");

function harden(wc: WebContents, allowNav: (url: string) => boolean) {
  wc.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternal(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  wc.on("will-navigate", (e, url) => { if (!allowNav(url)) e.preventDefault(); });
  wc.on("will-redirect", (e, url) => { if (!allowNav(url)) e.preventDefault(); });
  wc.on("will-attach-webview", (e) => e.preventDefault());
}

function trusted(e: IpcMainInvokeEvent): boolean {
  return !!main && e.sender === main.webContents && !!e.senderFrame && e.senderFrame.url.startsWith("file://") && e.senderFrame === main.webContents.mainFrame;
}

function handle(channel: string, fn: (e: IpcMainInvokeEvent, ...args: unknown[]) => unknown) {
  ipcMain.handle(channel, async (e, ...args) => {
    if (!trusted(e)) throw new Error("Untrusted sender");
    return fn(e, ...args);
  });
}

async function api(raw: unknown) {
  const req = validateApiRequest(raw);
  if (!req) return { status: 400, data: { error: "Request not allowed.", code: "bridge_rejected" } };
  const ses = session.fromPartition(PARTITION);
  try {
    const res = await ses.fetch(apiUrl(req.path), {
      method: req.method,
      headers: { accept: "application/json", origin: API_BASE, ...(req.body !== undefined ? { "content-type": "application/json" } : {}), "x-space-studio": app.getVersion() },
      body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
      credentials: "include",
      redirect: "manual",
    });
    const text = await res.text();
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { error: "Unexpected response from keplar.one.", code: "bad_response" }; }
    return { status: res.status, data };
  } catch {
    return { status: 0, data: { error: "Couldn't reach keplar.one. Check your connection.", code: "offline" } };
  }
}

async function signedIn(): Promise<boolean> {
  const r = await api({ method: "GET", path: "/api/space-studio/me" });
  return r.status === 200 && !!(r.data as { signedIn?: boolean } | null)?.signedIn;
}

/** A child window on the keplar.one partition for sign-in or provider linking. Resolves when it closes or reaches `done`. */
function authWindow(start: string, done: (url: string) => boolean): Promise<string | null> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      parent: main ?? undefined, modal: !!main, width: 520, height: 720, title: "Space Studio — Sign in", backgroundColor: "#000000",
      webPreferences: { partition: PARTITION, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true },
    });
    let finished: string | null = null;
    harden(win.webContents, isAllowedAuthNavigation);
    const check = (url: string) => { if (!finished && done(url)) { finished = url; win.close(); } };
    win.webContents.on("did-navigate", (_e, url) => check(url));
    win.webContents.on("did-redirect-navigation", (_e, url) => check(url));
    win.on("closed", () => resolve(finished));
    void win.loadURL(start);
  });
}

function createWindow() {
  main = new BrowserWindow({
    width: 1440, height: 900, minWidth: 960, minHeight: 620, show: false, title: "Space Studio", backgroundColor: "#000000",
    webPreferences: { preload: path.join(__dirname, "preload.js"), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, spellcheck: false },
  });
  harden(main.webContents, () => false);
  main.once("ready-to-show", () => main?.show());
  void main.loadFile(rendererIndex());
  main.on("closed", () => { main = null; });
}

app.whenReady().then(() => {
  // No permission prompts (camera, mic, geolocation, notifications…) for any page in either session.
  for (const ses of [session.defaultSession, session.fromPartition(PARTITION)]) {
    ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
    ses.setPermissionCheckHandler(() => false);
  }

  // The renderer's CSP as a real header too (frame-ancestors only works from a header). Applies to our file:// page only.
  session.defaultSession.webRequest.onHeadersReceived({ urls: ["file://*/*"] }, (details, cb) => {
    cb({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [RENDERER_CSP] } });
  });

  handle("space:api", (_e, req) => api(req));
  handle("space:signIn", async (_e, provider) => {
    await authWindow(signInStartUrl(provider), (url) => {
      try { const u = new URL(url); return u.origin === API_BASE && !u.pathname.startsWith("/signin") && !u.pathname.startsWith("/api/auth") && !u.pathname.startsWith("/api/space-studio/auth"); } catch { return false; }
    });
    return { signedIn: await signedIn() };
  });
  handle("space:signOut", async () => {
    // Ends the session on keplar.one (Better Auth), then forgets every cookie and cache in the partition.
    await session.fromPartition(PARTITION).fetch(`${API_BASE}/api/auth/sign-out`, { method: "POST", headers: { origin: API_BASE, "content-type": "application/json" }, body: "{}", credentials: "include" }).catch(() => null);
    await session.fromPartition(PARTITION).clearStorageData({ storages: ["cookies", "localstorage", "indexdb", "serviceworkers", "cachestorage"] });
  });
  handle("space:linkRoblox", async () => {
    const end = await authWindow(`${API_BASE}/api/space-studio/identities/roblox/start`, (url) => {
      try { const u = new URL(url); return u.origin === API_BASE && u.pathname.startsWith("/space-studio/app"); } catch { return false; }
    });
    if (!end) return { linked: false, error: "cancelled" };
    const u = new URL(end);
    const error = u.searchParams.get("link_error");
    return error ? { linked: false, error: error.slice(0, 60) } : { linked: u.searchParams.get("linked") === "roblox" };
  });
  handle("space:copy", (_e, text) => {
    if (typeof text !== "string" || text.length > 100_000) return false;
    clipboard.writeText(text);
    return true;
  });
  handle("space:openExternal", async (_e, url) => { if (isAllowedExternal(url)) await shell.openExternal(String(url)); });
  handle("space:detect", () => detect());

  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("web-contents-created", (_e, wc) => {
  wc.on("will-attach-webview", (ev) => ev.preventDefault());
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
