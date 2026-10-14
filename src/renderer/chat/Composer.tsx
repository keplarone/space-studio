import { useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { RollingNumber } from "../ui/RollingNumber";
import type { ChatPrefs } from "./prefs";
import { ModelSelector } from "./ModelSelector";

export interface ComposerProps {
  prefs: ChatPrefs;
  value: string;
  onChange: (v: string) => void;
  /** Called with the composer's rect. Return false when the prompt was not sent. */
  onSend: (from: DOMRect) => boolean;
  busy?: boolean;
  disabled?: boolean;
  placeholder: string;
  label?: string;
  variant?: "hero" | "dock";
  sendLabel?: string;
  /** Extra controls in the bar, after the picker (Home's workspace switch). */
  extra?: ReactNode;
  credits?: number | null;
  creditsTitle?: string;
  pickerPlacement?: "up" | "down";
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

/**
 * The glass pill composer: an auto-growing message box with the model and effort picker and the white send button inside.
 * Enter sends, Shift+Enter starts a new line. Sending makes the pill pulse; with Ultracode selected a slow nebula glow
 * breathes around its edge.
 */
export function Composer({
  prefs, value, onChange, onSend, busy = false, disabled = false, placeholder, label = "Message", variant = "dock",
  sendLabel = "Send", extra, credits, creditsTitle, pickerPlacement = "up", inputRef,
}: ComposerProps) {
  const id = useId();
  const own = useRef<HTMLTextAreaElement>(null);
  const ta = inputRef ?? own;
  const form = useRef<HTMLFormElement>(null);
  const [pulse, setPulse] = useState(0);
  const ultra = prefs.effort === "ultracode";
  const canSend = !!value.trim() && !busy && !disabled;

  // Grow with the text up to a cap, then scroll.
  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "0px";
    const max = variant === "hero" ? 220 : 260;
    el.style.height = `${Math.min(max, el.scrollHeight)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [value, variant, ta]);

  const submit = () => {
    if (!canSend || !form.current) return;
    if (onSend(form.current.getBoundingClientRect())) setPulse((p) => p + 1);
  };
  const onSubmit = (e: FormEvent) => { e.preventDefault(); submit(); };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="cmp-wrap" data-variant={variant} data-ultra={ultra || undefined}>
      <span className="cmp-glow" aria-hidden="true"><i /><i /><i /></span>
      <form ref={form} className="cmp" onSubmit={onSubmit} data-pulse={pulse ? (pulse % 2 ? "a" : "b") : undefined} aria-label={label}>
        <label className="sr-only" htmlFor={`${id}-ta`}>{label}</label>
        <textarea
          ref={ta}
          id={`${id}-ta`}
          className="cmp__input"
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          disabled={disabled}
          aria-describedby={`${id}-hint`}
        />
        <span className="sr-only" id={`${id}-hint`}>Enter sends. Shift and Enter starts a new line.</span>
        <div className="cmp__bar">
          <ModelSelector prefs={prefs} placement={pickerPlacement} disabled={disabled} />
          {extra}
          <span className="cmp__spacer" />
          {credits != null && (
            <span className="cmp__credits" title={creditsTitle}>
              <RollingNumber value={credits} /> <span>credits</span>
            </span>
          )}
          <button type="submit" className="btn btn--primary cmp__send" disabled={!canSend} aria-busy={busy || undefined}>
            {busy && <span className="cmp__busy" aria-hidden="true" />}
            <span>{sendLabel}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
