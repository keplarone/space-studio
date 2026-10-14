import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api, errorMessage } from "./bridge";
import type { Experience, Stats, StatsRange } from "./types";

/**
 * Real Roblox numbers for the Dashboard and the Robux pill, from keplar.one (docs/api.md):
 * - live players, visits and favourites come from Roblox's public game API, sampled by keplar.one; CCU history is the samples it
 *   has recorded since the experience was added (Roblox publishes no history);
 * - revenue and Robux come only from sales the experience's own beacon script reported.
 * Nothing is estimated or filled in here: a missing number is shown as missing.
 */

export type Loadable<T> = { status: "idle" | "loading" } | { status: "ready"; data: T; at: number } | { status: "error"; message: string; code?: string };

type Entry = { state: Loadable<Stats>; subs: number; timer: number | null; inflight: boolean };
const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let version = 0;

async function load(key: string, universe: string, range: StatsRange) {
  const e = cache.get(key);
  if (!e || e.inflight) return;
  e.inflight = true;
  if (e.state.status !== "ready") { e.state = { status: "loading" }; version++; emit(); }
  const r = await api<Stats>("GET", `/api/space-studio/stats?universe=${encodeURIComponent(universe)}&range=${range}`);
  e.inflight = false;
  if (r.status === 200 && r.data) e.state = { status: "ready", data: r.data, at: Date.now() };
  else if (e.state.status !== "ready" || r.status !== 0) {
    const code = (r.data as { code?: string } | null)?.code;
    e.state = { status: "error", message: errorMessage(r.status, r.data, "Couldn't load stats."), code };
  }
  version++;
  emit();
}

/** Live stats for one experience (or "all"), refreshed every `pollMs` while any component shows them. */
export function useStats(universe: string | null, range: StatsRange, pollMs = 20_000): Loadable<Stats> & { refresh: () => void } {
  const key = universe ? `${universe}|${range}` : "";
  useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => version);
  useEffect(() => {
    if (!universe) return;
    let e = cache.get(key);
    if (!e) { e = { state: { status: "idle" }, subs: 0, timer: null, inflight: false }; cache.set(key, e); }
    e.subs++;
    void load(key, universe, range);
    if (e.subs === 1) e.timer = window.setInterval(() => { if (!document.hidden) void load(key, universe, range); }, pollMs);
    return () => {
      const x = cache.get(key);
      if (!x) return;
      x.subs--;
      if (x.subs <= 0 && x.timer != null) { window.clearInterval(x.timer); x.timer = null; }
    };
  }, [key, universe, range, pollMs]);
  const refresh = useCallback(() => { if (universe) void load(key, universe, range); }, [key, universe, range]);
  const state = (universe && cache.get(key)?.state) || { status: "idle" as const };
  return { ...state, refresh };
}

export type AddResult = { ok: true; experience: Experience; token: string; script: string } | { ok: false; message: string };

/** The experiences this account tracks. */
export function useExperiences() {
  const [state, setState] = useState<Loadable<Experience[]>>({ status: "loading" });
  const alive = useRef(true);
  const reload = useCallback(async () => {
    const r = await api<{ experiences: Experience[] }>("GET", "/api/space-studio/experiences");
    if (!alive.current) return;
    if (r.status === 200 && r.data) setState({ status: "ready", data: r.data.experiences, at: Date.now() });
    else setState({ status: "error", message: errorMessage(r.status, r.data, "Couldn't load your experiences."), code: (r.data as { code?: string } | null)?.code });
  }, []);
  useEffect(() => {
    alive.current = true;
    void reload();
    return () => { alive.current = false; };
  }, [reload]);

  const add = useCallback(async (link: string): Promise<AddResult> => {
    const r = await api<{ experience: Experience; beacon: { token: string; script: string } }>("POST", "/api/space-studio/experiences", { link });
    if (r.status === 200 && r.data) { void reload(); return { ok: true, experience: r.data.experience, token: r.data.beacon.token, script: r.data.beacon.script }; }
    return { ok: false, message: errorMessage(r.status, r.data, "Couldn't add that experience.") };
  }, [reload]);
  const remove = useCallback(async (universeId: string) => {
    const r = await api("DELETE", `/api/space-studio/experiences/${encodeURIComponent(universeId)}`);
    void reload();
    return r.status === 200 || r.status === 204;
  }, [reload]);
  const rotateBeacon = useCallback(async (universeId: string): Promise<{ token: string; script: string } | { error: string }> => {
    const r = await api<{ token: string; script: string }>("POST", `/api/space-studio/experiences/${encodeURIComponent(universeId)}/beacon`, {});
    return r.status === 200 && r.data ? r.data : { error: errorMessage(r.status, r.data, "Couldn't create a new beacon key.") };
  }, []);
  return { state, reload, add, remove, rotateBeacon };
}
