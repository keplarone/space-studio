import { useState, type ReactNode } from "react";

/** Steps may quote commands in `backticks`; show those as code. */
export function withCode(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/g).map((part, i) => (part.startsWith("`") && part.endsWith("`") && part.length > 2 ? <code key={i}>{part.slice(1, -1)}</code> : part));
}
import { copyText, openExternal } from "../lib/bridge";
import type { Troubleshoot } from "../../core/troubleshoot";

/**
 * Shows a desktop-side failure (Local engine, file or process work) as a card: what happened, the real error, and numbered
 * steps with the actions the failure allows. It never pretends something worked.
 */
export function TroubleshootCard({ t, onRetry, onUseCloud, onOpenSettings, onDismiss }: {
  t: Troubleshoot;
  onRetry?: () => void;
  onUseCloud?: () => void;
  onOpenSettings?: () => void;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showError, setShowError] = useState(false);
  const has = (a: NonNullable<Troubleshoot["actions"]>[number]) => t.actions?.includes(a) ?? false;
  return (
    <section className="trouble" role="alert" aria-labelledby={`tr-${t.code}`}>
      <span className="trouble__glow" aria-hidden="true" />
      <div className="trouble__head">
        <span className="trouble__badge" aria-hidden="true">!</span>
        <h3 id={`tr-${t.code}`} className="trouble__title">{t.title}</h3>
      </div>
      <ol className="trouble__steps">
        {t.steps.map((s, i) => <li key={s} style={{ animationDelay: `${120 + i * 90}ms` }}><span className="trouble__n">{i + 1}</span><span>{withCode(s)}</span></li>)}
      </ol>
      <button type="button" className="trouble__toggle" aria-expanded={showError} onClick={() => setShowError((v) => !v)}>
        {showError ? "Hide the error" : "Show the error"}
      </button>
      {showError && <pre className="trouble__error">{t.error}</pre>}
      <div className="trouble__actions">
        {has("retry") && onRetry && <button type="button" className="btn btn--primary btn--sm" onClick={onRetry}>Try again</button>}
        {has("open_settings") && onOpenSettings && <button type="button" className="btn btn--secondary btn--sm" onClick={onOpenSettings}>Local engine settings</button>}
        {has("use_cloud") && onUseCloud && <button type="button" className="btn btn--secondary btn--sm" onClick={onUseCloud}>Use cloud models</button>}
        {t.helpUrl && <button type="button" className="btn btn--ghost btn--sm" onClick={() => void openExternal(t.helpUrl!)}>Get it</button>}
        {has("copy_error") && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={async () => { if (await copyText(`${t.title}\n${t.error}`)) { setCopied(true); window.setTimeout(() => setCopied(false), 1500); } }}>
            {copied ? "Copied" : "Copy error"}
          </button>
        )}
        <button type="button" className="btn btn--ghost btn--sm" onClick={onDismiss}>Dismiss</button>
      </div>
    </section>
  );
}
