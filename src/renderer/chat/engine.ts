import { useCallback, useSyncExternalStore } from "react";
import { useApp, uid } from "../lib/app";
import { api, errorCode, errorMessage } from "../lib/bridge";
import { fx } from "../lib/fx";
import type { ChatMessage, ChatResponse, ChatSession, CreditBalance, Effort, ModelId, Workspace } from "../lib/types";

/** A chat message plus what this client also records about the answer (effort and passes). */
export type Msg = ChatMessage & { effort?: Effort; passes?: number };

export interface ChatError {
  status: number;
  code: string | null;
  message: string;
  /** The rest of the error body (minPlan, resetsAt...). */
  data: Record<string, unknown>;
  model: ModelId;
  effort: Effort;
}

export interface Pending {
  model: ModelId;
  effort: Effort;
  since: number;
}

interface ChatRuntime {
  pending: Pending | null;
  error: ChatError | null;
}

export type LiveCredits = NonNullable<ChatResponse["credits"]>;

/**
 * In-flight state lives here, keyed by chat id, not in a component: a prompt sent from Home keeps its thinking indicator and
 * its error when the workspace view takes over the conversation.
 */
const runtime = new Map<string, ChatRuntime>();
let liveCredits: LiveCredits | null = null;
const listeners = new Set<() => void>();
const emit = () => { listeners.forEach((l) => l()); };
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const EMPTY: ChatRuntime = { pending: null, error: null };

function patch(id: string, p: Partial<ChatRuntime>) {
  runtime.set(id, { ...(runtime.get(id) ?? EMPTY), ...p });
  emit();
}

export function clearError(id: string | undefined) {
  if (id && runtime.get(id)?.error) patch(id, { error: null });
}

/** Where each just-sent message should fly in from (the composer's rect at the moment of sending). */
export const flights = new Map<string, DOMRect>();

export function useChatRuntime(id: string | undefined): ChatRuntime {
  return useSyncExternalStore(subscribe, () => (id ? runtime.get(id) ?? EMPTY : EMPTY));
}

/** The balance reported by the last answer, until the profile refresh catches up with it. */
export function useLiveCredits(): LiveCredits | null {
  return useSyncExternalStore(subscribe, () => liveCredits);
}

/** The credits to show: the freshest of the last answer and the profile. Null when there is no number to show. */
export function remainingCredits(me: { credits: CreditBalance | null } | null, live: LiveCredits | null): number | null {
  if (live && live.limitedBy !== "custom") return live.remaining;
  const c = me?.credits;
  return c && c.limitedBy !== "custom" ? c.remaining : null;
}

export interface SendOptions {
  workspace: Workspace;
  text: string;
  model: ModelId;
  effort: Effort;
  /** The conversation to continue. Omit to start a new chat. */
  chat?: ChatSession;
  /** The composer's rect, so the message can fly up out of it. */
  from?: DOMRect | null;
}

export function useChatEngine() {
  const { newChat, upsertChat, refreshMe } = useApp();

  const send = useCallback(
    (o: SendOptions): { chatId: string; userId: string } | null => {
      const content = o.text.trim();
      if (!content) return null;
      if (o.chat && runtime.get(o.chat.id)?.pending) return null;
      let session = o.chat;
      if (!session) {
        const id = newChat(o.workspace, o.model);
        session = { id, workspace: o.workspace, title: "New chat", createdAt: Date.now(), model: o.model, messages: [] };
      }
      const userMsg: Msg = { id: uid("m"), role: "user", content, at: Date.now() };
      const messages: Msg[] = [...session.messages, userMsg];
      const title = session.messages.length === 0 ? content.replace(/\s+/g, " ").slice(0, 60) : session.title;
      const s1: ChatSession = { ...session, title, model: o.model, messages };
      if (o.from) flights.set(userMsg.id, o.from);
      upsertChat(s1);
      patch(s1.id, { pending: { model: o.model, effort: o.effort, since: Date.now() }, error: null });
      fx.prompt();

      void (async () => {
        const r = await api<ChatResponse>("POST", "/api/space-studio/chat", {
          model: o.model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          workspace: o.workspace,
          effort: o.effort,
        });
        if (r.status === 200 && r.data && typeof r.data.text === "string") {
          const d = r.data;
          const reply: Msg = {
            id: uid("m"), role: "assistant", content: d.text, served: d.served, requested: d.requested, usage: d.usage,
            escalation: d.escalation, effort: d.effort ?? o.effort, passes: d.passes, at: Date.now(),
          };
          upsertChat({ ...s1, messages: [...messages, reply] });
          if (d.credits) liveCredits = d.credits;
          patch(s1.id, { pending: null, error: null });
          const fresh = await refreshMe();
          if (fresh && liveCredits === d.credits) { liveCredits = null; emit(); }
          return;
        }
        const code = errorCode(r.data);
        const data = (r.data && typeof r.data === "object" ? r.data : {}) as Record<string, unknown>;
        patch(s1.id, {
          pending: null,
          error: { status: r.status, code, data, model: o.model, effort: o.effort, message: errorMessage(r.status, r.data, "The assistant could not reply.") },
        });
        if (r.status === 402 || r.status === 403) void refreshMe();
      })();
      return { chatId: s1.id, userId: userMsg.id };
    },
    [newChat, upsertChat, refreshMe],
  );

  /** Ask the last question again, optionally with another model or effort. The failed or unwanted answer is dropped. */
  const retry = useCallback(
    (chat: ChatSession, with_: { model: ModelId; effort: Effort }) => {
      const idx = chat.messages.map((m) => m.role).lastIndexOf("user");
      if (idx < 0) return null;
      const q = chat.messages[idx]!.content;
      return send({ workspace: chat.workspace, text: q, ...with_, chat: { ...chat, model: with_.model, messages: chat.messages.slice(0, idx) } });
    },
    [send],
  );

  return { send, retry };
}
