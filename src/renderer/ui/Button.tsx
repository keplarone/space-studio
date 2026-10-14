import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonStatus = "idle" | "loading" | "success" | "error";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  /** `loading` shows a spinner ring next to the label; `success` / `error` swap the label. */
  status?: ButtonStatus;
  /** Label shown while `status` is `success`. */
  successLabel?: string;
  /** Label shown while `status` is `error`. Defaults to the normal label. */
  errorLabel?: string;
  /** Accessible name, when the visible text alone is ambiguous. */
  label?: string;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", status = "idle", successLabel = "Done", errorLabel, label, className, children, disabled, type = "button", ...rest },
  ref,
) {
  const busy = status === "loading";
  const text = status === "success" ? successLabel : status === "error" && errorLabel ? errorLabel : children;

  return (
    <button
      ref={ref}
      type={type}
      className={["btn", `btn--${variant}`, `btn--${size}`, className].filter(Boolean).join(" ")}
      data-status={status}
      disabled={disabled}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      aria-label={label}
      {...rest}
      onClick={busy ? undefined : rest.onClick}
    >
      {busy && <span className="btn__spinner" aria-hidden="true" />}
      {text != null && <span className="btn__label">{text}</span>}
    </button>
  );
});
