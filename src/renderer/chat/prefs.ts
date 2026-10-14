import { useCallback, useMemo, useSyncExternalStore } from "react";
import { load, save } from "../lib/storage";
import type { Effort, ModelId, ModelView, Workspace } from "../lib/types";
import { MODELS } from "../../core/models";

/** The five effort levels, in order, with the copy the picker and the answer footers use. */
export const EFFORTS: readonly { id: Effort; label: string; note: string }[] = [
  { id: "low", label: "Low", note: "Fastest replies with light reasoning. Uses the fewest credits." },
  { id: "medium", label: "Medium", note: "Balanced reasoning for everyday tasks." },
  { id: "high", label: "High", note: "Thinks longer before it answers. Uses more credits." },
  { id: "extra", label: "Extra", note: "Long reasoning for hard bugs and architecture. Uses many credits." },
  {
    id: "ultracode",
    label: "Ultracode",
    note: "The longest reasoning, then a second self-review pass over the whole answer before you see it. Uses the most credits and takes the longest.",
  },
];

export const effortLabel = (e: Effort | undefined | null): string => EFFORTS.find((x) => x.id === e)?.label ?? "";
const isEffort = (v: unknown): v is Effort => EFFORTS.some((e) => e.id === v);
const isModel = (v: unknown): v is ModelId => MODELS.some((m) => m.id === v);

export const PLAN_LABEL: Record<string, string> = { free: "Free", plus: "Plus", pro: "Pro", team: "Team", enterprise: "Enterprise" };
export const SPEED_LABEL: Record<ModelView["speed"], string> = { fastest: "Fastest", fast: "Fast", steady: "Steady", thorough: "Thorough" };

/** Static registry, used only to describe the models while the server's list is unavailable. Never marked available. */
export const REGISTRY_MODELS: ModelView[] = MODELS.map((m) => ({
  id: m.id, name: m.name, tagline: m.tagline, strengths: [...m.strengths], capabilities: [...m.capabilities], speed: m.speed,
  creditNote: m.creditNote, available: false, customization: m.customization,
  minPlan: m.minPlan === "team" || m.minPlan === "enterprise" ? "pro" : m.minPlan,
}));

/**
 * Model and effort, remembered per workspace. One shared store, so the Home composer and the workspace composer for the
 * same workspace always agree.
 */
type Pref = { model: ModelId | null; effort: Effort };
const cache = new Map<Workspace, Pref>();
const listeners = new Set<() => void>();

function read(ws: Workspace): Pref {
  let p = cache.get(ws);
  if (!p) {
    const m = load<unknown>(`model:${ws}`, null);
    const e = load<unknown>(`effort:${ws}`, "medium");
    p = { model: isModel(m) ? m : null, effort: isEffort(e) ? e : "medium" };
    cache.set(ws, p);
  }
  return p;
}

function write(ws: Workspace, patch: Partial<Pref>) {
  const next = { ...read(ws), ...patch };
  cache.set(ws, next);
  if (patch.model !== undefined) save(`model:${ws}`, next.model);
  if (patch.effort !== undefined) save(`effort:${ws}`, next.effort);
  listeners.forEach((l) => l());
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

export interface ChatPrefs {
  models: ModelView[];
  /** True when the model list came from the server (availability is known). */
  live: boolean;
  model: ModelId;
  effort: Effort;
  setModel: (m: ModelId) => void;
  setEffort: (e: Effort) => void;
}

/** The model the person picked for this workspace, falling back to the first one their plan includes. */
export function useChatPrefs(ws: Workspace, serverModels: ModelView[] | undefined): ChatPrefs {
  const pref = useSyncExternalStore(subscribe, () => read(ws));
  const live = !!serverModels?.length;
  const models = useMemo(() => (live ? serverModels! : REGISTRY_MODELS), [live, serverModels]);
  // Nebula is the everyday default; otherwise the first model the plan includes.
  const firstAvailable = (models.find((m) => m.id === "nebula" && m.available) ?? models.find((m) => m.available))?.id ?? models[0]?.id ?? "nebula";
  const stored = pref.model && models.find((m) => m.id === pref.model);
  const model = stored && (stored.available || !live) ? stored.id : firstAvailable;
  const setModel = useCallback((m: ModelId) => write(ws, { model: m }), [ws]);
  const setEffort = useCallback((e: Effort) => write(ws, { effort: e }), [ws]);
  return { models, live, model, effort: pref.effort, setModel, setEffort };
}
