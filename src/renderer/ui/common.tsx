import type { ReactNode } from "react";
import { Button } from "./Button";
import { useApp } from "../lib/app";
import { connected } from "../lib/bridge";

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

export function EmptyState({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="empty">
      <h2 className="empty__title">{title}</h2>
      {children && <div className="empty__body">{children}</div>}
      {actions && <div className="empty__actions">{actions}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "success"; children: ReactNode }) {
  return (
    <div className="notice" data-tone={tone} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function NotConnected() {
  return (
    <Notice tone="warn">
      <strong>Not connected.</strong> This page is running outside the Space Studio app, so account data and AI requests are unavailable.
      Nothing here is simulated.
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
      <EmptyState title="Signed out" actions={<Button variant="primary" onClick={() => void signIn()}>Sign in</Button>}>
        Sign in with your Keplar account to see {what}.
      </EmptyState>
    );
  return null;
}
