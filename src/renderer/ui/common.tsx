import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { Button } from "./Button";
import { useApp } from "../lib/app";
import { connected } from "../lib/bridge";
import type { PlanId } from "../lib/types";

export function Panel({ title, children, actions, className, id }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string; id?: string }) {
  return (
    <section className={["panel", className].filter(Boolean).join(" ")} aria-labelledby={title && id ? `${id}-h` : undefined}>
      {(title || actions) && (
        <header className="panel__head">
          {title && <h2 className="panel__title" id={id ? `${id}-h` : undefined}>{title}</h2>}
          {actions && <div className="panel__actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function ViewHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="view-header">
      <div>
        <h1 className="view-header__title" tabIndex={-1}>{title}</h1>
        {subtitle && <p className="view-header__sub">{subtitle}</p>}
      </div>
      {actions && <div className="view-header__actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, children, actions }: { icon: IconName; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty__icon"><Icon name={icon} size={22} /></span>
      <h3 className="empty__title">{title}</h3>
      {children && <div className="empty__body">{children}</div>}
      {actions && <div className="empty__actions">{actions}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children, icon }: { tone?: "info" | "warn" | "error" | "success"; children: ReactNode; icon?: IconName }) {
  const ic: IconName = icon ?? (tone === "error" || tone === "warn" ? "alert" : tone === "success" ? "check" : "info");
  return (
    <div className="notice" data-tone={tone} role={tone === "error" ? "alert" : "status"}>
      <Icon name={ic} size={16} />
      <div>{children}</div>
    </div>
  );
}

export function PlanBadge({ plan, name }: { plan: PlanId; name?: string }) {
  return <span className="badge" data-plan={plan}>{name ?? plan[0].toUpperCase() + plan.slice(1)}</span>;
}

export function NotConnected() {
  return (
    <Notice tone="warn" icon="monitor">
      <strong>Not connected</strong> — run inside the Space Studio app. This page is running without the desktop bridge, so no account data or AI
      requests are available. Nothing shown here is simulated.
    </Notice>
  );
}

/** Standard gate for views that need the account: offline / loading / error / signed-out. Returns null when ready & signed in. */
export function AccountGate({ needSignIn = true, what }: { needSignIn?: boolean; what: string }) {
  const { meState, me, signIn, refreshMe } = useApp();
  if (!connected || meState.kind === "offline") return <NotConnected />;
  if (meState.kind === "loading") return null;
  if (meState.kind === "error")
    return (
      <Notice tone="error">
        {meState.message}{" "}
        <Button size="sm" variant="ghost" onClick={() => void refreshMe()}>Retry</Button>
      </Notice>
    );
  if (needSignIn && me && !me.signedIn)
    return (
      <EmptyState icon="user" title="Sign in to continue" actions={<Button variant="primary" icon="user" onClick={() => void signIn()}>Sign in</Button>}>
        Sign in with your Keplar account to see {what}.
      </EmptyState>
    );
  return null;
}
