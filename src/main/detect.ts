/** Finds Blender and Roblox Studio installs in their standard locations. Read-only; never runs anything but `blender --version`. */
import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

function safeList(dir: string): string[] {
  try { return readdirSync(dir); } catch { return []; }
}

export function blenderCandidates(platform = process.platform, env = process.env): string[] {
  if (platform === "darwin") return ["/Applications/Blender.app/Contents/MacOS/Blender"];
  if (platform === "win32") {
    const root = path.join(env.ProgramFiles || "C:\\Program Files", "Blender Foundation");
    return safeList(root).map((d) => path.join(root, d, "blender.exe"));
  }
  return ["/usr/bin/blender", "/usr/local/bin/blender", "/snap/bin/blender", path.join(homedir(), "blender", "blender")];
}

export function studioCandidates(platform = process.platform, env = process.env): string[] {
  if (platform === "darwin") return ["/Applications/RobloxStudio.app"];
  if (platform === "win32") {
    const root = path.join(env.LOCALAPPDATA || path.join(homedir(), "AppData", "Local"), "Roblox", "Versions");
    return safeList(root).map((d) => path.join(root, d, "RobloxStudioBeta.exe"));
  }
  return [];
}

const version = (bin: string) => new Promise<string | null>((resolve) => {
  execFile(bin, ["-b", "--factory-startup", "--version"], { timeout: 15_000, windowsHide: true, shell: false }, (err, out) => {
    resolve(err ? null : (String(out).match(/Blender\s+([\d.]+)/)?.[1] ?? null));
  });
});

export async function detect() {
  const blender = [];
  for (const p of blenderCandidates().filter((p) => existsSync(p)).slice(0, 4)) blender.push({ path: p, version: await version(p) });
  const robloxStudio = studioCandidates().filter((p) => existsSync(p)).slice(0, 4).map((p) => ({ path: p }));
  return { blender, robloxStudio };
}
