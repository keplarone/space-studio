import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useApp } from "../lib/app";
import { connected, copyText } from "../lib/bridge";
import { useReducedMotion } from "../lib/motion";
import type { ChatSession, ModelId, ModelView, Workspace } from "../lib/types";
import { Composer } from "./Composer";
import { clearError, flights, remainingCredits, useChatEngine, useChatRuntime, useLiveCredits, type Msg } from "./engine";
import { ErrorCard } from "./ErrorCard";
import { TroubleshootCard } from "./TroubleshootCard";
import { useLocalEngine } from "../lib/localEngine";
import { TRACKS } from "../../core/specialists";
import { MessageBody } from "./Message";
import { effortLabel, PLAN_LABEL, useChatPrefs } from "./prefs";
import { Thinking } from "./Thinking";

/** Fly a just-sent message from the composer to its place in the conversation, with a vertical motion blur. */
function fly(el: HTMLElement, from: DOMRect) {
  const to = el.getBoundingClientRect();
  const dx = from.right - 28 - to.right;
  const dy = from.top + 14 - to.top;
  el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(0.94)`, opacity: 0, filter: "url(#mb-y)" },
      { opacity: 1, offset: 0.18 },
      { transform: "translate(0, -6px) scale(1.01)", filter: "url(#mb-y)", offset: 0.62 },
      { transform: "none", opacity: 1, filter: "none" },
    ],
    { duration: 720, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
  );
}

function bestOther(models: ModelView[], not: ModelId): ModelView | undefined {
  return [...models].reverse().find((m) => m.available && m.id !== not);
}

function CopyAnswer({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className="msg__copy" data-done={copied || undefined}
      onClick={async () => { if (await copyText(text)) { setCopied(true); window.setTimeout(() => setCopied(false), 1600); } }}>
      {copied ? "Copied" : "Copy answer"}
    </button>
  );
}

function AnswerMeta({ m }: { m: Msg }) {
  const credits = m.usage?.credits ?? m.usage?.units;
  const passes = m.passes ?? (m.effort === "ultracode" ? 2 : undefined);
  if (m.local)
    return (
      <footer className="msg__meta" aria-label="About this answer">
        <span className="msg__model">{m.local.model}</span>
        <span className="msg__local">Local · free</span>
        <span>{TRACKS[m.local.track].name}</span>
        {m.usage && <span>{(m.usage.latencyMs / 1000).toFixed(1)}s</span>}
        <CopyAnswer text={m.content} />
      </footer>
    );
  return (
    <footer className="msg__meta" aria-label="About this answer">
      {m.served && <span className="msg__model">{m.served.name}</span>}
      {m.effort && <span data-ultra={m.effort === "ultracode" || undefined}>{m.effort === "ultracode" ? "Ultracode" : `${effortLabel(m.effort)} effort`}</span>}
      {passes != null && passes > 1 && <span>{passes} passes</span>}
      {m.track && TRACKS[m.track] && <span>{TRACKS[m.track].name}</span>}
      {credits != null && <span>{credits.toLocaleString("en-US")} {credits === 1 ? "credit" : "credits"}</span>}
      {m.usage && <span title={`${m.usage.promptTokens.toLocaleString("en-US")} tokens in, ${m.usage.completionTokens.toLocaleString("en-US")} out`}>{(m.usage.latencyMs / 1000).toFixed(1)}s</span>}
      <CopyAnswer text={m.content} />
    </footer>
  );
}

export interface ChatProps {
  workspace: Workspace;
  /** Shown when the conversation is empty. */
  intro?: ReactNode;
  /** One-click prompts for an empty conversation. */
  suggestions?: string[];
  placeholder?: string;
}

/** A conversation and its composer. In-flight state comes from the engine, so it survives moving between views. */
export function Chat({ workspace, intro, suggestions = [], placeholder }: ChatProps) {
  const { me, chats, activeChat, navigate } = useApp();
  const chat: ChatSession | undefined = activeChat[workspace] ? chats[activeChat[workspace]!] : undefined;
  const prefs = useChatPrefs(workspace, me?.models);
  const { setMode, mode, available: localOk } = useLocalEngine();
  const localMode = mode === "local" && localOk;
  const setPickerOpen = (open: boolean) => { if (open) window.dispatchEvent(new CustomEvent("space:open-picker")); };
  const { send, retry } = useChatEngine();
  const rt = useChatRuntime(chat?.id);
  const live = useLiveCredits();
  const reduced = useReducedMotion();
  const [draft, setDraft] = useState("");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [mountedAt] = useState(() => Date.now());
  const [announce, setAnnounce] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const signedOut = !!me && !me.signedIn;
  const messages = (chat?.messages ?? []) as Msg[];
  const last = messages[messages.length - 1];
  const nameOf = (id: ModelId | null | undefined) => prefs.models.find((m) => m.id === id)?.name ?? id ?? "";

  // New messages: scroll to the end, then fly any just-sent message in from the composer.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: reduced || !last || last.role === "user" ? "auto" : "smooth" });
    if (reduced) { flights.clear(); return; }
    for (const [id, rect] of flights) {
      const el = list.querySelector<HTMLElement>(`[data-mid="${CSS.escape(id)}"]`);
      if (el) { fly(el, rect); flights.delete(id); }
    }
  }, [messages.length, chat?.id, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  // The thinking indicator and error cards appear at the end: bring them into view.
  useEffect(() => {
    const list = listRef.current;
    if (list && (rt.pending || rt.error)) list.scrollTo({ top: list.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [rt.pending, rt.error, reduced]);

  // Screen readers hear each new answer (and each failure) once.
  useEffect(() => {
    if (last?.role === "assistant" && last.at >= mountedAt) setAnnounce(`${last.served?.name ?? "Answer"}: ${last.content.slice(0, 280)}`);
  }, [last?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (rt.error) setAnnounce(rt.error.message);
  }, [rt.error]);

  const onSend = (from: DOMRect) => {
    const r = send({ workspace, text: draft, model: prefs.model, effort: prefs.effort, chat, from });
    if (r) setDraft("");
    return !!r;
  };

  const retryWith = (model: ModelId, effort = prefs.effort) => {
    if (!chat) return;
    if (model !== prefs.model) prefs.setModel(model);
    if (effort !== prefs.effort) prefs.setEffort(effort);
    retry(chat, { model, effort });
  };

  const credits = remainingCredits(me, live);
  const resetAt = live?.resetsAt ?? me?.credits?.resetsAt ?? null;

  return (
    <div className="chat">
      <div className="chat__scroll" ref={listRef}>
        <div className="chat__list" role="log" aria-label="Conversation">
          {messages.length === 0 && !rt.pending ? (
            <div className="chat__intro">
              {intro}
              {suggestions.length > 0 && (
                <div className="chips" role="group" aria-label="Suggestions">
                  {suggestions.map((s, i) => (
                    <button key={s} type="button" className="chip-btn rise" style={{ animationDelay: `${120 + i * 60}ms` }} onClick={() => { setDraft(s); inputRef.current?.focus(); }}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            messages.map((m) =>
              m.role === "user" ? (
                <article key={m.id} className="msg" data-role="user" data-mid={m.id} aria-label="You said">
                  <p className="msg__text">{m.content}</p>
                </article>
              ) : (
                <article key={m.id} className="msg" data-role="assistant" data-mid={m.id} data-fresh={m.at >= mountedAt || undefined} aria-label={`${m.local?.model ?? m.served?.name ?? "Assistant"} answered`}>
                  <header className="msg__head">
                    <span className="msg__who" data-ultra={m.effort === "ultracode" || undefined}>{m.local?.model ?? m.served?.name ?? "Assistant"}</span>
                    {m.served && m.requested && m.served.id !== m.requested && <span className="msg__requested">answered for {nameOf(m.requested)}</span>}
                  </header>
                  <MessageBody text={m.content} reveal={m.at >= mountedAt && !reduced} />
                  <AnswerMeta m={m} />
                  {m.escalation?.suggested && m.escalation.to && !dismissed.has(m.id) && m.id === last?.id && !rt.pending && (() => {
                    const to = prefs.models.find((x) => x.id === m.escalation!.to);
                    return (
                      <div className="escalation" role="group" aria-label="Model suggestion">
                        <span>
                          <strong>{nameOf(m.escalation.to)}</strong> may handle this better{m.escalation.reason ? `: ${m.escalation.reason}` : "."}
                        </span>
                        {to?.available ? (
                          <button type="button" className="btn btn--secondary btn--sm" onClick={() => retryWith(to.id)}>Ask {to.name}</button>
                        ) : (
                          <button type="button" className="btn btn--secondary btn--sm" onClick={() => navigate("billing")}>
                            {to ? `Unlock with ${PLAN_LABEL[to.minPlan] ?? to.minPlan}` : "See plans"}
                          </button>
                        )}
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDismissed((d) => new Set(d).add(m.id))}>Dismiss</button>
                      </div>
                    );
                  })()}
                </article>
              ),
            )
          )}
          {rt.pending && <Thinking modelName={rt.pending.localLabel ?? nameOf(rt.pending.model)} effort={rt.pending.localLabel ? undefined : rt.pending.effort} since={rt.pending.since} />}
          {rt.error?.troubleshoot && chat && !rt.pending && (
            <TroubleshootCard
              t={rt.error.troubleshoot}
              onRetry={() => retryWith(rt.error!.model, rt.error!.effort)}
              onUseCloud={() => { setMode("cloud"); clearError(chat.id); }}
              onOpenSettings={() => setPickerOpen(true)}
              onDismiss={() => clearError(chat.id)}
            />
          )}
          {rt.error && !rt.error.troubleshoot && chat && !rt.pending && (
            <ErrorCard
              error={rt.error}
              models={prefs.models}
              resetsAt={resetAt}
              onRetry={(model, effort) => retryWith(model ?? rt.error!.model, effort ?? rt.error!.effort)}
              onDismiss={() => clearError(chat.id)}
              fallback={bestOther(prefs.models, rt.error.model)}
            />
          )}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{announce}</p>

      <div className="chat__dock">
        <Composer
          prefs={prefs}
          value={draft}
          onChange={setDraft}
          onSend={onSend}
          busy={!!rt.pending}
          disabled={!connected || signedOut}
          inputRef={inputRef}
          placeholder={!connected ? "Not connected. Open this in the Space Studio app" : signedOut ? "Sign in to chat" : placeholder ?? "Ask for a change…"}
          credits={localMode ? null : credits}
          creditsTitle={resetAt ? `Credits left. The window resets ${new Date(resetAt).toLocaleString()}.` : "Credits left"}
        />
      </div>
    </div>
  );
}
