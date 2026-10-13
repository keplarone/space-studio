import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { usePresence } from "../lib/motion";

type Side = "top" | "bottom";
type Align = "start" | "end";

/**
 * Anchored popover / dropdown. Positions with `fixed` from the anchor rect, flips to the side with room,
 * and scales+fades in from the corner nearest the anchor (origin-aware). Closes on Escape / outside click,
 * returns focus to the anchor.
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  children,
  label,
  prefer = "bottom",
  align = "start",
  width = 320,
  role = "dialog",
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  label: string;
  prefer?: Side;
  align?: Align;
  width?: number;
  role?: "dialog" | "menu" | "listbox";
}) {
  const { mounted, state } = usePresence(open, 160);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; side: Side; maxH: number } | null>(null);

  const place = useCallback(() => {
    const a = anchorRef.current?.getBoundingClientRect();
    if (!a) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceBelow = vh - a.bottom;
    const spaceAbove = a.top;
    const side: Side = prefer === "bottom" ? (spaceBelow >= 260 || spaceBelow >= spaceAbove ? "bottom" : "top") : spaceAbove >= 260 || spaceAbove >= spaceBelow ? "top" : "bottom";
    const w = Math.min(width, vw - 16);
    let left = align === "start" ? a.left : a.right - w;
    left = Math.max(8, Math.min(left, vw - w - 8));
    if (side === "bottom") setPos({ top: a.bottom + 6, left, side, maxH: spaceBelow - 16 });
    else setPos({ bottom: vh - a.top + 6, left, side, maxH: spaceAbove - 16 });
  }, [anchorRef, prefer, align, width]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        anchorRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", place);
    const f = window.setTimeout(() => {
      const first = ref.current?.querySelector<HTMLElement>("[data-autofocus], button:not([disabled]), [href], input, [tabindex]:not([tabindex='-1'])");
      first?.focus();
    }, 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", place);
      window.clearTimeout(f);
    };
  }, [open, onClose, anchorRef, place]);

  if (!mounted || !pos) return null;
  const origin = `${pos.side === "bottom" ? "top" : "bottom"} ${align === "start" ? "left" : "right"}`;
  return (
    <div
      ref={ref}
      role={role}
      aria-label={label}
      className="popover"
      data-state={state}
      data-side={pos.side}
      style={{
        top: pos.top,
        bottom: pos.bottom,
        left: pos.left,
        width: Math.min(width, window.innerWidth - 16),
        maxHeight: Math.max(160, pos.maxH),
        transformOrigin: origin,
      }}
    >
      {children}
    </div>
  );
}
