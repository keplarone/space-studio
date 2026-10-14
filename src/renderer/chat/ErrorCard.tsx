import { useEffect, useId, useState, type ReactNode } from "react";
import { useApp } from "../lib/app";
import { connected } from "../lib/bridge";
import type { Effort, ModelId, ModelView } from "../lib/types";
import type { ChatError } from "./engine";
import { PLAN_LABEL } from "./prefs";

/** "3 h", "3 h 20 min", "45 min", "2 days". */
export function timeUntil(iso: string | null | undefined, now = Date.now()): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const min = Math.max(0, Math.ceil((t - now) / 60_000));
  if (min < 1) return "less than a minute";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 10) return m ? `${h} h ${m} min` : `${h} h`;
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} days`;
}

const WINDOW_MS: Record<string, number> = { five_hours: 5 * 3_600_000, week: 7 * 86_400_000, month: 30 * 86_400_000 };

/** A ring that fills as the credit window recharges, with the time left in its centre. */
function Recharge({ resetsAt, limitedBy }: { resetsAt: string | null; limitedBy: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const total = limitedBy ? WINDOW_MS[limitedBy] : undefined;
  const left = resetsAt ? new Date(resetsAt).getTime() - now : NaN;
  const p = total && Number.isFinite(left) ? Math.min(1, Math.max(0.02, 1 - left / total)) : 0.5;
  const min = Number.isFinite(left) ? Math.max(0, Math.ceil(left / 60_000)) : null;
  const label = min == null ? "" : min < 60 ? `${min}m` : min < 2880 ? `${Math.round(min / 60)}h` : `${Math.round(min / 1440)}d`;
  return (
    <span className="recharge" style={{ ["--p" as string]: p }} aria-hidden="true">
      <span className="recharge__ring" />
      <span className="recharge__core">{label}</span>
    </span>
  );
}

export function ErrorCard({ error, models, resetsAt, fallback, onRetry, onDismiss }: {
  error: ChatError;
  models: ModelView[];
  resetsAt: string | null;
  fallback?: ModelView;
  onRetry: (model?: ModelId, effort?: Effort) => void;
  onDismiss: () => void;
}) {
  const { me, navigate, signIn } = useApp();
  const tid = useId();
  const modelName = models.find((m) => m.id === error.model)?.name ?? error.model;
  const planName = me?.plan?.name ?? PLAN_LABEL[me?.credits?.plan ?? ""] ?? "Your plan";
  const btn = (label: string, onClick: () => void, kind: "primary" | "secondary" | "ghost" = "secondary") => (
    <button type="button" className={`btn btn--${kind} btn--sm`} onClick={onClick}>{label}</button>
  );

  let tone: "limit" | "lock" | "warn" = "warn";
  let title: string;
  let body: ReactNode;
  let actions: ReactNode;
  let art: ReactNode = null;

  switch (error.code) {
    case "credits_exhausted":
    case "credits_low": {
      tone = "limit";
      const at = (typeof error.data.resetsAt === "string" ? error.data.resetsAt : null) ?? resetsAt;
      const until = timeUntil(at);
      const low = error.code === "credits_low";
      title = low ? "Not enough credits for this one" : `You have used your ${planName} credits for now`;
      body = (
        <>
          <p className="ecard__lead">
            {until ? <>{planName} resets in <strong>{until}</strong>, or upgrade for more.</> : <>Your credits come back when the window resets, or upgrade for more.</>}
          </p>
          {low && <p>A lighter effort or a faster model uses fewer credits.</p>}
          {error.message && <p className="ecard__server">{error.message}</p>}
        </>
      );
      art = <Recharge resetsAt={at} limitedBy={me?.credits?.limitedBy ?? null} />;
      actions = (
        <>
          {btn("See plans", () => navigate("billing"), "primary")}
          {low && error.effort !== "low" && btn("Try Low effort", () => onRetry(error.model, "low"))}
          {low && error.effort === "low" && models.some((m) => m.id === "orbit" && m.available) && error.model !== "orbit" && btn("Ask Orbit 3.8", () => onRetry("orbit", "low"))}
        </>
      );
      break;
    }
    case "plan_required": {
      tone = "lock";
      const min = typeof error.data.minPlan === "string" ? error.data.minPlan : models.find((m) => m.id === error.model)?.minPlan;
      const minName = (min && PLAN_LABEL[min]) ?? "a higher plan";
      title = `${modelName} needs ${minName}`;
      body = <p>Your {planName} plan does not include {modelName}. Upgrade to {minName}, or ask a model your plan includes.</p>;
      actions = (
        <>
          {btn("See plans", () => navigate("billing"), "primary")}
          {fallback && btn(`Ask ${fallback.name}`, () => onRetry(fallback.id))}
        </>
      );
      break;
    }
    case "roblox_link_required":
      tone = "lock";
      title = "Link your Roblox account";
      body = <p>The Roblox workspace answers once your Roblox account is linked to Space Studio. It takes a few seconds in Account.</p>;
      actions = btn("Link Roblox", () => navigate("account"), "primary");
      break;
    case "parent_consent_required":
      tone = "lock";
      title = "Waiting for a parent or guardian";
      body = <p>Chat unlocks as soon as a parent or guardian approves your account. You can see where that stands in Account.</p>;
      actions = btn("Open Account", () => navigate("account"), "primary");
      break;
    case "model_unavailable":
    case "model_mismatch":
      title = `${modelName} is unavailable right now`;
      body = <p>Nothing was charged. Try again in a moment, or ask another model.</p>;
      actions = (
        <>
          {btn("Try again", () => onRetry(), "primary")}
          {fallback && btn(`Ask ${fallback.name}`, () => onRetry(fallback.id))}
        </>
      );
      break;
    default:
      if (error.status === 0) {
        title = "Not connected";
        body = <p>Space Studio could not reach Keplar. Check your connection, then try again.</p>;
        actions = connected ? btn("Try again", () => onRetry(), "primary") : null;
      } else if (error.status === 401) {
        title = "You are signed out";
        body = <p>Sign in again to keep chatting. Your conversation stays here.</p>;
        actions = btn("Sign in", () => void signIn(), "primary");
      } else if (error.status === 402) {
        tone = "limit";
        title = "This needs a different plan";
        body = <p>{error.message}</p>;
        actions = btn("See plans", () => navigate("billing"), "primary");
      } else {
        title = "That answer did not come through";
        body = <p>{error.message}</p>;
        actions = btn("Try again", () => onRetry(), "primary");
      }
  }

  return (
    <section className="ecard" data-tone={tone} role="alert" aria-labelledby={tid}>
      {art}
      <div className="ecard__main">
        <h3 className="ecard__title" id={tid}>{title}</h3>
        <div className="ecard__body">{body}</div>
        <div className="ecard__actions">
          {actions}
          <button type="button" className="btn btn--ghost btn--sm" onClick={onDismiss}>Dismiss</button>
        </div>
      </div>
    </section>
  );
}
