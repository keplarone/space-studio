import { useCallback, useEffect, useState } from "react";
import { Button, LoadingBlock, SegmentedControl } from "../ui";
import { AccountGate, EmptyState, Notice, Panel, ViewHeader } from "../ui/common";
import { formatDate, useApp } from "../lib/app";
import { api, connected, errorMessage, openExternal, PLANS_URL } from "../lib/bridge";
import type { CloudView, JobView } from "../lib/types";

type Tab = "roblox" | "blender";

const CAPS: Record<Tab, { title: string; text: string }> = {
  roblox: { title: "Roblox Cloud", text: "Runs long AI build tasks for your Roblox experience on Keplar's servers — generating and reviewing scripts and systems without keeping your computer busy." },
  blender: { title: "Blender Cloud", text: "Runs Blender jobs on Keplar's servers — scripted scene generation and batch processing — so heavy work doesn't tie up your machine." },
};

const COMPARE: { plan: string; cloud: boolean }[] = [
  { plan: "Free", cloud: false },
  { plan: "Plus", cloud: false },
  { plan: "Pro", cloud: true },
  { plan: "Team", cloud: true },
  { plan: "Enterprise", cloud: true },
];

const STATUS_ORDER = ["running", "queued", "completed", "failed"] as const;

function bucket(status: string): string {
  const s = status.toLowerCase();
  if (["running", "in_progress", "active", "processing"].includes(s)) return "running";
  if (["queued", "pending", "scheduled"].includes(s)) return "queued";
  if (["completed", "succeeded", "done", "finished"].includes(s)) return "completed";
  if (["failed", "error", "errored", "canceled", "cancelled"].includes(s)) return "failed";
  return "other";
}

function money(v: unknown): string | null {
  return typeof v === "number" && Number.isFinite(v) ? `$${v.toFixed(v < 1 ? 4 : 2)}` : null;
}

function JobRow({ job }: { job: JobView }) {
  const usage = (job.usage ?? {}) as Record<string, unknown>;
  const est = (job.estimate ?? job.estimated ?? null) as Record<string, unknown> | number | null;
  const estimated = money(typeof est === "number" ? est : est?.usd ?? job.estimatedUsd ?? job.estimatedCostUsd);
  const actual = money(usage.usd ?? usage.costUsd ?? job.actualUsd ?? job.costUsd);
  const title = (job.goal ?? job.prompt ?? "") as string;
  return (
    <li className="job">
      <div className="job__main">
        <strong className="job__title">{title || <span className="muted">(no description)</span>}</strong>
        <span className="mono muted small">{job.id}</span>
      </div>
      <dl className="kv kv--inline small">
        <dt>Status</dt><dd><span className="chip" data-status={bucket(job.status)}>{job.status}</span></dd>
        {job.createdAt && (<><dt>Created</dt><dd>{formatDate(job.createdAt)}</dd></>)}
        {job.updatedAt && (<><dt>Updated</dt><dd>{formatDate(job.updatedAt)}</dd></>)}
        {estimated && (<><dt>Estimated cost</dt><dd>{estimated} <span className="muted">(estimate)</span></dd></>)}
        {actual && (<><dt>Actual cost</dt><dd>{actual} <span className="muted">(billed usage)</span></dd></>)}
        {job.stopReason && (<><dt>Stop reason</dt><dd>{job.stopReason}</dd></>)}
      </dl>
    </li>
  );
}

export function Cloud() {
  const { me, refreshMe } = useApp();
  const [tab, setTab] = useState<Tab>("roblox");
  const [state, setState] = useState<{ kind: "idle" | "loading" } | { kind: "error"; msg: string } | { kind: "ready"; data: CloudView }>({ kind: "idle" });
  const [checking, setChecking] = useState<"idle" | "loading" | "success">("idle");
  const [checkMsg, setCheckMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const r = await api<CloudView>("GET", "/api/space-studio/cloud");
    if (r.status === 200 && r.data) setState({ kind: "ready", data: r.data });
    else setState({ kind: "error", msg: errorMessage(r.status, r.data, "Could not load Cloud.") });
  }, []);

  useEffect(() => {
    if (connected && me?.signedIn) void load();
  }, [connected, me?.signedIn, load]);

  const checkAgain = async () => {
    setChecking("loading");
    setCheckMsg(null);
    const fresh = await refreshMe();
    await load();
    if (fresh?.features.cloud) {
      setChecking("success");
      setCheckMsg(`Your plan is now ${fresh.plan.name}. Cloud is available.`);
    } else {
      setChecking("idle");
      setCheckMsg(fresh ? `Your account still shows the ${fresh.plan.name} plan. Upgrades can take a minute to appear — try again shortly.` : "Couldn't check your plan.");
    }
  };

  const data = state.kind === "ready" ? state.data : null;
  const jobs = data ? data[tab].jobs : [];

  return (
    <div className="view-body">
      <ViewHeader title="Cloud" subtitle="Run long Roblox and Blender jobs on Keplar Cloud." />
      <AccountGate what="Cloud" />
      {me?.signedIn && (
        <>
          <SegmentedControl<Tab> label="Cloud product" idPrefix="cloud" value={tab} onChange={setTab}
            segments={[{ value: "roblox", label: "Roblox Cloud" }, { value: "blender", label: "Blender Cloud" }]} />
          <div role="tabpanel" id={`cloud-panel-${tab}`} aria-labelledby={`cloud-tab-${tab}`} className="stack">
            {state.kind === "loading" || state.kind === "idle" ? (
              <LoadingBlock label="Loading Cloud" />
            ) : state.kind === "error" ? (
              <Notice tone="error">{state.msg} <Button size="sm" variant="ghost" onClick={() => void load()}>Retry</Button></Notice>
            ) : data && !data.eligible ? (
              <>
                <Panel title={<>{CAPS[tab].title} <span className="chip chip--warn">Requires Pro or above</span></>} id="cloud-locked">
                  <p>{CAPS[tab].text}</p>
                  {data.reason && <p className="muted">{data.reason}</p>}
                  <table className="compare">
                    <caption className="sr-only">Cloud availability by plan</caption>
                    <thead><tr><th scope="col">Plan</th><th scope="col">Cloud</th></tr></thead>
                    <tbody>
                      {COMPARE.map((c) => (
                        <tr key={c.plan} data-current={me.plan.name.toLowerCase() === c.plan.toLowerCase() ? "true" : undefined}>
                          <th scope="row">{c.plan}{me.plan.name.toLowerCase() === c.plan.toLowerCase() && <span className="chip">Current</span>}</th>
                          <td>{c.cloud ? "Included" : "Not included"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="row">
                    <Button variant="primary" icon="external" onClick={() => void openExternal(PLANS_URL)}>Upgrade on keplar.one</Button>
                    <Button variant="secondary" status={checking} onClick={() => void checkAgain()}>I've upgraded — check again</Button>
                  </div>
                  {checkMsg && <p className="muted small" role="status">{checkMsg}</p>}
                </Panel>
              </>
            ) : jobs.length === 0 ? (
              <EmptyState icon="cloud" title={`No ${CAPS[tab].title} jobs yet`}>
                Jobs you start will appear here with their status and usage.
              </EmptyState>
            ) : (
              <>
                {[...STATUS_ORDER, "other"].map((b) => {
                  const list = jobs.filter((j) => bucket(j.status) === b);
                  if (!list.length) return null;
                  return (
                    <Panel key={b} title={`${b[0].toUpperCase()}${b.slice(1)} (${list.length})`} id={`cloud-${b}`}>
                      <ul className="jobs">{list.map((j) => <JobRow key={j.id} job={j} />)}</ul>
                    </Panel>
                  );
                })}
                <div><Button size="sm" variant="ghost" onClick={() => void load()}>Refresh</Button></div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
