import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AccountGate } from "../ui/common";
import { RollingNumber } from "../ui/RollingNumber";
import { Chat } from "../chat/Chat";
import { Composer } from "../chat/Composer";
import { remainingCredits, useChatEngine, useLiveCredits } from "../chat/engine";
import { timeUntil } from "../chat/ErrorCard";
import { PLAN_LABEL, useChatPrefs } from "../chat/prefs";
import { useApp } from "../lib/app";
import { bridge, connected } from "../lib/bridge";
import { load, save } from "../lib/storage";
import type { ChatSession, Workspace } from "../lib/types";

const WORKSPACES: { id: Workspace; label: string }[] = [
  { id: "roblox", label: "Roblox" },
  { id: "blender", label: "Blender" },
  { id: "general", label: "General" },
];
const WS_NAME: Record<Workspace, string> = { roblox: "Roblox Studio", blender: "Blender", general: "General" };

const SUGGESTIONS: Record<Workspace, string[]> = {
  roblox: ["Secure my RemoteEvents", "Add a daily reward chest the server validates", "Find what slows my server"],
  blender: ["Low-poly crystal for my map", "Batch-export my selection as FBX", "Geometry nodes rock scatter"],
  general: ["Plan my game's first week of content", "Explain server authority simply", "Name ideas for a space tycoon"],
};
const PLACEHOLDER: Record<Workspace, string> = {
  roblox: "Add a daily reward chest the server validates, with a 24-hour cooldown…",
  blender: "A low-poly crystal cluster with a soft emissive core, ready for Roblox…",
  general: "Ask anything about making games…",
};

function greeting(d = new Date()): string {
  const h = d.getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function ago(t: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const lastAt = (c: ChatSession) => c.messages[c.messages.length - 1]?.at ?? c.createdAt;

/** Roblox / Blender / General, as a radio group whose white thumb springs across with a horizontal motion blur. */
function WorkspaceSwitch({ value, onChange }: { value: Workspace; onChange: (w: Workspace) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);
  const [moving, setMoving] = useState(false);
  const prevX = useRef<number | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current?.querySelector<HTMLElement>(`[data-ws="${value}"]`);
      if (!el) return;
      if (prevX.current != null && prevX.current !== el.offsetLeft) setMoving(true);
      prevX.current = el.offsetLeft;
      setInd({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => undefined);
  }, [value]);
  useEffect(() => {
    if (!moving) return;
    const t = window.setTimeout(() => setMoving(false), 420);
    return () => window.clearTimeout(t);
  }, [moving, value]);
  const onKey = (e: KeyboardEvent) => {
    const i = WORKSPACES.findIndex((w) => w.id === value);
    const n = e.key === "ArrowRight" ? (i + 1) % 3 : e.key === "ArrowLeft" ? (i + 2) % 3 : -1;
    if (n < 0) return;
    e.preventDefault();
    onChange(WORKSPACES[n]!.id);
    ref.current?.querySelector<HTMLElement>(`[data-ws="${WORKSPACES[n]!.id}"]`)?.focus();
  };
  return (
    <div className="wsw" role="radiogroup" aria-label="Workspace" ref={ref} onKeyDown={onKey}>
      {ind && <span className="wsw__thumb" data-moving={moving || undefined} style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} aria-hidden="true" />}
      {WORKSPACES.map((w) => (
        <button key={w.id} type="button" role="radio" aria-checked={value === w.id} tabIndex={value === w.id ? 0 : -1} data-ws={w.id} className="wsw__opt" onClick={() => onChange(w.id)}>
          {w.label}
        </button>
      ))}
    </div>
  );
}

function useDetect() {
  const [d, setD] = useState<SpaceDetectResult | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const run = async () => {
    if (!bridge) return;
    setState("loading");
    try { setD(await bridge.detect()); setState("idle"); } catch { setState("error"); }
  };
  useEffect(() => { void run(); }, []);
  return { d, state, run };
}

export function Home() {
  const { me, chats, navigate, openChat, newChat } = useApp();
  const [ws, setWsState] = useState<Workspace>(() => {
    const v = load<string>("homeWorkspace", "roblox");
    return v === "blender" || v === "general" ? v : "roblox";
  });
  const setWs = (w: Workspace) => { setWsState(w); save("homeWorkspace", w); };
  const prefs = useChatPrefs(ws, me?.models);
  const { send } = useChatEngine();
  const live = useLiveCredits();
  const [draft, setDraft] = useState("");
  const [generalOpen, setGeneralOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const detect = useDetect();
  const signedIn = !!me?.signedIn;
  const name = me?.profile?.displayName?.trim() || me?.email?.split("@")[0] || "";
  const robloxLocked = signedIn && !!me?.robloxRequired && !me?.robloxLinked;
  const recent = useMemo(() => Object.values(chats).filter((c) => c.messages.length > 0).sort((a, b) => lastAt(b) - lastAt(a)).slice(0, 5), [chats]);

  useEffect(() => { if (ws !== "roblox") setBlocked(false); }, [ws]);

  const onSend = (from: DOMRect) => {
    if (ws === "roblox" && robloxLocked) { setBlocked(true); return false; }
    const r = send({ workspace: ws, text: draft, model: prefs.model, effort: prefs.effort, from });
    if (!r) return false;
    setDraft("");
    if (ws === "general") setGeneralOpen(true);
    else navigate(ws);
    return true;
  };

  const open = (c: ChatSession) => {
    openChat(c.id);
    if (c.workspace === "general") setGeneralOpen(true);
  };

  if (generalOpen) {
    return (
      <div className="ws home-chat" data-kind="general">
        <header className="ws__head">
          <div className="ws__id">
            <button type="button" className="btn btn--ghost btn--sm ws__back" onClick={() => setGeneralOpen(false)}>Home</button>
            <h1 className="ws__title" tabIndex={-1}>General</h1>
          </div>
          <div className="ws__tools">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => newChat("general", prefs.model)}>New chat</button>
          </div>
        </header>
        <Chat
          workspace="general"
          placeholder="Ask anything about making games…"
          suggestions={SUGGESTIONS.general}
          intro={<div className="chat__hello"><h2 className="chat__lead rise">Ask anything.</h2><p className="chat__sub rise">Design, code, names, plans. Nothing here touches Studio or Blender.</p></div>}
        />
      </div>
    );
  }

  const credits = me?.credits ?? null;
  const left = remainingCredits(me, live);
  const resetIn = timeUntil(live?.resetsAt ?? credits?.resetsAt);

  return (
    <div className="home">
      <section className="home__hero" aria-labelledby="home-title">
        {signedIn && (
          <span className="hello rise">
            <span className="hello__plan">{me?.plan?.name ?? PLAN_LABEL[me?.plan?.id ?? "free"]}</span>
            {greeting()}{name ? `, ${name}` : ""}
          </span>
        )}
        <h1 id="home-title" className="home__title rise" tabIndex={-1} style={{ animationDelay: "70ms" }}>
          What are we <span className="grad-text">building?</span>
        </h1>
        <p className="home__sub rise" style={{ animationDelay: "140ms" }}>
          Describe a change to your game or an asset you need. You review every change before it reaches Studio or Blender.
        </p>
        <div className="home__gate"><AccountGate needSignIn={false} what="your account" /></div>

        <div className="home__prompt rise" data-tour="prompt" style={{ animationDelay: "210ms" }}>
          <Composer
            variant="hero"
            prefs={prefs}
            value={draft}
            onChange={(v) => { setDraft(v); setBlocked(false); }}
            onSend={onSend}
            inputRef={inputRef}
            disabled={!connected || !signedIn}
            label={`Describe the task for ${WS_NAME[ws]}`}
            placeholder={!connected ? "Not connected. Open this in the Space Studio app" : !signedIn ? "Sign in to start" : PLACEHOLDER[ws]}
            sendLabel="Start"
            pickerPlacement="down"
            extra={<WorkspaceSwitch value={ws} onChange={setWs} />}
          />
        </div>
        {blocked && (
          <div className="home__blocked rise" role="alert">
            <span>The Roblox workspace needs a linked Roblox account.</span>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => navigate("account")}>Link Roblox</button>
          </div>
        )}
        <div className="chips home__chips" role="group" aria-label="Quick starts">
          {SUGGESTIONS[ws].map((s, i) => (
            <button key={`${ws}-${s}`} type="button" className="chip-btn rise" style={{ animationDelay: `${280 + i * 60}ms` }} onClick={() => { setDraft(s); inputRef.current?.focus(); }}>
              {s}
            </button>
          ))}
        </div>
      </section>

      <section className="home__cards" aria-label="Overview">
        <div className="hcard glass rise" style={{ animationDelay: "380ms" }}>
          <h2 className="hcard__kicker">Recent chats</h2>
          {recent.length === 0 ? (
            <p className="hcard__empty">Your conversations will show up here.</p>
          ) : (
            <ul className="recent">
              {recent.map((c) => (
                <li key={c.id}>
                  <button type="button" className="recent__item" onClick={() => open(c)}>
                    <span className="recent__title">{c.title}</span>
                    <span className="recent__meta">{WS_NAME[c.workspace]} · {ago(lastAt(c))}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="hcard glass rise" style={{ animationDelay: "440ms" }}>
          <h2 className="hcard__kicker">Credits</h2>
          {!credits ? (
            <p className="hcard__empty">{signedIn ? "Credit details are not available from the server yet." : "Sign in to see your credits."}</p>
          ) : credits.limitedBy === "custom" ? (
            <p className="hcard__big-note">Your plan has a custom allowance.</p>
          ) : (
            <>
              <p className="hcard__big"><RollingNumber value={left ?? credits.remaining} /><span>left</span></p>
              <p className="hcard__note">{resetIn ? `${PLAN_LABEL[credits.plan] ?? "Your"} window resets in ${resetIn}` : "No reset scheduled"}</p>
              {credits.windows.slice(0, 2).map((w) => {
                const pct = w.limit > 0 ? Math.min(100, (w.used / w.limit) * 100) : 0;
                return (
                  <div key={w.label} className="meter" role="img" aria-label={`${w.label}: ${w.used.toLocaleString("en-US")} of ${w.limit.toLocaleString("en-US")} used`}>
                    <span className="meter__row"><span>{w.label}</span><span>{w.used.toLocaleString("en-US")} / {w.limit.toLocaleString("en-US")}</span></span>
                    <span className="meter__track"><i style={{ width: `${100 - pct}%` }} /></span>
                  </div>
                );
              })}
              <button type="button" className="hcard__link" onClick={() => navigate("billing")}>Plans and credits</button>
            </>
          )}
        </div>

        <div className="hcard glass rise" style={{ animationDelay: "500ms" }}>
          <h2 className="hcard__kicker">This computer</h2>
          {!connected ? (
            <p className="hcard__empty">Install detection runs inside the Space Studio app.</p>
          ) : detect.state === "error" ? (
            <p className="hcard__empty">Detection failed. <button type="button" className="hcard__link" onClick={() => void detect.run()}>Scan again</button></p>
          ) : !detect.d ? (
            <p className="hcard__empty">Looking for Roblox Studio and Blender…</p>
          ) : (
            <ul className="installs">
              <li data-found={detect.d.robloxStudio.length > 0 || undefined} title={detect.d.robloxStudio[0]?.path}>
                <i aria-hidden="true" /><span>Roblox Studio</span><b>{detect.d.robloxStudio.length ? "Installed" : "Not found"}</b>
              </li>
              <li data-found={detect.d.blender.length > 0 || undefined} title={detect.d.blender[0]?.path}>
                <i aria-hidden="true" /><span>Blender{detect.d.blender[0]?.version ? ` ${detect.d.blender[0].version}` : ""}</span><b>{detect.d.blender.length ? "Installed" : "Not found"}</b>
              </li>
              <li>
                <button type="button" className="hcard__link" disabled={detect.state === "loading"} onClick={() => void detect.run()}>
                  {detect.state === "loading" ? "Scanning…" : "Scan again"}
                </button>
              </li>
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
