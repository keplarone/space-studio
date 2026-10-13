import { useId, useState, type ReactNode } from "react";
import { Chevron } from "./icons";

export function Disclosure({ summary, children, defaultOpen = false }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="disclosure" data-open={open ? "true" : "false"}>
      <button type="button" className="disclosure__trigger" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <Chevron open={open} size={14} />
        <span>{summary}</span>
      </button>
      <div id={id} className="disclosure__panel" hidden={!open}>
        {children}
      </div>
    </div>
  );
}
