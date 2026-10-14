import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import type { Point, StatsRange } from "../lib/types";
import { useReducedMotion } from "../lib/motion";
import {
  RANGE_MS, bucketMs, buildPaths, compact, easeOut, gapBreaks, lerp, nearest, niceTicks, parsePoints, pointLabel, timeTicks,
  type TPoint, type XY,
} from "./chart";

export interface TimeChartProps {
  points: Point[];
  range: StatsRange;
  /** The end of the window (the time of the data), ms. */
  end: number;
  /** Identifies the series (experience + range). A new key morphs or crossfades; the same key scrolls and rescales. */
  seriesKey: string;
  tone: "blue" | "green";
  /** Tooltip value, e.g. "1,204 players". */
  describe: (v: number) => ReactNode;
  /** Plain-text version of `describe` for screen readers. */
  describeText: (v: number) => string;
  /** Pulse the newest point while it is recent. */
  live?: boolean;
  /** Times before this were never recorded: shaded and labelled. */
  recordedFrom?: number | null;
  label: string;
  /** Shown over the empty plot when there are no points. */
  empty?: ReactNode;
  /** Draw-on delay for the first show, ms. */
  delay?: number;
}

const PAD = { r: 16, t: 18, b: 30 };
type Drawn = { key: string; w: number; h: number; domain: [number, number]; yMax: number; vals: Map<number, number>; px: XY[] };

/**
 * A time-series line + area chart drawn in pixel space (crisp at any size). Real points only, broken at gaps.
 * Geometry updates run in requestAnimationFrame and write path data directly, so polling, switching range and resizing
 * never re-render React per frame.
 */
export function TimeChart({ points, range, end, seriesKey, tone, describe, describeText, live, recordedFrom, label, empty, delay = 0 }: TimeChartProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      setSize((s) => (s && s.w === w && s.h === h ? s : w > 0 && h > 0 ? { w, h } : s));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---------- Target geometry ---------- */
  const pts = useMemo(() => parsePoints(points), [points]);
  const bucket = useMemo(() => bucketMs(pts, range), [pts, range]);
  const breaks = useMemo(() => gapBreaks(pts, bucket), [pts, bucket]);
  const domain = useMemo<[number, number]>(() => [end - RANGE_MS[range], end], [end, range]);
  const ticks = useMemo(() => niceTicks(pts.reduce((m, p) => Math.max(m, p.v), 0)), [pts]);
  const yMax = ticks[ticks.length - 1]!;
  const padL = useMemo(() => Math.max(28, Math.max(...ticks.map((t) => compact(t).length)) * 7.4 + 14), [ticks]);

  const geo = useMemo(() => {
    if (!size) return null;
    const plotW = Math.max(1, size.w - padL - PAD.r);
    const plotH = Math.max(1, size.h - PAD.t - PAD.b);
    const X = (t: number, d: [number, number]) => padL + ((t - d[0]) / (d[1] - d[0])) * plotW;
    const Y = (v: number, m: number) => PAD.t + (1 - v / m) * plotH;
    return { plotW, plotH, X, Y, base: PAD.t + plotH };
  }, [size, padL]);

  /* ---------- Imperative drawing ---------- */
  const lineRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const dotsRef = useRef<SVGPathElement>(null);
  const liveRef = useRef<SVGGElement>(null);
  const clipRef = useRef<SVGRectElement>(null);
  const plotRef = useRef<SVGGElement>(null);
  const drawn = useRef<Drawn | null>(null);
  const raf = useRef(0);
  const shownOnce = useRef(false);
  const [ghost, setGhost] = useState<{ id: number; line: string; area: string; dots: string } | null>(null);

  const lastIsLive = live && pts.length > 0 && end - pts[pts.length - 1]!.t <= bucket * 2.5;

  const paint = useCallback((px: XY[], brk: boolean[], base: number) => {
    const { line, area, dots } = buildPaths(px, brk, base);
    lineRef.current?.setAttribute("d", line);
    glowRef.current?.setAttribute("d", line);
    areaRef.current?.setAttribute("d", area);
    dotsRef.current?.setAttribute("d", dots);
    const last = px[px.length - 1];
    if (liveRef.current && last) liveRef.current.setAttribute("transform", `translate(${last.x.toFixed(2)},${last.y.toFixed(2)})`);
    if (drawn.current) drawn.current.px = px;
  }, []);

  useLayoutEffect(() => {
    if (!geo || !size) return;
    cancelAnimationFrame(raf.current);
    const { X, Y, base } = geo;
    const target = pts.map((p) => ({ x: X(p.t, domain), y: Y(p.v, yMax) }));
    const vals = new Map(pts.map((p) => [p.t, p.v]));
    const prev = drawn.current;
    const next: Drawn = { key: seriesKey, w: size.w, h: size.h, domain, yMax, vals, px: prev?.px ?? [] };
    drawn.current = next;

    const run = (ms: number, frame: (e: number) => void) => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / ms);
        frame(easeOut(p));
        if (p < 1) raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    };

    const resized = prev && (prev.w !== size.w || prev.h !== size.h);
    if (reduced || !prev || resized || (!shownOnce.current && !pts.length)) {
      paint(target, breaks, base);
      if (pts.length && !shownOnce.current) { shownOnce.current = true; if (!reduced) drawOn(); }
      return;
    }
    if (!shownOnce.current) {
      paint(target, breaks, base);
      shownOnce.current = true;
      drawOn();
      return;
    }
    if (prev.key === seriesKey) {
      // Same series, fresh data: scroll the window and rescale; values already shown stay put.
      const d0 = prev.domain;
      const m0 = prev.yMax;
      const v0 = prev.vals;
      run(900, (e) => {
        const dom: [number, number] = [lerp(d0[0], domain[0], e), lerp(d0[1], domain[1], e)];
        const ym = lerp(m0, yMax, e);
        const cur = new Map<number, number>();
        const px = pts.map((p) => {
          const o = v0.get(p.t);
          const v = o == null ? p.v : lerp(o, p.v, e);
          cur.set(p.t, v);
          return { x: X(p.t, dom), y: Y(v, ym) };
        });
        paint(px, breaks, base);
        if (drawn.current) { drawn.current.domain = dom; drawn.current.yMax = ym; drawn.current.vals = cur; }
      });
      if (drawn.current) { drawn.current.domain = d0; drawn.current.yMax = m0; drawn.current.vals = v0; }
      return;
    }
    const from = prev.px;
    if (from.length === target.length && target.length > 1) {
      // Same number of points: every point travels to its new place.
      run(820, (e) => paint(from.map((a, i) => ({ x: lerp(a.x, target[i]!.x, e), y: lerp(a.y, target[i]!.y, e) })), breaks, base));
      return;
    }
    // Different shapes: the old series dissolves through a blur while the new one resolves.
    const old = { line: lineRef.current?.getAttribute("d") ?? "", area: areaRef.current?.getAttribute("d") ?? "", dots: dotsRef.current?.getAttribute("d") ?? "" };
    if (old.line || old.area || old.dots) setGhost((g) => ({ id: (g?.id ?? 0) + 1, ...old }));
    paint(target, breaks, base);
    plotRef.current?.animate(
      [{ opacity: 0, filter: "blur(10px)", transform: "translateY(6px)" }, { opacity: 1, filter: "blur(0px)", transform: "none" }],
      { duration: 620, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
  }, [geo, pts, breaks, domain, yMax, seriesKey, reduced, paint]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  function drawOn() {
    const line = lineRef.current;
    const glow = glowRef.current;
    if (!line) return;
    const L = Math.ceil(line.getTotalLength()) + 2;
    const opts: KeyframeAnimationOptions = { duration: 1500, delay, easing: "cubic-bezier(0.65, 0, 0.25, 1)", fill: "backwards" };
    for (const p of [line, glow]) {
      if (!p) continue;
      p.style.strokeDasharray = `${L} ${L}`;
      const a = p.animate([{ strokeDashoffset: L, filter: "url(#mb-x-soft)" }, { strokeDashoffset: L * 0.08, filter: "url(#mb-x-soft)", offset: 0.85 }, { strokeDashoffset: 0, filter: "none" }], opts);
      a.onfinish = () => { p.style.strokeDasharray = ""; };
    }
    clipRef.current?.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], opts);
    dotsRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts, duration: 900, delay: delay + 700 });
    liveRef.current?.firstElementChild?.animate([{ opacity: 0, transform: "scale(0)" }, { opacity: 1, transform: "scale(1)" }], { duration: 520, delay: delay + 1350, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", fill: "backwards" });
  }

  /* ---------- Hover / keyboard crosshair ---------- */
  const [hover, setHover] = useState<number | null>(null);
  const crossRef = useRef<SVGGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const spring = useRef<{ x: number; y: number; vx: number; vy: number; on: boolean; raf: number }>({ x: 0, y: 0, vx: 0, vy: 0, on: false, raf: 0 });
  const hoverRef = useRef<number | null>(null);
  hoverRef.current = hover;

  const placeCross = useCallback((x: number, y: number) => {
    crossRef.current?.setAttribute("transform", `translate(${x.toFixed(2)},0)`);
    const dot = crossRef.current?.querySelector("circle");
    dot?.setAttribute("cy", y.toFixed(2));
    const tip = tipRef.current;
    if (tip && size) {
      const tw = tip.offsetWidth;
      const tx = Math.max(0, Math.min(size.w - tw, x - tw / 2));
      tip.style.transform = `translate(${tx.toFixed(1)}px, 0)`;
    }
  }, [size]);

  useEffect(() => {
    const s = spring.current;
    cancelAnimationFrame(s.raf);
    if (hover == null) { s.on = false; return; }
    const at = () => drawn.current?.px[hoverRef.current ?? -1];
    const first = at();
    if (!first) return;
    if (!s.on || reduced) { s.x = first.x; s.y = first.y; s.vx = 0; s.vy = 0; s.on = true; placeCross(s.x, s.y); }
    let last = performance.now();
    const k = 420;
    const c = 2 * Math.sqrt(k) * 0.92;
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const t = at();
      if (!t) return;
      for (let i = 0; i < 2; i++) {
        const h = dt / 2;
        s.vx += (k * (t.x - s.x) - c * s.vx) * h;
        s.vy += (k * (t.y - s.y) - c * s.vy) * h;
        s.x += s.vx * h;
        s.y += s.vy * h;
      }
      if (reduced) { s.x = t.x; s.y = t.y; }
      placeCross(s.x, s.y);
      s.raf = requestAnimationFrame(tick);
    };
    s.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(s.raf);
  }, [hover, reduced, placeCross]);

  const onMove = (e: PointerEvent) => {
    const px = drawn.current?.px;
    if (!px?.length || !wrapRef.current) return;
    const x = e.clientX - wrapRef.current.getBoundingClientRect().left;
    const i = nearest(px, x);
    if (i !== hoverRef.current) setHover(i);
  };
  const onKey = (e: KeyboardEvent) => {
    if (!pts.length) return;
    const cur = hover ?? pts.length;
    let n: number | null = null;
    if (e.key === "ArrowLeft") n = Math.max(0, cur - 1);
    else if (e.key === "ArrowRight") n = Math.min(pts.length - 1, (hover ?? pts.length - 2) + 1);
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = pts.length - 1;
    else if (e.key === "Escape" && hover != null) { e.preventDefault(); setHover(null); return; }
    else return;
    e.preventDefault();
    setHover(n);
  };
  useEffect(() => { if (hover != null && hover >= pts.length) setHover(pts.length ? pts.length - 1 : null); }, [pts.length, hover]);

  const hp: TPoint | undefined = hover != null ? pts[hover] : undefined;

  /* ---------- Static layers ---------- */
  const xTicks = useMemo(() => (geo ? timeTicks(domain[0], domain[1], geo.plotW, range) : []), [geo, domain, range]);
  const recordX = geo && recordedFrom != null && recordedFrom > domain[0] ? Math.min(geo.X(recordedFrom, domain), padL + geo.plotW) : null;

  return (
    <div
      ref={wrapRef}
      className="tchart"
      data-tone={tone}
      tabIndex={0}
      role="group"
      aria-label={`${label}. ${pts.length ? `${pts.length} recorded points. Use the left and right arrow keys to read them.` : "No recorded points."}`}
      onKeyDown={onKey}
      onBlur={() => setHover(null)}
      onFocus={(e) => { if (hover == null && pts.length && e.currentTarget.matches(":focus-visible")) setHover(pts.length - 1); }}
    >
      {size && geo && (
        <svg className="tchart__svg" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}fill`} x1="0" y1={PAD.t} x2="0" y2={geo.base} gradientUnits="userSpaceOnUse">
              <stop offset="0%" className="tchart__stop-a" />
              <stop offset="100%" className="tchart__stop-b" />
            </linearGradient>
            <filter id={`${uid}glow`} x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="5" /></filter>
            <clipPath id={`${uid}clip`}>
              <rect ref={clipRef} className="tchart__cliprect" x={padL - 6} y={0} width={geo.plotW + 12} height={size.h} />
            </clipPath>
          </defs>

          {recordX != null && recordX > padL + 1 && (
            <g className="tchart__unrecorded">
              <rect x={padL} y={PAD.t} width={recordX - padL} height={geo.plotH} rx={10} />
              {recordX - padL > 150 && <text x={padL + (recordX - padL) / 2} y={PAD.t + geo.plotH / 2}>Before recording began</text>}
            </g>
          )}

          <g key={`y${yMax}`} className="tchart__grid">
            {ticks.map((t) => (
              <g key={t} transform={`translate(0,${geo.Y(t, yMax).toFixed(1)})`}>
                <line x1={padL} x2={padL + geo.plotW} data-zero={t === 0 || undefined} />
                {pts.length > 0 && <text x={padL - 12} dy="0.32em">{compact(t)}</text>}
              </g>
            ))}
          </g>
          <g className="tchart__x">
            {xTicks.map((t) => {
              const x = geo.X(t.t, domain);
              const anchor = x < padL + 24 ? "start" : x > padL + geo.plotW - 24 ? "end" : "middle";
              return <text key={t.t} style={{ transform: `translate(${x.toFixed(1)}px, ${(geo.base + 20).toFixed(1)}px)` }} textAnchor={anchor}>{t.label}</text>;
            })}
          </g>

          {ghost && (
            <g key={ghost.id} className="tchart__ghost" onAnimationEnd={() => setGhost(null)}>
              <path d={ghost.area} className="tchart__area" fill={`url(#${uid}fill)`} />
              <path d={ghost.line} className="tchart__line" />
              <path d={ghost.dots} className="tchart__dots" />
            </g>
          )}

          <g ref={plotRef} clipPath={`url(#${uid}clip)`}>
            <path ref={areaRef} className="tchart__area" fill={`url(#${uid}fill)`} />
            <path ref={glowRef} className="tchart__glow" filter={`url(#${uid}glow)`} />
            <path ref={lineRef} className="tchart__line" />
            <path ref={dotsRef} className="tchart__dots" />
          </g>
          <g ref={liveRef} className="tchart__live" style={{ display: lastIsLive ? undefined : "none" }}>
            <g>
              <circle className="tchart__live-ring" r={5} />
              <circle className="tchart__live-dot" r={4.5} />
            </g>
          </g>

          <g ref={crossRef} className="tchart__cross" data-on={hp ? "" : undefined}>
            <line y1={PAD.t - 6} y2={geo.base} />
            <circle r={5.5} />
          </g>
        </svg>
      )}

      {!pts.length && size && empty && <div className="tchart__empty">{empty}</div>}

      <div className="tchart__hit" style={{ left: padL, right: PAD.r, top: 0, bottom: PAD.b }} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} aria-hidden="true" />

      <div ref={tipRef} className="tchart__tip" data-on={hp ? "" : undefined} aria-hidden="true">
        {hp && (
          <>
            <span className="tchart__tip-t">{pointLabel(hp.t, range, bucket)}</span>
            <span className="tchart__tip-v">{describe(hp.v)}</span>
          </>
        )}
      </div>
      <span className="sr-only" aria-live="polite">{hp ? `${pointLabel(hp.t, range, bucket)}: ${describeText(hp.v)}` : ""}</span>
    </div>
  );
}
