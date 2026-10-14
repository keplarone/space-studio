import { useEffect, useState } from "react";
import { Button } from "../ui";
import { AccountGate, Notice } from "../ui/common";
import { Chat } from "../chat/Chat";
import { useChatPrefs } from "../chat/prefs";
import { useApp } from "../lib/app";
import { bridge } from "../lib/bridge";

const COPY = {
  roblox: {
    title: "Roblox Studio",
    app: "Studio",
    lead: "What should we build in Studio?",
    sub: "Luau, game systems, UI and performance. You review every change before it reaches your place.",
    placeholder: "Ask for a change, or paste a script to review…",
    suggestions: ["Secure my RemoteEvents", "Add a daily reward the server validates", "Find what slows my server", "Save player data safely with DataStores"],
  },
  blender: {
    title: "Blender",
    app: "Blender",
    lead: "What should we make in Blender?",
    sub: "bpy scripts, geometry nodes, materials and export prep for Roblox.",
    placeholder: "Describe an asset or a script, or paste bpy to review…",
    suggestions: ["Low-poly crystal for my map", "Batch-export selected objects as FBX", "Geometry nodes scatter for rocks", "Clean up a mesh for Roblox"],
  },
} as const;

type Detect = { state: "checking" } | { state: "found"; detail: string } | { state: "missing" } | { state: "unknown" };

/** Is the app installed on this computer? Read from the bridge's install detection; nothing is assumed. */
function useInstalled(kind: "roblox" | "blender"): Detect {
  const [d, setD] = useState<Detect>(() => (bridge ? { state: "checking" } : { state: "unknown" }));
  useEffect(() => {
    if (!bridge) return;
    let live = true;
    bridge.detect().then(
      (r) => {
        if (!live) return;
        if (kind === "roblox") setD(r.robloxStudio.length ? { state: "found", detail: r.robloxStudio[0]!.path } : { state: "missing" });
        else setD(r.blender.length ? { state: "found", detail: `${r.blender[0]!.version ? `Blender ${r.blender[0]!.version} · ` : ""}${r.blender[0]!.path}` } : { state: "missing" });
      },
      () => live && setD({ state: "unknown" }),
    );
    return () => { live = false; };
  }, [kind]);
  return d;
}

export function Workspace({ kind }: { kind: "roblox" | "blender" }) {
  const { me, refreshMe, chats, activeChat, newChat, navigate } = useApp();
  const prefs = useChatPrefs(kind, me?.models);
  const [link, setLink] = useState<{ state: "idle" | "loading" | "error"; msg?: string }>({ state: "idle" });
  const c = COPY[kind];
  const installed = useInstalled(kind);
  const locked = kind === "roblox" && !!me?.signedIn && me.robloxRequired && !me.robloxLinked;
  const chat = activeChat[kind] ? chats[activeChat[kind]!] : undefined;
  const hasMessages = !!chat?.messages.length;

  const connectRoblox = async () => {
    if (!window.space) return;
    setLink({ state: "loading" });
    try {
      const r = await window.space.linkRoblox();
      const fresh = await refreshMe(); // UI only unlocks once the server says the account is linked.
      if (r.linked && fresh?.robloxLinked) setLink({ state: "idle" });
      else setLink({ state: "error", msg: r.error ? `Roblox linking did not complete: ${r.error}` : "Roblox linking did not complete." });
    } catch {
      setLink({ state: "error", msg: "Roblox linking did not complete." });
    }
  };

  const status =
    installed.state === "found" ? `${c.app} found` : installed.state === "missing" ? `${c.app} not found` : installed.state === "checking" ? "Checking this computer" : null;

  return (
    <div className="ws" data-kind={kind}>
      <header className="ws__head">
        <div className="ws__id">
          <h1 className="ws__title" tabIndex={-1}>{c.title}</h1>
          {hasMessages && <span className="ws__chat" title={chat!.title}>{chat!.title}</span>}
        </div>
        <div className="ws__tools">
          {status && (
            <span className="ws__status" data-state={installed.state} title={installed.state === "found" ? installed.detail : installed.state === "missing" ? `Install ${c.title} on this computer to apply changes there.` : undefined}>
              <i aria-hidden="true" />{status}
            </span>
          )}
          {kind === "roblox" && me?.signedIn && me.robloxLinked && <span className="ws__status" data-state="found"><i aria-hidden="true" />Roblox linked</span>}
          {me?.signedIn && !locked && (
            <button type="button" className="btn btn--ghost btn--sm ws__new" disabled={!hasMessages} onClick={() => newChat(kind, prefs.model)}>
              New chat
            </button>
          )}
        </div>
      </header>

      <div className="ws__gate"><AccountGate what={`the ${c.title} workspace`} /></div>

      {me?.signedIn &&
        (locked ? (
          <section className="ws__locked glass rise" aria-labelledby={`${kind}-lock`}>
            <h2 id={`${kind}-lock`} className="ws__locked-title">Link Roblox to use this workspace</h2>
            <p className="muted">The Roblox Studio workspace answers once your Roblox account is linked to Space Studio.</p>
            {!me.providers.roblox && <Notice tone="warn">Roblox sign-in is not configured on the server yet, so linking is not possible right now.</Notice>}
            {link.state === "error" && <Notice tone="error">{link.msg}</Notice>}
            <div className="row">
              {me.providers.roblox && (
                <Button variant="primary" status={link.state === "loading" ? "loading" : "idle"} onClick={() => void connectRoblox()}>
                  {link.state === "error" ? "Try again" : "Link Roblox"}
                </Button>
              )}
              <Button variant="ghost" onClick={() => navigate("account")}>Open Account</Button>
            </div>
          </section>
        ) : (
          <Chat
            workspace={kind}
            placeholder={c.placeholder}
            suggestions={[...c.suggestions]}
            intro={
              <div className="chat__hello">
                <h2 className="chat__lead rise">{c.lead}</h2>
                <p className="chat__sub rise" style={{ animationDelay: "60ms" }}>{c.sub}</p>
              </div>
            }
          />
        ))}
    </div>
  );
}
