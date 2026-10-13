import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { CheckResolve, Icon, Spinner, type IconName } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "icon";
export type ButtonStatus = "idle" | "loading" | "success" | "error";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  icon?: IconName;
  /** Visual status. `success` shows a check; `error` shakes once. */
  status?: ButtonStatus;
  /** Accessible label (required for icon-only buttons). */
  label?: string;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, status = "idle", label, className, children, disabled, type = "button", ...rest },
  ref,
) {
  const [shakeKey, setShakeKey] = useState(0);
  const prev = useRef(status);
  useEffect(() => {
    if (status === "error" && prev.current !== "error") setShakeKey((k) => k + 1);
    prev.current = status;
  }, [status]);

  const busy = status === "loading";
  const content =
    status === "loading" ? <Spinner /> : status === "success" ? <CheckResolve /> : icon ? <Icon name={icon} /> : null;

  return (
    <button
      ref={ref}
      type={type}
      className={["btn", `btn--${variant}`, `btn--${size}`, className].filter(Boolean).join(" ")}
      data-status={status}
      data-shake={shakeKey > 0 ? shakeKey % 2 : undefined}
      disabled={disabled}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      aria-label={label}
      title={variant === "icon" ? label : undefined}
      {...rest}
      onClick={busy ? undefined : rest.onClick}
    >
      {content && <span className="btn__icon">{content}</span>}
      {variant !== "icon" && children != null && <span className="btn__label">{children}</span>}
    </button>
  );
});
