/** The only API the Space Studio page gets. Small, explicit, no Node objects or ipcRenderer handed through. */
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("space", {
  api: (req: { method: string; path: string; body?: unknown }) => ipcRenderer.invoke("space:api", { method: req?.method, path: req?.path, body: req?.body }),
  signIn: (provider?: string) => ipcRenderer.invoke("space:signIn", typeof provider === "string" ? provider : "keplar"),
  copy: (text: string) => ipcRenderer.invoke("space:copy", String(text)),
  local: {
    status: (config: unknown) => ipcRenderer.invoke("space:local:status", config),
    chat: (req: unknown) => ipcRenderer.invoke("space:local:chat", req),
  },
  signOut: () => ipcRenderer.invoke("space:signOut"),
  linkRoblox: () => ipcRenderer.invoke("space:linkRoblox"),
  openExternal: (url: string) => ipcRenderer.invoke("space:openExternal", String(url)),
  detect: () => ipcRenderer.invoke("space:detect"),
  platform: process.platform,
  version: "0.3.2",
});
