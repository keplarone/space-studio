import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useReducedMotion } from "../lib/motion";

interface TourStep {
  id: string;
  selectors: string[];
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  { id: "profile", selectors: ['[data-tour="profile"]'], title: "Your account", body: "Your picture and name. Hover to see your plan and the credits you have left." },
  { id: "nav", selectors: ['[data-tour="nav"]'], title: "Everything in one bar", body: "Jump between Home, your Dashboard, Roblox Studio, Blender, Cloud, Plans and Account." },
  { id: "robux", selectors: ['[data-tour="robux"]'], title: "Robux, live", body: "Robux your experiences earn. Hover to watch pending Robux count up live." },
  { id: "prompt", selectors: ['[data-tour="prompt"]'], title: "Ask for anything", body: "Describe what you want. Pick a model and effort, then send — every prompt jumps to warp." },
  {
    id: "dashboard",
    selectors: ['[data-tour="dashboard"]', '[data-tour="nav"] [data-id="dashboard"]'],
    title: "Your games, live",
    body: "Live players and revenue from your games.",
  },
];

const PAD = 8;
const GAP = 18;
const MARGIN = 16;

function find(step: TourStep): HTMLElement | null {
  for (const s of step.selectors) {
    const el = document.querySelector<HTMLElement>(s);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

/* ---------- A tiny spring integrator driving SVG attributes and one transform, outside React ---------- */

interface Spring { x: number; v: number; t: number; k: number; c: number }
const spring = (x: number, k: number, c: number): Spring => ({ x, v: 0, t: x, k, c });

type Keys = "hx" | "hy" | "hw" | "hh" | "hr" | "cx" | "cy";

/**
 * First-run coach marks. The dim layer is an SVG mask with a rounded hole that springs from target to target; while it travels
 * the hole is blurred along its direction of motion (velocity-driven feGaussianBlur), and the glass card flies after it with the
 * same treatment, lagging a little so the two read as one gesture. Esc skips, arrows move, focus stays on the card.
 */
export function Tutorial({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [closing, setClosing] = useState(false);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });

  const cardRef = useRef<HTMLDivElement>(null);
  const holeRef = useRef<SVGRectElement>(null);
  const glowRef = useRef<SVGRectElement>(null);
  const holeBlur = useRef<SVGFEGaussianBlurElement>(null);
  const cardBlur = useRef<SVGFEGaussianBlurElement>(null);
  const prevFocus = useRef<Element | null>(null);
  const raf = useRef(0);
  const last = useRef(0);
  const done = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const s = useRef<Record<Keys, Spring>>({
    hx: spring(-PAD, 170, 23), hy: spring(-PAD, 170, 23), hw: spring(window.innerWidth + PAD * 2, 170, 23), hh: spring(window.innerHeight + PAD * 2, 170, 23),
    hr: spring(40, 170, 23), cx: spring(window.innerWidth / 2 - 180, 120, 19), cy: spring(window.innerHeight / 2, 120, 19),
  });

  // Find the steps once the shell has settled (two frames), and remember where focus was.
  useEffect(() => {
    prevFocus.current = document.activeElement;
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        const found = STEPS.filter((st) => find(st));
        if (!found.length) { done.current = true; onDoneRef.current(); return; }
        setSteps(found);
      });
    });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, []);

  const paint = useCallback(() => {
    const v = s.current;
    const w = Math.max(0, v.hw.x), h = Math.max(0, v.hh.x);
    const rx = Math.max(0, Math.min(v.hr.x, w / 2, h / 2));
    for (const el of [holeRef.current, glowRef.current]) {
      if (!el) continue;
      el.setAttribute("x", v.hx.x.toFixed(2));
      el.setAttribute("y", v.hy.x.toFixed(2));
      el.setAttribute("width", w.toFixed(2));
      el.setAttribute("height", h.toFixed(2));
      el.setAttribute("rx", rx.toFixed(2));
    }
    // Directional blur from the hole's centre velocity (px/s).
    const vx = v.hx.v + v.hw.v / 2, vy = v.hy.v + v.hh.v / 2;
    const bx = Math.min(22, Math.abs(vx) / 70), by = Math.min(22, Math.abs(vy) / 70);
    // The blur only exists while the hole travels; at rest the mask is a plain shape (cheap to repaint).
    const hole = holeRef.current;
    if (bx + by > 0.2) {
      holeBlur.current?.setAttribute("stdDeviation", `${bx.toFixed(2)} ${by.toFixed(2)}`);
      if (hole && !hole.hasAttribute("filter")) hole.setAttribute("filter", "url(#tour-hole-mb)");
    } else if (hole?.hasAttribute("filter")) hole.removeAttribute("filter");
    const card = cardRef.current;
    if (card) {
      card.style.transform = `translate3d(${v.cx.x.toFixed(2)}px, ${v.cy.x.toFixed(2)}px, 0)`;
      const cbx = Math.min(10, Math.abs(v.cx.v) / 120), cby = Math.min(10, Math.abs(v.cy.v) / 120);
      if (cbx + cby > 0.35) {
        cardBlur.current?.setAttribute("stdDeviation", `${cbx.toFixed(2)} ${cby.toFixed(2)}`);
        card.style.filter = "url(#tour-card-mb)";
      } else card.style.filter = "";
    }
  }, []);

  const tick = useCallback((now: number) => {
    // Real elapsed time (capped), integrated in small fixed steps so a dropped frame never slows or destabilises the motion.
    const dt = Math.min(0.1, (now - (last.current || now)) / 1000) || 1 / 60;
    last.current = now;
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    let moving = false;
    for (const sp of Object.values(s.current)) {
      for (let k = 0; k < n; k++) {
        const a = -sp.k * (sp.x - sp.t) - sp.c * sp.v;
        sp.v += a * h;
        sp.x += sp.v * h;
      }
      if (Math.abs(sp.x - sp.t) > 0.15 || Math.abs(sp.v) > 1.5) moving = true;
      else { sp.x = sp.t; sp.v = 0; }
    }
    paint();
    raf.current = moving ? requestAnimationFrame(tick) : 0;
    if (!moving) last.current = 0;
  }, [paint]);

  const kick = useCallback(() => {
    if (reduced) {
      for (const sp of Object.values(s.current)) { sp.x = sp.t; sp.v = 0; }
      paint();
      return;
    }
    if (!raf.current) { paint(); raf.current = requestAnimationFrame(tick); }
  }, [reduced, paint, tick]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  /** Aim the hole at the current target and the card beside it. */
  const place = useCallback(() => {
    if (!steps) return;
    const step = steps[i];
    const el = step ? find(step) : null;
    const card = cardRef.current;
    const W = window.innerWidth, H = window.innerHeight;
    const v = s.current;
    if (closing || !el) {
      v.hx.t = -PAD * 4; v.hy.t = -PAD * 4; v.hw.t = W + PAD * 8; v.hh.t = H + PAD * 8; v.hr.t = 60;
      kick();
      return;
    }
    const r = el.getBoundingClientRect();
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 14;
    v.hx.t = r.left - PAD; v.hy.t = r.top - PAD; v.hw.t = r.width + PAD * 2; v.hh.t = r.height + PAD * 2; v.hr.t = radius + PAD;
    if (card) {
      const cw = card.offsetWidth, ch = card.offsetHeight;
      let y = r.bottom + PAD + GAP;
      if (y + ch > H - MARGIN) {
        const above = r.top - PAD - GAP - ch;
        y = above >= MARGIN ? above : Math.max(MARGIN, Math.min(H - ch - MARGIN, r.top + r.height / 2 - ch / 2));
      }
      const x = Math.max(MARGIN, Math.min(W - cw - MARGIN, r.left + r.width / 2 - cw / 2));
      v.cx.t = x; v.cy.t = y;
    }
    kick();
  }, [steps, i, closing, kick]);

  useLayoutEffect(place, [place]);

  useEffect(() => {
    const onResize = () => { setVp({ w: window.innerWidth, h: window.innerHeight }); place(); };
    window.addEventListener("resize", onResize);
    const step = steps?.[i];
    const el = step ? find(step) : null;
    const ro = el && typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => place()) : null;
    if (el) ro?.observe(el);
    return () => { window.removeEventListener("resize", onResize); ro?.disconnect(); };
  }, [place, steps, i]);

  // Focus the card on every step so screen readers read it, and keyboard users act on it directly.
  useEffect(() => {
    if (steps && !closing) cardRef.current?.focus({ preventScroll: true });
  }, [steps, i, closing]);

  const finish = useCallback(() => {
    if (done.current) return;
    setClosing(true);
    window.setTimeout(() => {
      if (done.current) return;
      done.current = true;
      const p = prevFocus.current;
      if (p instanceof HTMLElement && p.isConnected && p !== document.body) p.focus({ preventScroll: true });
      onDoneRef.current();
    }, reduced ? 0 : 520);
  }, [reduced]);

  const count = steps?.length ?? 0;
  const go = useCallback((d: number) => {
    if (!steps || closing) return;
    const n = i + d;
    if (n < 0) return;
    if (n >= steps.length) { finish(); return; }
    setDir(d);
    setI(n);
  }, [steps, i, closing, finish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [finish, go]);

  // Keep Tab inside the card.
  const trap = (e: ReactKeyboardEvent) => {
    if (e.key !== "Tab") return;
    const items = Array.from(cardRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? []);
    if (!items.length) return;
    const first = items[0]!, lastItem = items[items.length - 1]!;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === cardRef.current)) { e.preventDefault(); lastItem.focus(); }
    else if (!e.shiftKey && document.activeElement === lastItem) { e.preventDefault(); first.focus(); }
  };

  if (!steps) return null;
  const step = steps[i]!;
  const isLast = i === count - 1;

  return (
    <div className="tour" data-state={closing ? "out" : "in"}>
      <svg className="tour__dim" width={vp.w} height={vp.h} viewBox={`0 0 ${vp.w} ${vp.h}`} aria-hidden="true" focusable="false">
        <defs>
          <filter id="tour-hole-mb" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
            <feGaussianBlur ref={holeBlur} stdDeviation="0" />
          </filter>
          <filter id="tour-card-mb" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur ref={cardBlur} stdDeviation="0" />
          </filter>
          <mask id="tour-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={vp.w} height={vp.h}>
            <rect x="0" y="0" width={vp.w} height={vp.h} fill="#fff" />
            <rect ref={holeRef} fill="#000" />
          </mask>
        </defs>
        <rect className="tour__shade" x="0" y="0" width={vp.w} height={vp.h} mask="url(#tour-mask)" />
      </svg>
      {/* The halo lives in its own layer so its breathing is a compositor-only opacity change. */}
      <svg className="tour__halo" width={vp.w} height={vp.h} viewBox={`0 0 ${vp.w} ${vp.h}`} aria-hidden="true" focusable="false">
        <defs>
          <filter id="tour-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>
        <rect ref={glowRef} className="tour__glow" fill="none" filter="url(#tour-glow)" />
      </svg>

      <div
        ref={cardRef}
        className="tour__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        onKeyDown={trap}
      >
        <div key={step.id} className="tour__content" data-dir={dir}>
          <span className="tour__count">{i + 1} of {count}</span>
          <h2 id="tour-title" className="tour__title">{step.title}</h2>
          <p id="tour-body" className="tour__body">{step.body}</p>
        </div>
        <div className="tour__foot">
          <div className="tour__dots" aria-hidden="true">
            {steps.map((st, n) => <i key={st.id} data-on={n === i || undefined} />)}
          </div>
          <button type="button" className="tour__skip" onClick={finish}>Skip tour</button>
          {i > 0 && <button type="button" className="tour__back" onClick={() => go(-1)}>Back</button>}
          <button type="button" className="tour__next btn3d" onClick={() => go(1)}>{isLast ? "Start building" : "Next"}</button>
        </div>
      </div>
    </div>
  );
}
