import { Button } from "../ui";
import { AccountGate, Notice, Panel, ViewHeader } from "../ui/common";
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
      <ViewHeader title="Billing" subtitle="Your Space Studio plan" />
      <AccountGate what="your plan" />
      {me?.signedIn && (
        <>
          <Panel title="Current plan" id="bill-current" actions={<Button size="sm" variant="ghost" onClick={() => void refreshMe()}>Refresh</Button>}>
            <p>
              <strong>{me.plan.name}</strong>
              <span className="muted"> · {me.plan.status}{me.plan.renewsAt ? ` · renews ${formatDay(me.plan.renewsAt)}` : ""}</span>
            </p>
            <dl className="kv kv--inline">
              <dt>Cloud</dt><dd>{me.features.cloud ? "Included" : me.features.cloudReason ?? "Not included"}</dd>
              {me.features.cloud && (<><dt>Concurrent cloud jobs</dt><dd>{me.features.maxCloudJobsConcurrent}</dd>
              <dt>Cloud minutes per month</dt><dd>{me.features.cloudMinutesMonthly.toLocaleString()}</dd></>)}
              <dt>Storage</dt><dd>{me.features.storageMb.toLocaleString()} MB</dd>
            </dl>
          </Panel>
          <Panel title="Plans" id="bill-plans">
            {!me.pricing.published && <Notice tone="info">{me.pricing.note}</Notice>}
            <table className="table">
              <caption className="sr-only">What each plan includes</caption>
              <thead>
                <tr><th scope="col">Plan</th><th scope="col">Price</th><th scope="col">Models</th><th scope="col">Roblox Cloud and Blender Cloud</th></tr>
              </thead>
              <tbody>
                {PLANS.map((p) => {
                  const current = me.plan.id === p.id;
                  const models = modelsFor(p.id, me.models);
                  return (
                    <tr key={p.id} data-current={current ? "true" : undefined}>
                      <th scope="row">{p.name}{current && <span className="muted"> (current)</span>}</th>
                      <td className="muted">{me.pricing.published ? "See keplar.one" : "Not published yet"}</td>
                      <td>{models.length ? models.join(", ") : "None"}</td>
                      <td>{RANK[p.id] >= RANK.pro ? "Included" : "Not included"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {me.pricing.published && <p className="muted small">{me.pricing.note}</p>}
          </Panel>
          <div className="row">
            <Button variant="primary" onClick={() => void openExternal(PLANS_URL)}>Manage plan on keplar.one</Button>
            <span className="muted small">Plan changes show here once keplar.one confirms them.</span>
          </div>
        </>
      )}
    </div>
  );
}
