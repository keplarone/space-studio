import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "../ui";
import { Notice } from "../ui/common";
import { useApp, uid } from "../lib/app";
import { api, connected, errorCode, errorMessage, openExternal, PLANS_URL } from "../lib/bridge";
import { load, save } from "../lib/storage";
import type { ChatMessage, ChatResponse, ChatSession, ModelId, Workspace } from "../lib/types";
import { ModelSelector } from "./ModelSelector";
import { MessageBody } from "./Message";
import { MODELS } from "../../core/models";
import type { ModelView } from "../lib/types";

/** Static registry, used only to describe the models when the server's list is unavailable. Never marked available. */
const REGISTRY_MODELS: ModelView[] = MODELS.map((m) => ({
  id: m.id, name: m.name, tagline: m.tagline, strengths: [...m.strengths], capabilities: [...m.capabilities], speed: m.speed,
  creditNote: m.creditNote, available: false,
  customization: m.customization, minPlan: m.minPlan === "team" || m.minPlan === "enterprise" ? "pro" : m.minPlan,
}));

type ChatError = { message: string; code: string | null; status: number } | null;

export function Chat({ workspace, compact = false, placeholder }: { workspace: Workspace; compact?: boolean; placeholder?: string }) {
  const { me, chats, activeChat, upsertChat, newChat, signIn, refreshMe } = useApp();
  const fromServer = !!me?.models?.length;
  const models = useMemo(() => (me?.models?.length ? me.models : REGISTRY_MODELS), [me]);
  const chat: ChatSession | undefined = activeChat[workspace] ? chats[activeChat[workspace]!] : undefined;

  const firstAvailable = models.find((m) => m.available)?.id ?? models[0]?.id ?? "orbit";
  const [model, setModelState] = useState<ModelId>(() => load<ModelId>(`model:${workspace}`, firstAvailable));
  useEffect(() => {
    // If the stored model is not offered or not available, fall back to the first available one.
    if (models.length && !models.some((m) => m.id === model && m.available)) setModelState(firstAvailable);
  }, [models, model, firstAvailable]);
  useEffect(() => {
    if (chat) setModelState(chat.model);
  }, [chat?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setModel = (m: ModelId) => {
    setModelState(m);
    save(`model:${workspace}`, m);
    if (chat) upsertChat({ ...chat, model: m });
  };

  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ChatError>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat?.messages.length, pending]);

  const send = async (text: string, useModel: ModelId = model, base?: ChatSession) => {
    const content = text.trim();
    if (!content || pending) return;
    setError(null);
    let session = base ?? chat;
    if (!session) {
      const id = newChat(workspace, useModel);
      session = { id, workspace, title: "New chat", createdAt: Date.now(), model: useModel, messages: [] };
    }
    const userMsg: ChatMessage = { id: uid("m"), role: "user", content, at: Date.now() };
    const messages = [...session.messages, userMsg];
    const title = session.messages.length === 0 ? content.slice(0, 60) : session.title;
    const s1: ChatSession = { ...session, title, model: useModel, messages };
    upsertChat(s1);
    setDraft("");
    setPending(true);
    const r = await api<ChatResponse>("POST", "/api/space-studio/chat", {
      model: useModel,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      workspace,
    });
    setPending(false);
    if (r.status === 200 && r.data) {
      const d = r.data;
      const reply: ChatMessage = { id: uid("m"), role: "assistant", content: d.text, served: d.served, requested: d.requested, usage: d.usage, escalation: d.escalation, at: Date.now() };
      upsertChat({ ...s1, messages: [...messages, reply] });
    } else {
      const code = errorCode(r.data);
      setError({ status: r.status, code, message: errorMessage(r.status, r.data, "The assistant could not reply.") });
      if (code === "roblox_link_required") void refreshMe();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(draft);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(draft);
    }
  };

  const retryWith = (to: ModelId) => {
    if (!chat) return;
    // Re-ask the last user question with the model the user accepted.
    const lastUserIdx = chat.messages.map((m) => m.role).lastIndexOf("user");
    if (lastUserIdx < 0) return;
    const q = chat.messages[lastUserIdx].content;
    setModel(to);
    void send(q, to, { ...chat, model: to, messages: chat.messages.slice(0, lastUserIdx) });
  };

  const modelName = (id: ModelId | null) => models.find((m) => m.id === id)?.name ?? id ?? "";
  const signedOut = me && !me.signedIn;

  return (
    <div className="chat" data-compact={compact ? "true" : "false"}>
      <div className="chat__list" ref={listRef} role="log" aria-live="polite" aria-label="Conversation">
        {!chat || chat.messages.length === 0 ? (
          <p className="chat__empty">{placeholder ?? "Ask about your project."}</p>
        ) : (
          chat.messages.map((m) => (
            <article key={m.id} className="msg" data-role={m.role}>
              <header className="msg__head">
                <span className="msg__who">{m.role === "user" ? "You" : m.served?.name ?? "Assistant"}</span>
                {m.served && m.requested && m.served.id !== m.requested && (
                  <span className="msg__requested">(requested {modelName(m.requested)})</span>
                )}
              </header>
              <MessageBody text={m.content} />
              {m.usage && (
                <footer className="msg__meta" aria-label="Usage for this reply">
                  <span title="Model that served this reply">{m.served?.name}</span>
                  <span>{m.usage.promptTokens.toLocaleString()} in / {m.usage.completionTokens.toLocaleString()} out tokens</span>
                  <span>{m.usage.units.toLocaleString()} credits</span>
                  <span>{(m.usage.latencyMs / 1000).toFixed(1)}s</span>
                </footer>
              )}
              {m.escalation?.suggested && m.escalation.to && !dismissed.has(m.id) && m.id === chat.messages[chat.messages.length - 1]?.id && (
                <div className="escalation" role="group" aria-label="Model suggestion">
                  <span>
                    {modelName(m.escalation.to)} may handle this better{m.escalation.reason ? `: ${m.escalation.reason}` : ""}
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => retryWith(m.escalation!.to!)}
                    disabled={!models.find((x) => x.id === m.escalation!.to)?.available}>
                    Retry with {modelName(m.escalation.to)}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDismissed((d) => new Set(d).add(m.id))}>Dismiss</Button>
                </div>
              )}
            </article>
          ))
        )}
        {pending && (
          <div className="msg msg--pending" data-role="assistant" role="status">
            <span className="typing" aria-hidden="true"><i /><i /><i /></span>
            <span className="sr-only">Waiting for reply</span>
          </div>
        )}
      </div>

      {error && (
        <div className="chat__error">
          <Notice tone="error">
            {error.message}
            {error.status === 401 && <> <Button size="sm" variant="secondary" onClick={() => void signIn()}>Sign in</Button></>}
            {error.status === 402 && <> <Button size="sm" variant="secondary" onClick={() => void openExternal(PLANS_URL)}>See plans</Button></>}
          </Notice>
        </div>
      )}

      <form className="composer" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor={`composer-${workspace}-${compact ? "c" : "m"}`}>Message</label>
        <textarea
          ref={inputRef}
          id={`composer-${workspace}-${compact ? "c" : "m"}`}
          className="composer__input"
          rows={compact ? 2 : 3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder={!connected ? "Not connected. Open this in the Space Studio app" : signedOut ? "Sign in to chat" : "Message (Enter to send, Shift+Enter for a new line)"}
          disabled={!connected || !!signedOut}
        />
        <div className="composer__bar">
          {models.length > 0 ? <ModelSelector models={models} value={model} onChange={setModel} offline={!fromServer} /> : <span className="muted">No models loaded</span>}
          <span className="composer__spacer" />
          {chat && chat.messages.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => newChat(workspace, model)}>New chat</Button>
          )}
          <Button type="submit" variant="primary" status={pending ? "loading" : "idle"} disabled={!draft.trim() || !connected || !!signedOut}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
