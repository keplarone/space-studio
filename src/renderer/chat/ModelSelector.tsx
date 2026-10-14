import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useApp } from "../lib/app";
import { motionPrefs, usePresence } from "../lib/motion";
import type { Effort, ModelId, ModelView } from "../lib/types";
import { EFFORTS, PLAN_LABEL, SPEED_LABEL, effortLabel, type ChatPrefs } from "./prefs";
import { UltraPill } from "./Ultracode";

const STANDARD = EFFORTS.filter((e) => e.id !== "ultracode");

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]')].filter((el) => el.offsetParent !== null);
}

/**
 * The model and effort picker inside the composer. The button reads "Nebula 4.2 · High"; the popover springs out of it,
 * sharpening from a blur, with the four models (a listbox) and the five effort levels (a radio group). Focus stays inside
 * while it is open; Escape closes it and returns focus to the button.
 */
export function ModelSelector({ prefs, placement = "up", disabled = false }: { prefs: ChatPrefs; placement?: "up" | "down"; disabled?: boolean }) {
  const { me, navigate } = useApp();
  const [open, setOpen] = useState(false);
  const { mounted, state } = usePresence(open, 200);
  const [explain, setExplain] = useState<ModelId | null>(null);
  const [hoverEffort, setHoverEffort] = useState<Effort | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const ids = useId();
  const current = prefs.models.find((m) => m.id === prefs.model);
  const typical = me?.pricing?.typicalCredits;
  const ultra = prefs.effort === "ultracode";

  const close = (refocus = true) => {
    setOpen(false);
    setExplain(null);
    setHoverEffort(null);
    if (refocus) btn.current?.focus();
  };

  // Outside press closes without stealing focus from whatever was pressed.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) close(false); };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // On open, focus the selected model.
  useLayoutEffect(() => {
    if (!open) return;
    pop.current?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')?.focus({ preventScroll: true });
    // Keep the whole popover on screen (Home opens it downwards, under the fold on short windows).
    const t = window.setTimeout(() => pop.current?.scrollIntoView({ block: "nearest", behavior: motionPrefs.isReduced() ? "auto" : "smooth" }), 60);
    return () => window.clearTimeout(t);
  }, [open]);

  const onPopKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === "Tab" && pop.current) {
      const f = focusables(pop.current);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement as HTMLElement);
      const n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : i === f.length - 1 ? 0 : i + 1;
      e.preventDefault();
      f[n]!.focus();
    }
  };

  const pickModel = (m: ModelView) => {
    if (prefs.live && !m.available) { setExplain((x) => (x === m.id ? null : m.id)); return; }
    setExplain(null);
    prefs.setModel(m.id);
  };

  const onListKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const opts = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="option"]')];
    const i = opts.indexOf(document.activeElement as HTMLElement);
    let n = -1;
    if (e.key === "ArrowDown") n = (i + 1) % opts.length;
    else if (e.key === "ArrowUp") n = (i - 1 + opts.length) % opts.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = opts.length - 1;
    if (n >= 0) { e.preventDefault(); opts[n]!.focus(); }
  };

  const onEffortKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const i = EFFORTS.findIndex((x) => x.id === prefs.effort);
    let n = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % EFFORTS.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i - 1 + EFFORTS.length) % EFFORTS.length;
    if (n < 0) return;
    e.preventDefault();
    const id = EFFORTS[n]!.id;
    prefs.setEffort(id);
    e.currentTarget.querySelector<HTMLElement>(`[data-effort="${id}"]`)?.focus();
  };

  // The white indicator slides between the four standard levels with a horizontal motion blur.
  const rowRef = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);
  const [sliding, setSliding] = useState(false);
  const prevX = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!mounted) { prevX.current = null; setInd(null); return; }
    if (ultra) return;
    const el = rowRef.current?.querySelector<HTMLElement>(`[data-effort="${prefs.effort}"]`);
    if (!el) return;
    const x = el.offsetLeft;
    if (prevX.current != null && prevX.current !== x) setSliding(true);
    prevX.current = x;
    setInd({ x, w: el.offsetWidth });
  }, [mounted, prefs.effort, ultra]);
  useEffect(() => {
    if (!sliding) return;
    const t = window.setTimeout(() => setSliding(false), 420);
    return () => window.clearTimeout(t);
  }, [sliding, prefs.effort]);

  const shownEffort = hoverEffort ?? prefs.effort;
  const note = EFFORTS.find((x) => x.id === shownEffort)?.note ?? "";
  const explainModel = explain ? prefs.models.find((m) => m.id === explain) : null;

  return (
    <div className="picker" ref={wrap}>
      <button
        ref={btn}
        type="button"
        className="picker__btn"
        data-open={open || undefined}
        data-ultra={ultra || undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={mounted ? `${ids}-pop` : undefined}
        aria-label={`Model and effort: ${current?.name ?? "none"}, ${effortLabel(prefs.effort)} effort`}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="picker__model">{current?.name ?? "Choose a model"}</span>
        <span className="picker__sep" aria-hidden="true" />
        {ultra ? <UltraPill size="sm" active /> : <span className="picker__effort">{effortLabel(prefs.effort)}</span>}
        <span className="picker__chev" aria-hidden="true" />
      </button>

      {mounted && (
        <div
          ref={pop}
          id={`${ids}-pop`}
          className="picker__pop"
          role="dialog"
          aria-label="Model and effort"
          data-state={state}
          data-placement={placement}
          onKeyDown={onPopKey}
        >
          <p className="picker__kicker" id={`${ids}-models`}>Model</p>
          <div className="picker__models" role="listbox" aria-labelledby={`${ids}-models`} onKeyDown={onListKey}>
            {prefs.models.map((m, i) => {
              const selected = m.id === prefs.model;
              const locked = prefs.live && !m.available;
              const credits = typical?.[m.id];
              return (
                <div
                  key={m.id}
                  role="option"
                  tabIndex={selected ? 0 : -1}
                  aria-selected={selected}
                  aria-disabled={locked || undefined}
                  aria-describedby={locked && explain === m.id ? `${ids}-why` : undefined}
                  className="mopt"
                  data-locked={locked || undefined}
                  style={{ ["--i" as string]: i }}
                  onClick={() => pickModel(m)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickModel(m); } }}
                >
                  <span className="mopt__main">
                    <span className="mopt__name">
                      {m.name}
                      {locked && (
                        <span className="mopt__lock">
                          <span className="lock" aria-hidden="true" />
                          {PLAN_LABEL[m.minPlan] ?? m.minPlan}
                        </span>
                      )}
                    </span>
                    <span className="mopt__tag">{m.tagline}</span>
                  </span>
                  <span className="mopt__facts">
                    <span>{SPEED_LABEL[m.speed] ?? m.speed}</span>
                    <span className="mopt__credits">{credits != null ? `~${credits.toLocaleString("en-US")} credits` : m.creditNote}</span>
                  </span>
                  <span className="mopt__tick" aria-hidden="true" />
                </div>
              );
            })}
          </div>
          {explainModel && (
            <div className="picker__why" id={`${ids}-why`} role="status">
              <p>
                <strong>{explainModel.name}</strong> is included with {PLAN_LABEL[explainModel.minPlan] ?? explainModel.minPlan} and above.
                {me?.plan ? ` You are on ${me.plan.name}.` : ""}
              </p>
              <button type="button" className="btn btn--primary btn--sm" onClick={() => { close(false); navigate("billing"); }}>
                See plans
              </button>
            </div>
          )}

          <p className="picker__kicker" id={`${ids}-effort`}>Effort</p>
          <div className="picker__efforts" role="radiogroup" aria-labelledby={`${ids}-effort`} aria-describedby={`${ids}-note`} onKeyDown={onEffortKey} ref={rowRef}>
            <div className="picker__levels" data-ultra={ultra || undefined}>
              {ind && <span className="picker__ind" data-moving={sliding || undefined} style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} aria-hidden="true" />}
              {STANDARD.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  role="radio"
                  aria-checked={prefs.effort === e.id}
                  tabIndex={prefs.effort === e.id ? 0 : -1}
                  data-effort={e.id}
                  className="lvl"
                  onMouseEnter={() => setHoverEffort(e.id)}
                  onMouseLeave={() => setHoverEffort(null)}
                  onFocus={() => setHoverEffort(null)}
                  onClick={() => { prefs.setEffort(e.id); close(); }}
                >
                  {e.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              role="radio"
              aria-checked={ultra}
              aria-label="Ultracode"
              tabIndex={ultra ? 0 : -1}
              data-effort="ultracode"
              className="lvl-ultra"
              onMouseEnter={() => setHoverEffort("ultracode")}
              onMouseLeave={() => setHoverEffort(null)}
              onClick={() => { prefs.setEffort("ultracode"); close(); }}
            >
              <UltraPill active={ultra} />
            </button>
          </div>
          <p className="picker__note" id={`${ids}-note`} data-ultra={shownEffort === "ultracode" || undefined} key={shownEffort}>{note}</p>
        </div>
      )}
    </div>
  );
}
