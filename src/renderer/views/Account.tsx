import { useCallback, useEffect, useState } from "react";
import { Button, Dialog, Icon, LoadingBlock } from "../ui";
import { AccountGate, Notice, Panel, ViewHeader } from "../ui/common";
import { formatDate, formatDay, useApp } from "../lib/app";
import { api, errorCode, errorMessage } from "../lib/bridge";
import type { Identity } from "../lib/types";
import type { IconName } from "../ui/icons";

const PROVIDER: Record<Identity["provider"], { name: string; icon: IconName }> = {
  keplar: { name: "Keplar email", icon: "keplar" },
  google: { name: "Google", icon: "google" },
  roblox: { name: "Roblox", icon: "roblox" },
};

const UNLINK_CODES: Record<string, string> = {
  last_method: "This is your last sign-in method. Link another one before removing it.",
  reauth_required: "For your security, sign in again before unlinking.",
};

function Identities() {
  const { me, refreshMe, signIn } = useApp();
  const [ids, setIds] = useState<Identity[]>(me?.identities ?? []);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string; reauth?: boolean } | null>(null);

  useEffect(() => setIds(me?.identities ?? []), [me]);

  const unlink = async (p: Identity["provider"]) => {
    setBusy(p);
    setMsg(null);
    const r = await api<{ identities: Identity[] }>("DELETE", "/api/space-studio/identities", { provider: p });
    setBusy(null);
    if (r.status === 200 && r.data) {
      setIds(r.data.identities);
      setMsg({ tone: "success", text: `${PROVIDER[p].name} unlinked.` });
      void refreshMe();
    } else {
      const code = errorCode(r.data);
      setMsg({ tone: "error", text: (code && UNLINK_CODES[code]) || errorMessage(r.status, r.data, "Could not unlink."), reauth: code === "reauth_required" });
    }
  };

  const linkRoblox = async () => {
    if (!window.space) return;
    setBusy("roblox");
    setMsg(null);
    try {
      const r = await window.space.linkRoblox();
      const fresh = await refreshMe();
      const ok = fresh?.identities.find((i) => i.provider === "roblox")?.linked;
      if (ok) setMsg({ tone: "success", text: "Roblox linked." });
      else setMsg({ tone: "error", text: r.error ? `Roblox linking did not complete: ${r.error}` : "Roblox linking did not complete." });
    } catch {
      setMsg({ tone: "error", text: "Roblox linking did not complete." });
    }
    setBusy(null);
  };

  return (
    <Panel title="Linked sign-in methods" id="acct-ids">
      <ul className="list">
        {ids.map((i) => {
          const meta = PROVIDER[i.provider] ?? { name: i.provider, icon: "link" as IconName };
          return (
            <li key={i.provider} className="list__item">
              <Icon name={meta.icon} size={20} />
              <div className="list__main">
                <strong>{meta.name}</strong>
                <span className="muted small">
                  {i.linked ? <>{i.label ?? "Connected"}{i.linkedAt ? ` · linked ${formatDay(i.linkedAt)}` : ""}</> : "Not connected"}
                </span>
                {i.linked && !i.canUnlink && i.unlinkBlockedReason && <span className="muted small">{i.unlinkBlockedReason}</span>}
              </div>
              <span className="chip" data-tone={i.linked ? "ok" : undefined}>{i.linked ? "Connected" : "Not connected"}</span>
              {i.linked ? (
                <Button size="sm" variant="secondary" icon="unlink" disabled={!i.canUnlink || busy !== null} status={busy === i.provider ? "loading" : "idle"}
                  title={!i.canUnlink ? i.unlinkBlockedReason ?? undefined : undefined} onClick={() => void unlink(i.provider)}>
                  Unlink
                </Button>
              ) : i.provider === "roblox" ? (
                me?.providers.roblox ? (
                  <Button size="sm" variant="secondary" icon="link" disabled={busy !== null} status={busy === "roblox" ? "loading" : "idle"} onClick={() => void linkRoblox()}>Link</Button>
                ) : (
                  <span className="muted small">Roblox sign-in isn't configured on the server yet</span>
                )
              ) : i.provider === "google" && !me?.providers.google ? (
                <span className="muted small">Not configured on the server</span>
              ) : (
                <span className="muted small">Link from the sign-in window</span>
              )}
            </li>
          );
        })}
      </ul>
      {msg && (
        <Notice tone={msg.tone}>
          {msg.text}
          {msg.reauth && <> <Button size="sm" variant="secondary" onClick={() => void signIn()}>Sign in again</Button></>}
        </Notice>
      )}
    </Panel>
  );
}

interface SessionRow { id: string; current?: boolean; [k: string]: unknown }

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

function Sessions() {
  const [state, setState] = useState<{ kind: "loading" } | { kind: "error"; msg: string } | { kind: "ready"; list: SessionRow[] }>({ kind: "loading" });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ sessions?: SessionRow[] } | SessionRow[]>("GET", "/api/account/sessions");
    if (r.status === 200 && r.data) setState({ kind: "ready", list: Array.isArray(r.data) ? r.data : r.data.sessions ?? [] });
    else setState({ kind: "error", msg: errorMessage(r.status, r.data, "Could not load sessions.") });
  }, []);
  useEffect(() => void load(), [load]);

  const signOutOne = async (id: string) => {
    setBusy(id);
    setErr(null);
    const r = await api("DELETE", "/api/account/sessions", { id });
    setBusy(null);
    if (r.status >= 200 && r.status < 300) await load();
    else setErr(errorMessage(r.status, r.data, "Could not sign out that session."));
  };
  const signOutAll = async () => {
    setBusy("all");
    setErr(null);
    const r = await api("POST", "/api/account/sessions", { action: "all" });
    setBusy(null);
    if (r.status >= 200 && r.status < 300) await load();
    else setErr(errorMessage(r.status, r.data, "Could not sign out other sessions."));
  };

  return (
    <Panel
      title="Active sessions"
      id="acct-sessions"
      actions={state.kind === "ready" && state.list.length > 1 ? (
        <Button size="sm" variant="secondary" icon="signOut" status={busy === "all" ? "loading" : "idle"} disabled={busy !== null} onClick={() => void signOutAll()}>Sign out all</Button>
      ) : undefined}
    >
      {state.kind === "loading" ? <LoadingBlock label="Loading sessions" /> : state.kind === "error" ? <Notice tone="error">{state.msg}</Notice> : state.list.length === 0 ? (
        <p className="muted">No active sessions reported.</p>
      ) : (
        <ul className="list">
          {state.list.map((s) => {
            const device = str(s.device) ?? str(s.userAgent) ?? str(s.client) ?? "Session";
            const seen = str(s.lastSeen) ?? str(s.lastSeenAt) ?? str(s.lastActiveAt) ?? str(s.updatedAt);
            const created = str(s.createdAt);
            return (
              <li key={s.id} className="list__item">
                <Icon name="monitor" size={20} />
                <div className="list__main">
                  <strong className="ellipsis">{device}</strong>
                  <span className="muted small">
                    {[str(s.ip), str(s.location), created && `started ${formatDate(created)}`, seen && `last active ${formatDate(seen)}`].filter(Boolean).join(" · ") || s.id}
                  </span>
                </div>
                {s.current ? <span className="chip" data-tone="ok">This device</span> : (
                  <Button size="sm" variant="ghost" icon="signOut" status={busy === s.id ? "loading" : "idle"} disabled={busy !== null} onClick={() => void signOutOne(s.id)}>Sign out</Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {err && <Notice tone="error">{err}</Notice>}
    </Panel>
  );
}

function Export() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const run = async () => {
    setStatus("loading");
    setErr(null);
    const r = await api<unknown>("GET", "/api/account/export");
    if (r.status === 200 && r.data != null) {
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `keplar-account-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      setStatus("success");
    } else {
      setStatus("error");
      setErr(errorMessage(r.status, r.data, "Export failed."));
    }
  };
  return (
    <Panel title="Your data" id="acct-export">
      <p className="muted">Download a copy of the data associated with your Keplar account as JSON.</p>
      <div><Button variant="secondary" icon="download" status={status} onClick={() => void run()}>Export my data</Button></div>
      {err && <Notice tone="error">{err}</Notice>}
    </Panel>
  );
}

function DeleteAccount() {
  const { me } = useApp();
  const [sched, setSched] = useState<{ kind: "loading" } | { kind: "ready"; at: string | null } | { kind: "error"; msg: string }>({ kind: "loading" });
  const [typed, setTyped] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api<Record<string, unknown>>("GET", "/api/account/delete");
    if (r.status === 200 && r.data) {
      const d = r.data;
      const at = str(d.scheduledFor) ?? str(d.scheduledAt) ?? str(d.deleteAt) ?? str(d.date) ?? null;
      setSched({ kind: "ready", at });
    } else setSched({ kind: "error", msg: errorMessage(r.status, r.data, "Could not load deletion status.") });
  }, []);
  useEffect(() => void load(), [load]);

  const email = me?.email ?? "";
  const matches = !!email && typed.trim().toLowerCase() === email.toLowerCase();

  const schedule = async () => {
    setBusy(true);
    setErr(null);
    const r = await api("POST", "/api/account/delete", { confirmEmail: typed.trim() });
    setBusy(false);
    setConfirm(false);
    if (r.status >= 200 && r.status < 300) {
      setTyped("");
      await load();
    } else setErr(errorMessage(r.status, r.data, "Could not schedule deletion."));
  };
  const cancel = async () => {
    setBusy(true);
    setErr(null);
    const r = await api("POST", "/api/account/delete", { action: "cancel" });
    setBusy(false);
    if (r.status >= 200 && r.status < 300) await load();
    else setErr(errorMessage(r.status, r.data, "Could not cancel deletion."));
  };

  return (
    <section className="panel panel--danger" aria-labelledby="del-h">
      <header className="panel__head"><h2 className="panel__title" id="del-h">Delete account</h2></header>
      {sched.kind === "loading" ? <LoadingBlock label="Loading deletion status" /> : sched.kind === "error" ? <Notice tone="error">{sched.msg}</Notice> : sched.at ? (
        <div className="stack-sm">
          <Notice tone="warn">Your account is scheduled for deletion on <strong>{formatDay(sched.at)}</strong>.</Notice>
          <div><Button variant="secondary" status={busy ? "loading" : "idle"} onClick={() => void cancel()}>Cancel deletion</Button></div>
        </div>
      ) : (
        <div className="stack-sm">
          <p><strong>What is deleted:</strong> your Keplar account, profile, linked sign-in methods (Google, Roblox), Space Studio chats and settings, Cloud jobs and stored files, and active sessions.</p>
          <p><strong>What may be retained:</strong> billing and payment records, invoices and records we must keep for legal, tax or fraud-prevention reasons, for the period the law requires.</p>
          <p className="muted">Deletion is scheduled, not instant, so you can cancel during the waiting period.</p>
          <label className="field">
            <span className="field__label">Type your account email{email ? <> (<span className="mono">{email}</span>)</> : ""} to confirm</span>
            <input className="input" type="email" autoComplete="off" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} />
          </label>
          <div><Button variant="danger" icon="trash" disabled={!matches} onClick={() => setConfirm(true)}>Delete account…</Button></div>
        </div>
      )}
      {err && <Notice tone="error">{err}</Notice>}
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Delete your Keplar account?" labelledBy="del-dialog-title">
        <p>This schedules permanent deletion of <strong className="mono">{email}</strong> and everything listed above. Billing and legal records may be retained.</p>
        <div className="row row--end">
          <Button variant="ghost" onClick={() => setConfirm(false)} autoFocus>Keep my account</Button>
          <Button variant="danger" icon="trash" status={busy ? "loading" : "idle"} onClick={() => void schedule()}>Yes, delete my account</Button>
        </div>
      </Dialog>
    </section>
  );
}

export function Account() {
  const { me } = useApp();
  return (
    <div className="view-body">
      <ViewHeader title="Account & Security" subtitle={me?.email ?? undefined} />
      <AccountGate what="your account" />
      {me?.signedIn ? (
        <>
          <Identities />
          <Sessions />
          <Export />
          <DeleteAccount />
        </>
      ) : null}
    </div>
  );
}
