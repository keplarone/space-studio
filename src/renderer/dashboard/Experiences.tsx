import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button, Dialog } from "../ui";
import { copyText } from "../lib/bridge";
import type { Experience } from "../lib/types";
import type { AddResult } from "../lib/stats";
import { ExpIcon } from "./Pickers";
import { agoLabel } from "./chart";

export const MAX_EXPERIENCES = 10;

/** Client-side check for obvious mistakes; keplar.one does the real resolving and its errors are shown as they come. */
export function checkLink(raw: string): string | null {
  const s = raw.trim();
  if (!s) return "Paste a Roblox game link or a place ID.";
  if (/^\d{1,20}$/.test(s) || /^universe:\d{1,20}$/i.test(s)) return null;
  let u: URL | null = null;
  try { u = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`); } catch { u = null; }
  if (u && /(^|\.)roblox\.com$/i.test(u.hostname)) {
    if (/^\/(?:[a-z]{2}\/)?games\/\d+/i.test(u.pathname) || /^\d+$/.test(u.searchParams.get("placeId") ?? "")) return null;
    if (/^\/share/i.test(u.pathname)) return "Share links can't be resolved. Open the game's page and copy the address from your browser instead.";
    return "That isn't a game page. It should look like roblox.com/games/1234567890/Name.";
  }
  return "Paste a roblox.com/games/… link, a place ID, or universe:<id>.";
}

export type BeaconSheetState = { exp: Pick<Experience, "name" | "universeId" | "iconUrl">; script: string; reason: "added" | "rotated" } | null;

/** Paste a link, add the experience. */
export function AddExperience({ add, count, onAdded, autoFocus, compact }: {
  add: (link: string) => Promise<AddResult>;
  count: number;
  onAdded: (r: Extract<AddResult, { ok: true }>) => void;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const id = useId();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const full = count >= MAX_EXPERIENCES;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || full) return;
    const problem = checkLink(link);
    if (problem) { setErr(problem); setShake((n) => n + 1); return; }
    setBusy(true);
    setErr(null);
    const r = await add(link.trim());
    setBusy(false);
    if (r.ok) { setLink(""); onAdded(r); }
    else { setErr(r.message); setShake((n) => n + 1); }
  };
  return (
    <form className="addx" data-compact={compact || undefined} onSubmit={(e) => void submit(e)} noValidate>
      <label htmlFor={`${id}-link`} className="sr-only">Roblox game link or place ID</label>
      <div key={shake} className="addx__row" data-shake={shake ? "" : undefined}>
        <input
          id={`${id}-link`}
          className="addx__input"
          value={link}
          onChange={(e) => { setLink(e.target.value); if (err) setErr(null); }}
          placeholder="Roblox game link or place ID"
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          disabled={full}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `${id}-err` : `${id}-hint`}
        />
        <Button type="submit" variant="primary" status={busy ? "loading" : "idle"} disabled={full}>{busy ? "Adding" : "Add experience"}</Button>
      </div>
      {err ? (
        <p id={`${id}-err`} className="addx__err" role="alert">{err}</p>
      ) : (
        <p id={`${id}-hint`} className="addx__hint">
          {full ? `You're tracking ${MAX_EXPERIENCES} experiences, the most Space Studio follows. Remove one to add another.` : "Any experience you can see on Roblox. Its sales beacon only works in games you can edit."}
        </p>
      )}
    </form>
  );
}

/** The one-time beacon script and how to install it. */
export function BeaconSheet({ state, onClose }: { state: BeaconSheetState; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState<"idle" | "success" | "error">("idle");
  const [shown, setShown] = useState<BeaconSheetState>(state);
  useEffect(() => {
    if (state) { setShown(state); setCopied("idle"); }
    const d = ref.current;
    if (!d) return;
    if (state && !d.open) d.showModal();
    if (!state && d.open) d.close();
  }, [state]);
  const copy = async () => {
    if (!shown) return;
    const ok = await copyText(shown.script);
    setCopied(ok ? "success" : "error");
    window.setTimeout(() => setCopied("idle"), 2400);
  };
  const lines = shown?.script.split("\n") ?? [];
  return (
    <dialog ref={ref} className="sheet" aria-labelledby="beacon-title" onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      {shown && (
        <div className="sheet__in">
          <header className="sheet__head">
            <ExpIcon exp={shown.exp} size={48} />
            <div>
              <p className="sheet__eyebrow">{shown.reason === "added" ? "Experience added" : "New beacon key"}</p>
              <h2 id="beacon-title" className="sheet__title">Connect sales for {shown.exp.name}</h2>
            </div>
          </header>
          <p className="sheet__lede">
            The beacon is a small server script that reports each Developer Product and Game Pass sale to Space Studio as it happens. It is the only
            source of the revenue numbers on this dashboard.
          </p>
          <ol className="steps">
            <li><span className="steps__n">1</span><span>In Roblox Studio, open <b>Game Settings › Security</b> and turn on <b>Allow HTTP Requests</b>.</span></li>
            <li><span className="steps__n">2</span><span>Add a <b>Script</b> to <b>ServerScriptService</b> and paste the code below into it.</span></li>
            <li><span className="steps__n">3</span><span><b>Publish</b> the game. Sales appear here within seconds.</span></li>
          </ol>
          <div className="codecard">
            <div className="codecard__bar">
              <span>BeaconScript.server.lua</span>
              <Button variant="primary" size="sm" status={copied} successLabel="Copied" errorLabel="Copy failed" onClick={() => void copy()}>Copy script</Button>
            </div>
            <pre className="codecard__pre" tabIndex={0} aria-label="Beacon script">
              <code>{lines.map((l, i) => <span key={i} className="codecard__ln"><i aria-hidden="true">{i + 1}</i>{l || " "}{"\n"}</span>)}</code>
            </pre>
          </div>
          <p className="sheet__once">
            <b>This key is shown only once.</b> It's part of the script above. Copy it now: if you lose it, create a new beacon key, which turns this one off.
          </p>
          <div className="sheet__foot">
            <Button variant="secondary" onClick={onClose}>I've copied it</Button>
          </div>
        </div>
      )}
    </dialog>
  );
}

function BeaconStatus({ exp }: { exp: Experience }) {
  const last = exp.beacon.lastEventAt ? Date.parse(exp.beacon.lastEventAt) : NaN;
  if (exp.beacon.connected)
    return (
      <span className="bstat" data-on="">
        <i aria-hidden="true" />Beacon connected{Number.isFinite(last) ? ` · last event ${agoLabel(last)}` : ""}
      </span>
    );
  return (
    <span className="bstat">
      <i aria-hidden="true" />{Number.isFinite(last) ? `Beacon quiet · last event ${agoLabel(last)}` : "Waiting for the beacon's first event"}
    </span>
  );
}

const addedFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Tracked experiences: beacon status, new beacon key, remove, and adding more. */
export function ExperienceManager({ list, add, remove, rotateBeacon, onAdded, onSheet, selected, onSelect }: {
  list: Experience[];
  add: (link: string) => Promise<AddResult>;
  remove: (id: string) => Promise<boolean>;
  rotateBeacon: (id: string) => Promise<{ token: string; script: string } | { error: string }>;
  onAdded: (r: Extract<AddResult, { ok: true }>) => void;
  onSheet: (s: BeaconSheetState) => void;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "remove" | "rotate"; exp: Experience } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    if (!confirm) return;
    setBusy(true);
    setErr(null);
    if (confirm.kind === "remove") {
      const ok = await remove(confirm.exp.universeId);
      setBusy(false);
      if (!ok) { setErr("Couldn't remove it. Check your connection and try again."); return; }
      if (selected === confirm.exp.universeId) onSelect("all");
      setConfirm(null);
    } else {
      const r = await rotateBeacon(confirm.exp.universeId);
      setBusy(false);
      if ("error" in r) { setErr(r.error); return; }
      const exp = confirm.exp;
      setConfirm(null);
      onSheet({ exp, script: r.script, reason: "rotated" });
    }
  };

  return (
    <section className="card xman rise" style={{ animationDelay: "260ms" }} aria-labelledby="xman-h">
      <header className="card__head">
        <div>
          <h2 id="xman-h" className="card__title">Your experiences</h2>
          <p className="card__sub">{list.length} of {MAX_EXPERIENCES} tracked</p>
        </div>
        {!adding && list.length < MAX_EXPERIENCES && <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>Add experience</Button>}
      </header>

      {adding && (
        <div className="xman__add">
          <AddExperience add={add} count={list.length} autoFocus compact onAdded={(r) => { setAdding(false); onAdded(r); }} />
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
        </div>
      )}

      <ul className="xlist">
        {list.map((e, i) => (
          <li key={e.universeId} className="xrow" data-selected={selected === e.universeId || undefined} style={{ animationDelay: `${320 + i * 50}ms` }}>
            <button type="button" className="xrow__main" onClick={() => onSelect(e.universeId)} aria-pressed={selected === e.universeId} aria-label={`Show ${e.name} on the dashboard`}>
              <ExpIcon exp={e} size={40} />
              <span className="xrow__text" title={`Universe ${e.universeId}${Number.isFinite(Date.parse(e.addedAt)) ? ` · added ${addedFmt.format(new Date(e.addedAt))}` : ""}`}>
                <span className="xrow__name">{e.name}</span>
                <BeaconStatus exp={e} />
              </span>
            </button>
            <span className="xrow__actions">
              <Button size="sm" variant="ghost" label={`New beacon key for ${e.name}`} onClick={() => { setErr(null); setConfirm({ kind: "rotate", exp: e }); }}>New key</Button>
              <Button size="sm" variant="ghost" className="xrow__rm" label={`Remove ${e.name}`} onClick={() => { setErr(null); setConfirm({ kind: "remove", exp: e }); }}>Remove</Button>
            </span>
          </li>
        ))}
      </ul>

      <Dialog open={confirm != null} onClose={() => { if (!busy) setConfirm(null); }} title={confirm?.kind === "remove" ? `Remove ${confirm.exp.name}?` : "Create a new beacon key?"} labelledBy="xman-confirm">
        {confirm?.kind === "remove" ? (
          <p className="muted">Space Studio stops tracking {confirm.exp.name}: no more player samples or sales on this dashboard. You can add it again later, with a new beacon key.</p>
        ) : confirm ? (
          <p className="muted">The current key for {confirm.exp.name} stops working right away. Sales from your live game won't reach Space Studio until you paste the new script and publish.</p>
        ) : null}
        {err && <p className="addx__err" role="alert">{err}</p>}
        <div className="row row--end">
          <Button variant="ghost" onClick={() => setConfirm(null)} disabled={busy}>Cancel</Button>
          <Button variant={confirm?.kind === "remove" ? "danger" : "primary"} status={busy ? "loading" : "idle"} onClick={() => void run()}>
            {confirm?.kind === "remove" ? "Remove" : "Create new key"}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
