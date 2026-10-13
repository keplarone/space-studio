import { Button, Icon } from "../ui";
import { AccountGate, Notice, Panel, PlanBadge, ViewHeader } from "../ui/common";
import { formatDay, useApp } from "../lib/app";
import { openExternal, PLANS_URL } from "../lib/bridge";
import type { ModelView, PlanId } from "../lib/types";

const PLANS: { id: PlanId; name: string }[] = [
  { id: "free", name: "Free" },
  { id: "plus", name: "Plus" },
  { id: "pro", name: "Pro" },
  { id: "team", name: "Team" },
  { id: "enterprise", name: "Enterprise" },
];
const RANK: Record<PlanId, number> = { free: 0, plus: 1, pro: 2, team: 3, enterprise: 4 };

function modelsFor(plan: PlanId, models: ModelView[]) {
  return models.filter((m) => RANK[m.minPlan] <= RANK[plan]).map((m) => m.name);
}

export function Billing() {
  const { me, refreshMe } = useApp();
  return (
    <div className="view-body">
      <ViewHeader title="Billing" subtitle="Your Space Studio plan." />
      <AccountGate what="your plan" />
      {me?.signedIn && (
        <>
          <Panel title="Current plan" id="bill-current" actions={<Button size="sm" variant="ghost" onClick={() => void refreshMe()}>Refresh</Button>}>
            <div className="row">
              <PlanBadge plan={me.plan.id} name={me.plan.name} />
              <span className="muted">Status: {me.plan.status}{me.plan.renewsAt ? ` · renews ${formatDay(me.plan.renewsAt)}` : ""}</span>
            </div>
            <dl className="kv kv--inline">
              <dt>Cloud</dt><dd>{me.features.cloud ? "Included" : me.features.cloudReason ?? "Not included"}</dd>
              {me.features.cloud && (<><dt>Concurrent cloud jobs</dt><dd>{me.features.maxCloudJobsConcurrent}</dd>
              <dt>Cloud minutes / month</dt><dd>{me.features.cloudMinutesMonthly.toLocaleString()}</dd></>)}
              <dt>Storage</dt><dd>{me.features.storageMb.toLocaleString()} MB</dd>
            </dl>
          </Panel>
          {!me.pricing.published && <Notice tone="info">{me.pricing.note}</Notice>}
          <div className="plans">
            {PLANS.map((p) => {
              const current = me.plan.id === p.id;
              const models = modelsFor(p.id, me.models);
              return (
                <article key={p.id} className="plan" data-current={current ? "true" : "false"} aria-label={`${p.name} plan${current ? " (current)" : ""}`}>
                  <header className="plan__head">
                    <h3>{p.name}</h3>
                    {current && <span className="chip" data-tone="ok">Current</span>}
                  </header>
                  <p className="plan__price">{me.pricing.published ? <span className="muted small">See keplar.one for pricing</span> : <span className="muted small">Price not published yet</span>}</p>
                  <ul className="plan__features">
                    <li><Icon name="check" size={14} /> Models: {models.length ? models.join(", ") : "—"}</li>
                    <li><Icon name={RANK[p.id] >= RANK.pro ? "check" : "close"} size={14} /> Roblox Cloud & Blender Cloud</li>
                  </ul>
                </article>
              );
            })}
          </div>
          {me.pricing.published && <p className="muted small">{me.pricing.note}</p>}
          <div className="row">
            <Button variant="primary" icon="external" onClick={() => void openExternal(PLANS_URL)}>Manage plan on keplar.one</Button>
            <span className="muted small">Plan changes appear here once keplar.one confirms them.</span>
          </div>
        </>
      )}
    </div>
  );
}
