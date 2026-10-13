import { useEffect, useState } from "react";
import { Button, Icon, Skeleton } from "../ui";
import { AccountGate, Notice, Panel, PlanBadge, ViewHeader } from "../ui/common";
import { useApp, type ViewId } from "../lib/app";
import { bridge, connected } from "../lib/bridge";
import type { IconName } from "../ui/icons";

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const QUICK: { id: ViewId; label: string; desc: string; icon: IconName }[] = [
  { id: "roblox", label: "Roblox Studio workspace", desc: "Scripts, systems and debugging with AI", icon: "roblox" },
  { id: "blender", label: "Blender workspace", desc: "Python, geometry nodes and pipelines", icon: "blender" },
  { id: "cloud", label: "Cloud", desc: "Run long jobs on Keplar Cloud", icon: "cloud" },
  { id: "account", label: "Account & Security", desc: "Linked accounts and sessions", icon: "shield" },
];

export function Home() {
  const { me, meState, signIn, navigate } = useApp();
  const [detected, setDetected] = useState<SpaceDetectResult | null>(null);
  const [detectState, setDetectState] = useState<"idle" | "loading" | "error">("idle");

  const runDetect = async () => {
    if (!bridge) return;
    setDetectState("loading");
    try {
      setDetected(await bridge.detect());
      setDetectState("idle");
    } catch {
      setDetectState("error");
    }
  };
  useEffect(() => {
    void runDetect();
  }, []);

  return (
    <div className="view-body">
      <ViewHeader
        title={me?.signedIn ? `${greeting()}${me.email ? `, ${me.email.split("@")[0]}` : ""}` : greeting()}
        subtitle="Space Studio — an AI development environment for Roblox Studio and Blender."
        actions={me?.signedIn ? <PlanBadge plan={me.plan.id} name={me.plan.name} /> : undefined}
      />
      <AccountGate needSignIn={false} what="your account" />

      <div className="grid grid--2">
        <Panel title="Account" id="home-account">
          {meState.kind === "loading" ? (
            <Skeleton lines={2} />
          ) : !connected || meState.kind === "offline" ? (
            <p className="muted">Not connected.</p>
          ) : me?.signedIn ? (
            <div className="stack-sm">
              <p>Signed in as <strong>{me.email ?? "your Keplar account"}</strong></p>
              <p className="muted">
                Plan: {me.plan.name} {me.plan.status !== "active" && me.plan.status !== "none" ? `(${me.plan.status})` : ""}
              </p>
              {me.robloxRequired && !me.robloxLinked && (
                <Notice tone="warn" icon="lock">Connect your Roblox account to unlock the Roblox workspace.</Notice>
              )}
            </div>
          ) : (
            <div className="stack-sm">
              <p className="muted">You're signed out. Sign in with your Keplar account (email link or Google).</p>
              <div><Button variant="primary" icon="user" onClick={() => void signIn()}>Sign in</Button></div>
            </div>
          )}
        </Panel>

        <Panel
          title="Detected on this computer"
          id="home-detect"
          actions={connected ? <Button size="sm" variant="ghost" status={detectState === "loading" ? "loading" : "idle"} onClick={() => void runDetect()}>Scan again</Button> : undefined}
        >
          {!connected ? (
            <p className="muted">Install detection runs inside the Space Studio app.</p>
          ) : detectState === "error" ? (
            <Notice tone="error">Detection failed.</Notice>
          ) : !detected ? (
            <Skeleton lines={2} />
          ) : (
            <ul className="list">
              <li className="list__item">
                <Icon name="roblox" />
                <div className="list__main">
                  <strong>Roblox Studio</strong>
                  {detected.robloxStudio.length ? detected.robloxStudio.map((r) => <span key={r.path} className="mono muted">{r.path}</span>) : <span className="muted">Not found</span>}
                </div>
                <span className="chip" data-tone={detected.robloxStudio.length ? "ok" : undefined}>{detected.robloxStudio.length ? "Found" : "Not found"}</span>
              </li>
              <li className="list__item">
                <Icon name="blender" />
                <div className="list__main">
                  <strong>Blender</strong>
                  {detected.blender.length ? detected.blender.map((b) => <span key={b.path} className="mono muted">{b.version ? `${b.version} — ` : ""}{b.path}</span>) : <span className="muted">Not found</span>}
                </div>
                <span className="chip" data-tone={detected.blender.length ? "ok" : undefined}>{detected.blender.length ? "Found" : "Not found"}</span>
              </li>
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Quick actions" id="home-quick">
        <div className="quick">
          {QUICK.map((q) => (
            <button key={q.id} type="button" className="quick__item" onClick={() => navigate(q.id)}>
              <span className="quick__icon"><Icon name={q.icon} size={20} /></span>
              <span className="quick__text"><strong>{q.label}</strong><span className="muted">{q.desc}</span></span>
              <Icon name="chevronRight" size={16} />
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
