/** Preload bridge exposed by src/main as `window.space` (contract: docs/api.md). */
export {};

declare global {
  type SpaceMethod = "GET" | "POST" | "DELETE";

  interface SpaceDetectResult {
    blender: { path: string; version: string | null }[];
    robloxStudio: { path: string }[];
    /** Present when the scan failed or timed out. */
    troubleshoot?: import("../core/troubleshoot").Troubleshoot;
  }

  interface SpaceBridge {
    api<T = unknown>(req: { method: SpaceMethod; path: string; body?: unknown }): Promise<{ status: number; data: T }>;
    /** Opens keplar.one sign-in for one method in a child window. Older builds ignore the argument (Keplar sign-in). */
    signIn(provider?: "keplar" | "google" | "roblox"): Promise<{ signedIn: boolean }>;
    /** Puts plain text on the system clipboard (the page itself has no clipboard permission). */
    copy?(text: string): Promise<boolean>;
    /** Local (free) engine on this computer. Absent in builds before 0.3. */
    local?: {
      status(config: import("../core/local").LocalConfig): Promise<import("../core/local").LocalStatus>;
      chat(req: import("../core/local").LocalChatRequest): Promise<import("../core/local").LocalChatResult>;
    };
    signOut(): Promise<void>;
    linkRoblox(): Promise<{ linked: boolean; error?: string }>;
    openExternal(url: string): Promise<void>;
    detect(): Promise<SpaceDetectResult>;
    platform: "win32" | "darwin" | "linux";
    version: string;
  }

  interface Window {
    space?: SpaceBridge;
  }
}
