import { useEffect, useRef, type ReactNode } from "react";

/** Modal confirmation dialog built on <dialog> (native focus trap, Escape to close). */
export function Dialog({ open, onClose, title, children, labelledBy }: { open: boolean; onClose: () => void; title: string; children: ReactNode; labelledBy?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const titleId = labelledBy ?? "dialog-title";
  return (
    <dialog ref={ref} className="dialog" aria-labelledby={titleId} onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <h2 id={titleId} className="dialog__title">{title}</h2>
      {children}
    </dialog>
  );
}
