import { useCallback, useSyncExternalStore } from "react";
import { bridge } from "./bridge";
import { load, save } from "./storage";
import { LOCAL_ENGINES, type LocalConfig, type LocalEngineKind, type LocalStatus } from "../../core/local";

/**
 * Which engine answers: Space Studio's cloud models (Orbit, Nebula, Solar, Nova; uses credits) or the person's own Local
 * model (Ollama or llama.cpp on this computer; free, offline, quality depends on the model). One app-wide choice, remembered.
 */
export type EngineMode = "cloud" | "local";
export type LocalPrefs = { mode: EngineMode; config: LocalConfig; model: string | null };

type State = LocalPrefs & { status: LocalStatus | null; checking: boolean };

const isKind = (v: unknown): v is LocalEngineKind => v === "ollama" || v === "llamacpp";

function initial(): State {
  const mode = load<unknown>("engine:mode", "cloud") === "local" ? "local" : "cloud";
  const kind = load<unknown>("engine:kind", "ollama");
  const engine = isKind(kind) ? kind : "ollama";
  const p = Number(load<unknown>("engine:port", LOCAL_ENGINES[engine].defaultPort));
  const port = Number.isInteger(p) && p >= 1024 && p <= 65535 ? p : LOCAL_ENGINES[engine].defaultPort;
  const m = load<unknown>("engine:model", null);
  return { mode, config: { engine, port }, model: typeof m === "string" && m ? m : null, status: null, checking: false };
}

let state: State = initial();
const listeners = new Set<() => void>();
const set = (p: Partial<State>) => { state = { ...state, ...p }; listeners.forEach((l) => l()); };
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** The current choice, readable outside React (the chat engine reads it when sending). */
export const localPrefs = (): State => state;
export const localAvailable = () => !!bridge?.local;

export async function checkLocal(): Promise<LocalStatus | null> {
  if (!bridge?.local) return null;
  set({ checking: true });
  const status = await bridge.local.status(state.config).catch(() => null);
  const models = status?.reachable ? status.models : [];
  // Keep the chosen model if the server still has it; otherwise take the first one it offers.
  const model = state.model && models.includes(state.model) ? state.model : models[0] ?? state.model;
  if (model !== state.model && model) save("engine:model", model);
  set({ status, checking: false, model: model ?? null });
  return status;
}

export function useLocalEngine() {
  const s = useSyncExternalStore(subscribe, () => state);
  const setMode = useCallback((mode: EngineMode) => {
    save("engine:mode", mode);
    set({ mode });
    if (mode === "local") void checkLocal();
  }, []);
  const setEngine = useCallback((engine: LocalEngineKind) => {
    const port = LOCAL_ENGINES[engine].defaultPort;
    save("engine:kind", engine);
    save("engine:port", port);
    set({ config: { engine, port }, status: null });
    void checkLocal();
  }, []);
  const setPort = useCallback((port: number) => {
    if (!Number.isInteger(port) || port < 1024 || port > 65535) return;
    save("engine:port", port);
    set({ config: { ...state.config, port }, status: null });
  }, []);
  const setModel = useCallback((model: string) => { save("engine:model", model); set({ model }); }, []);
  return { ...s, available: localAvailable(), setMode, setEngine, setPort, setModel, check: checkLocal };
}
