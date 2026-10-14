import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, bridge } from "./bridge";
import type { ChatSession, Me, ModelId, Workspace } from "./types";

export type ViewId = "home" | "dashboard" | "roblox" | "blender" | "cloud" | "billing" | "account";

/** The floating top navigation, in order. */
export const NAV: { id: ViewId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "dashboard", label: "Dashboard" },
  { id: "roblox", label: "Roblox Studio" },
  { id: "blender", label: "Blender" },
  { id: "cloud", label: "Cloud" },
  { id: "billing", label: "Plans" },
  { id: "account", label: "Account" },
];

export type MeState =
  | { kind: "loading" }
  | { kind: "offline" }
  | { kind: "error"; status: number; message: string }
  | { kind: "ready"; me: Me };

interface AppCtx {
  meState: MeState;
  me: Me | null;
  refreshMe: () => Promise<Me | null>;
  view: ViewId;
  navigate: (v: ViewId) => void;
  chats: Record<string, ChatSession>;
  activeChat: Partial<Record<Workspace, string>>;
  upsertChat: (c: ChatSession) => void;
  newChat: (ws: Workspace, model: ModelId) => string;
  openChat: (id: string) => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}

let chatSeq = 0;
export const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(++chatSeq).toString(36)}`;

function initialView(): ViewId {
  const v = new URLSearchParams(window.location.search).get("view");
  return NAV.some((n) => n.id === v) ? (v as ViewId) : "home";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [meState, setMeState] = useState<MeState>({ kind: "loading" });
  const [view, setView] = useState<ViewId>(initialView);
  const [chats, setChats] = useState<Record<string, ChatSession>>({});
  const [activeChat, setActiveChat] = useState<Partial<Record<Workspace, string>>>({});

  const refreshMe = useCallback(async () => {
    const r = await api<Me>("GET", "/api/space-studio/me");
    if (r.status === 0) {
      setMeState({ kind: "offline" });
      return null;
    }
    if (r.status === 200 && r.data) {
      setMeState({ kind: "ready", me: r.data });
      return r.data;
    }
    setMeState({ kind: "error", status: r.status, message: (r.data as { error?: string } | null)?.error ?? `Could not load your account (HTTP ${r.status}).` });
    return null;
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const upsertChat = useCallback((c: ChatSession) => setChats((m) => ({ ...m, [c.id]: c })), []);
  const newChat = useCallback((ws: Workspace, model: ModelId) => {
    const id = uid("chat");
    setChats((m) => ({ ...m, [id]: { id, workspace: ws, title: "New chat", createdAt: Date.now(), model, messages: [] } }));
    setActiveChat((a) => ({ ...a, [ws]: id }));
    return id;
  }, []);
  const openChat = useCallback(
    (id: string) => {
      const c = chats[id];
      if (!c) return;
      setActiveChat((a) => ({ ...a, [c.workspace]: id }));
      if (c.workspace === "roblox" || c.workspace === "blender") setView(c.workspace);
    },
    [chats],
  );

  const signIn = useCallback(async () => {
    if (!bridge) return;
    await bridge.signIn();
    await refreshMe();
  }, [refreshMe]);
  const signOut = useCallback(async () => {
    if (!bridge) return;
    await bridge.signOut();
    await refreshMe();
  }, [refreshMe]);

  const value = useMemo<AppCtx>(
    () => ({
      meState,
      me: meState.kind === "ready" ? meState.me : null,
      refreshMe,
      view,
      navigate: setView,
      chats,
      activeChat,
      upsertChat,
      newChat,
      openChat,
      signIn,
      signOut,
    }),
    [meState, refreshMe, view, chats, activeChat, upsertChat, newChat, openChat, signIn, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function formatDate(s: string | number | null | undefined): string {
  if (s == null || s === "") return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatDay(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { dateStyle: "long" });
}
