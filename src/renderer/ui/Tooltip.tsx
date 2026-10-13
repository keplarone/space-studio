import { cloneElement, useId, useRef, useState, type ReactElement } from "react";

/** Hover/focus tooltip. The child must accept aria-describedby and DOM event props. */
export function Tooltip({ text, children, side = "top" }: { text: string; children: ReactElement<Record<string, unknown>>; side?: "top" | "right" | "bottom" }) {
  const id = useId();
  const [show, setShow] = useState(false);
  const t = useRef<number | undefined>(undefined);
  const open = () => {
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setShow(true), 350);
  };
  const close = () => {
    window.clearTimeout(t.current);
    setShow(false);
  };
  return (
    <span className="tooltip-wrap" onMouseEnter={open} onMouseLeave={close} onFocus={open} onBlur={close}
      onKeyDown={(e) => e.key === "Escape" && close()}>
      {cloneElement(children, { "aria-describedby": id })}
      <span role="tooltip" id={id} className="tooltip" data-side={side} data-show={show ? "true" : "false"}>
        {text}
      </span>
    </span>
  );
}
