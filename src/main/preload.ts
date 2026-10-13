/** The only API the Space Studio page gets. Small, explicit, no Node objects or ipcRenderer handed through. */
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("space", {
  api: (req: { method: string; path: string; body?: unknown }) => ipcRenderer.invoke("space:api", { method: req?.method, path: req?.path, body: req?.body }),
  signIn: () => ipcRenderer.invoke("space:signIn"),
  signOut: () => ipcRenderer.invoke("space:signOut"),
  linkRoblox: () => ipcRenderer.invoke("space:linkRoblox"),
  openExternal: (url: string) => ipcRenderer.invoke("space:openExternal", String(url)),
  detect: () => ipcRenderer.invoke("space:detect"),
  platform: process.platform,
  version: "0.1.0",
});
