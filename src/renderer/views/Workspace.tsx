import { useState } from "react";
import { Button } from "../ui";
import { AccountGate, EmptyState, Notice, ViewHeader } from "../ui/common";
import { Chat } from "../chat/Chat";
import { useApp } from "../lib/app";

export function Workspace({ kind }: { kind: "roblox" | "blender" }) {
  const { me, refreshMe } = useApp();
  const [link, setLink] = useState<{ state: "idle" | "loading" | "error"; msg?: string }>({ state: "idle" });
  const title = kind === "roblox" ? "Roblox Studio" : "Blender";
  const locked = kind === "roblox" && !!me?.signedIn && me.robloxRequired && !me.robloxLinked;

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

  return (
    <div className="view-body view-body--fill">
      <ViewHeader
        title={title}
        subtitle={kind === "roblox" ? "AI workspace for Luau scripting, game systems and Studio workflows." : "AI workspace for Blender Python, modelling and pipeline automation."}
      />
      <AccountGate what={`the ${title} workspace`} />
      {me?.signedIn &&
        (locked ? (
          <EmptyState
            title="Link Roblox to use this workspace"
            actions={
              me.providers.roblox ? (
                <Button variant="primary" status={link.state === "loading" ? "loading" : link.state === "error" ? "error" : "idle"} errorLabel="Try again" onClick={() => void connectRoblox()}>
                  Link Roblox
                </Button>
              ) : undefined
            }
          >
            <p>The Roblox Studio workspace needs a linked Roblox account.</p>
            {!me.providers.roblox && <Notice tone="warn">Roblox sign-in is not configured on the server yet, so linking is not possible right now.</Notice>}
            {link.state === "error" && <Notice tone="error">{link.msg}</Notice>}
          </EmptyState>
        ) : (
          <div className="workspace">
            <Chat
              workspace={kind}
              placeholder={
                kind === "roblox"
                  ? "Ask about Luau, DataStores, RemoteEvents, UI or performance, or paste code to review."
                  : "Ask about bpy scripts, geometry nodes, add-ons or rendering, or paste code to review."
              }
            />
          </div>
        ))}
      {me?.signedIn && !locked && kind === "roblox" && me.robloxLinked && (
        <p className="muted small">Roblox account linked</p>
      )}
    </div>
  );
}
