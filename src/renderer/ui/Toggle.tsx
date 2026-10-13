import { useId } from "react";

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="toggle-row">
      <div className="toggle-row__text">
        <label htmlFor={id} className="toggle-row__label">{label}</label>
        {description && <span id={`${id}-d`} className="toggle-row__desc">{description}</span>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-d` : undefined}
        disabled={disabled}
        className="toggle"
        data-on={checked ? "true" : "false"}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle__thumb" />
      </button>
    </div>
  );
}
