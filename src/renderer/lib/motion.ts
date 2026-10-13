import { useEffect, useState, useSyncExternalStore } from "react";
import { load, save } from "./storage";

/* ---------- Springs ---------- */

export interface SpringParams {
  stiffness: number;
  damping: number;
  mass: number;
}

/** Spring presets — mirrored by --spring-* custom properties in tokens.css. */
export const SPRINGS = {
  snappy: { stiffness: 520, damping: 30, mass: 1 },
  gentle: { stiffness: 260, damping: 26, mass: 1 },
  bouncy: { stiffness: 420, damping: 18, mass: 1 },
} satisfies Record<string, SpringParams>;

/** Integrates a damped spring from 0 → 1 and returns sampled values plus settle time (ms). */
export function sampleSpring({ stiffness, damping, mass }: SpringParams, maxMs = 1200): { values: number[]; durationMs: number } {
  const dt = 1 / 240;
  let x = 0;
  let v = 0;
  const raw: number[] = [];
  let t = 0;
  let settled = 0;
  while (t * 1000 < maxMs) {
    const force = -stiffness * (x - 1) - damping * v;
    v += (force / mass) * dt;
    x += v * dt;
    raw.push(x);
    t += dt;
    if (Math.abs(x - 1) < 0.001 && Math.abs(v) < 0.01) {
      if (++settled > 12) break;
    } else settled = 0;
  }
  const durationMs = Math.max(120, Math.round(t * 1000));
  const points = 32;
  const values: number[] = [];
  for (let i = 0; i <= points; i++) values.push(raw[Math.min(raw.length - 1, Math.round((i / points) * (raw.length - 1)))]);
  values[values.length - 1] = 1;
  return { values, durationMs };
}

/** CSS `linear()` easing generated from spring physics. */
export function springEasing(p: SpringParams): { easing: string; durationMs: number } {
  const { values, durationMs } = sampleSpring(p);
  return { easing: `linear(${values.map((v) => +v.toFixed(4)).join(", ")})`, durationMs };
}

/** Writes spring easings into CSS custom properties so plain CSS transitions can use them. */
export function installSpringTokens(root: HTMLElement = document.documentElement): void {
  for (const [name, params] of Object.entries(SPRINGS)) {
    const { easing, durationMs } = springEasing(params);
    if (CSS.supports("transition-timing-function", easing)) {
      root.style.setProperty(`--ease-spring-${name}`, easing);
      root.style.setProperty(`--dur-spring-${name}`, `${durationMs}ms`);
    }
  }
}

/* ---------- Reduced motion (OS preference OR in-app toggle) ---------- */

const mq = typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
let userReduce: boolean = load("reduceMotion", false);
const listeners = new Set<() => void>();

function apply() {
  const reduced = userReduce || !!mq?.matches;
  document.documentElement.dataset.motion = reduced ? "reduced" : "full";
  listeners.forEach((l) => l());
}

export function initMotion(): void {
  installSpringTokens();
  mq?.addEventListener("change", apply);
  apply();
}

export const motionPrefs = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  isReduced: () => userReduce || !!mq?.matches,
  userSetting: () => userReduce,
  osReduced: () => !!mq?.matches,
  setUserReduce(v: boolean) {
    userReduce = v;
    save("reduceMotion", v);
    apply();
  },
};

export function useReducedMotion(): boolean {
  return useSyncExternalStore(motionPrefs.subscribe, motionPrefs.isReduced);
}

export function useUserReduceMotion(): [boolean, (v: boolean) => void] {
  const v = useSyncExternalStore(motionPrefs.subscribe, motionPrefs.userSetting);
  return [v, motionPrefs.setUserReduce];
}

/** Keeps an element mounted while its exit animation runs. */
export function usePresence(open: boolean, exitMs: number): { mounted: boolean; state: "open" | "closing" } {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    const t = window.setTimeout(() => setMounted(false), reduced ? 0 : exitMs);
    return () => window.clearTimeout(t);
  }, [open, exitMs, reduced, mounted]);
  return { mounted: open || mounted, state: open ? "open" : "closing" };
}
