import { useState } from "react";
import { Button } from "../ui";
import { AccountGate, Notice } from "../ui/common";
import { RollingNumber } from "../ui/RollingNumber";
import { formatDay, useApp } from "../lib/app";
import { openExternal, PLANS_URL } from "../lib/bridge";
import type { CreditAllowance, CreditBalance, ModelView, PlanId } from "../lib/types";

const PLANS: { id: PlanId; name: string; pitch: string }[] = [
  { id: "free", name: "Free", pitch: "Try Space Studio with fair limits that reset on their own." },
  { id: "plus", name: "Plus", pitch: "Daily building with Solar for harder problems." },
  { id: "pro", name: "Pro", pitch: "Nova, Roblox Cloud and Blender Cloud for serious creators." },
  { id: "team", name: "Team", pitch: "Pooled credits and cloud minutes for studios." },
  { id: "enterprise", name: "Enterprise", pitch: "Custom limits, contracts and support." },
];
const RANK: Record<PlanId, number> = { free: 0, plus: 1, pro: 2, team: 3, enterprise: 4 };

function allowanceText(a: CreditAllowance | undefined): string {
  if (!a) return "—";
  if (a.kind === "windows") return `${a.perFiveHours} credits every 5 hours, up to ${a.perWeek} a week`;
  if (a.kind === "monthly") return `${a.perMonth.toLocaleString("en-US")} credits a month${a.rollover ? ", unused credits roll over" : ""}`;
  return "Custom credits";
}

function until(iso: string): string {
  const d = new Date(iso);
  const ms = d.getTime() - Date.now();
  if (!(ms > 0)) return "now";
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const m = Math.ceil(ms / 60_000);
  if (m < 60) return `in ${m} min · ${time}`;
  const h = Math.round(m / 60);
  if (h < 48) return `in ${h} h · ${time}`;
  return `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${time}`;
}

function Meters({ b }: { b: CreditBalance }) {
  if (b.limitedBy === "custom") return <p className="muted">Your plan has custom credit limits.</p>;
  return (
    <div className="meters">
      {b.windows.map((w) => {
        const left = Math.max(0, w.limit - w.used);
        const pct = w.limit > 0 ? (left / w.limit) * 100 : 0;
        return (
          <div className="meter" key={w.label}>
            <div className="meter__top">
              <span className="meter__label">{w.label}</span>
              <span className="meter__value"><RollingNumber value={left} /> <span className="muted">/ {w.limit.toLocaleString("en-US")} left</span></span>
            </div>
            <div className="meter__bar" role="img" aria-label={`${left} of ${w.limit} credits left in the ${w.label.toLowerCase()}`}>
              <i style={{ width: `${pct}%` }} data-low={pct < 15 || undefined} />
            </div>
            <span className="meter__reset">Resets {until(w.resetsAt)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Billing() {
  const { me, refreshMe } = useApp();
  const [yearly, setYearly] = useState(false);
  const pricing = me?.pricing;
  const models = (plan: PlanId, list: ModelView[]) => list.filter((m) => RANK[m.minPlan] <= RANK[plan]).map((m) => m.name);
  return (
    <div className="view-body plans">
      <header className="rise">
        <h1 className="hero-title" tabIndex={-1}>Plans and <span className="grad-text">credits</span></h1>
        <p className="lede">One credit is one cent of model work actually done. You only pay for what a task used.</p>
      </header>
      <AccountGate what="your plan" />
      {me?.signedIn && (
        <>
          <section className="glass card rise" style={{ animationDelay: "80ms" }} aria-labelledby="cur-h">
            <div className="card__head">
              <div>
                <span className="eyebrow">Current plan</span>
                <h2 id="cur-h" className="card__title">{me.plan.name}</h2>
                <span className="muted small">{me.plan.status}{me.plan.renewsAt ? ` · renews ${formatDay(me.plan.renewsAt)}` : ""}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => void refreshMe()}>Refresh</Button>
            </div>
            {me.credits ? <Meters b={me.credits} /> : <p className="muted">Credits load once you're signed in.</p>}
          </section>

          <section aria-labelledby="plans-h" className="rise" style={{ animationDelay: "160ms" }}>
            <div className="plans__bar">
              <h2 id="plans-h" className="section-title">Choose a plan</h2>
              <div className="seg" role="radiogroup" aria-label="Billing period">
                <span className="seg__ind" data-right={yearly || undefined} aria-hidden="true" />
                <button type="button" role="radio" aria-checked={!yearly} onClick={() => setYearly(false)}>Monthly</button>
                <button type="button" role="radio" aria-checked={yearly} onClick={() => setYearly(true)}>Yearly · 2 months free</button>
              </div>
            </div>
            {pricing && !pricing.checkoutOpen && <Notice>{pricing.note}</Notice>}
            <div className="plan-grid">
              {PLANS.map((p, i) => {
                const price = pricing?.prices?.[p.id];
                const current = me.plan.id === p.id;
                const amount = price?.monthlyUsd == null ? null : yearly ? price.yearlyUsd! : price.monthlyUsd;
                return (
                  <article key={p.id} className="plan glass" data-current={current || undefined} data-featured={p.id === "pro" || undefined} style={{ animationDelay: `${200 + i * 70}ms` }}>
                    {p.id === "pro" && <span className="plan__badge">Most popular</span>}
                    <h3 className="plan__name">{p.name}</h3>
                    <div className="plan__price">
                      {amount == null ? <span className="plan__amount">Custom</span> : (
                        <>
                          <span className="plan__amount">${amount.toLocaleString("en-US")}</span>
                          <span className="muted small">{amount === 0 ? "forever" : `${price?.perSeat ? "per seat " : ""}${yearly ? "a year" : "a month"}`}</span>
                        </>
                      )}
                    </div>
                    <p className="plan__pitch">{p.pitch}</p>
                    <ul className="plan__list">
                      <li>{allowanceText(pricing?.allowances?.[p.id])}</li>
                      <li>{models(p.id, me.models).join(", ") || "No models"}</li>
                      <li>{RANK[p.id] >= RANK.pro ? "Roblox Cloud and Blender Cloud" : "No cloud jobs"}</li>
                    </ul>
                    {current ? <span className="plan__current">Your plan</span> : (
                      <Button variant={p.id === "pro" ? "primary" : "secondary"} onClick={() => void openExternal(PLANS_URL)} disabled={!pricing?.checkoutOpen && p.id !== "enterprise"}>
                        {p.id === "enterprise" ? "Contact us" : pricing?.checkoutOpen ? `Get ${p.name}` : "Coming soon"}
                      </Button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          {pricing?.packs && pricing.packs.length > 0 && (
            <section className="glass card rise" style={{ animationDelay: "560ms" }} aria-labelledby="packs-h">
              <h2 id="packs-h" className="section-title">Credit packs</h2>
              <p className="muted small">For paid plans. Used after your plan's credits, valid for 12 months.</p>
              <div className="packs">
                {pricing.packs.map((k) => (
                  <div key={k.id} className="pack">
                    <span className="pack__credits">{k.credits.toLocaleString("en-US")}</span>
                    <span className="muted small">credits</span>
                    <span className="pack__price">${k.usd}</span>
                    <span className="muted small">{((k.usd / k.credits) * 100).toFixed(2)}¢ per credit</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {pricing?.typicalCredits && (
            <section className="glass card rise" style={{ animationDelay: "620ms" }} aria-labelledby="typ-h">
              <h2 id="typ-h" className="section-title">What a task usually costs</h2>
              <div className="typical">
                {me.models.map((m) => (
                  <div key={m.id} className="typical__row">
                    <span className="typical__name">{m.name}</span>
                    <span className="typical__bar"><i style={{ width: `${Math.min(100, (pricing.typicalCredits![m.id] / 90) * 100)}%` }} /></span>
                    <span className="typical__val">~{pricing.typicalCredits![m.id]} credits</span>
                  </div>
                ))}
              </div>
              <p className="muted small">A medium-effort task. Higher effort and Ultracode use more; you're always charged for what was actually used.</p>
            </section>
          )}

          {pricing?.rules && (
            <section className="glass card rise" style={{ animationDelay: "680ms" }} aria-labelledby="fair-h">
              <h2 id="fair-h" className="section-title">Fair credits</h2>
              <ol className="rules">{pricing.rules.map((r) => <li key={r}>{r}</li>)}</ol>
            </section>
          )}
        </>
      )}
    </div>
  );
}
