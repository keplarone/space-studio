/** Preload bridge exposed by src/main as `window.space` (contract: docs/api.md). */
export {};

declare global {
  type SpaceMethod = "GET" | "POST" | "DELETE";

  interface SpaceDetectResult {
    blender: { path: string; version: string | null }[];
    robloxStudio: { path: string }[];
  }

  interface SpaceBridge {
    api<T = unknown>(req: { method: SpaceMethod; path: string; body?: unknown }): Promise<{ status: number; data: T }>;
    signIn(): Promise<{ signedIn: boolean }>;
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
