import { useEffect, useState } from "react";
import { Button, Skeleton } from "../ui";
import { AccountGate, Notice, Panel, ViewHeader } from "../ui/common";
import { useApp } from "../lib/app";
import { bridge, connected } from "../lib/bridge";

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
      <ViewHeader title="Home" subtitle="An AI development environment for Roblox Studio and Blender" />
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
                {me.plan.name} plan{me.plan.status !== "active" && me.plan.status !== "none" ? ` (${me.plan.status})` : ""}
              </p>
              {me.robloxRequired && !me.robloxLinked && (
                <Notice tone="warn">
                  Link your Roblox account to use the Roblox Studio workspace.{" "}
                  <Button size="sm" variant="ghost" onClick={() => navigate("roblox")}>Go to Roblox Studio</Button>
                </Notice>
              )}
            </div>
          ) : (
            <div className="stack-sm">
              <p className="muted">Signed out. Sign in with your Keplar account, by email link or Google.</p>
              <div><Button variant="primary" onClick={() => void signIn()}>Sign in</Button></div>
            </div>
          )}
        </Panel>

        <Panel
          title="Installed on this computer"
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
            <dl className="detect">
              <dt>Roblox Studio</dt>
              {detected.robloxStudio.length ? detected.robloxStudio.map((r) => <dd key={r.path} className="mono">{r.path}</dd>) : <dd className="muted">Not found</dd>}
              <dt>Blender</dt>
              {detected.blender.length ? detected.blender.map((b) => <dd key={b.path} className="mono">{b.version ? `${b.version}: ` : ""}{b.path}</dd>) : <dd className="muted">Not found</dd>}
            </dl>
          )}
        </Panel>
      </div>
    </div>
  );
}
