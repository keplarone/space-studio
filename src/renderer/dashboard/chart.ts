import type { Point, StatsRange } from "../lib/types";

/**
 * Pure geometry for the dashboard charts. Everything is computed in pixel space from real points only:
 * no resampling, no filling in. A run of points is broken into separate segments wherever the time between two
 * neighbours is longer than 2.5 buckets, so hours with no data stay empty instead of being bridged by a line.
 */

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export const RANGE_MS: Record<StatsRange, number> = { "1h": HOUR, "24h": DAY, "7d": 7 * DAY, "30d": 30 * DAY, "90d": 90 * DAY };
export const RANGE_LABEL: Record<StatsRange, string> = { "1h": "last hour", "24h": "last 24 hours", "7d": "last 7 days", "30d": "last 30 days", "90d": "last 90 days" };
export const RANGES: StatsRange[] = ["1h", "24h", "7d", "30d", "90d"];

/** keplar.one always records at least hourly (minutely while someone watches), so a bucket is never finer than that baseline. */
const BUCKET_FLOOR: Record<StatsRange, number> = { "1h": MIN, "24h": HOUR, "7d": HOUR, "30d": HOUR, "90d": HOUR };

export interface TPoint { t: number; v: number }

export function parsePoints(points: Point[]): TPoint[] {
  const out: TPoint[] = [];
  for (const p of points) {
    const t = Date.parse(p.t);
    if (Number.isFinite(t) && Number.isFinite(p.v)) out.push({ t, v: p.v });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** The series' bucket: the median spacing of its points, never finer than the recording baseline for the range. */
export function bucketMs(pts: TPoint[], range: StatsRange): number {
  const floor = BUCKET_FLOOR[range];
  if (pts.length < 3) return floor;
  const d: number[] = [];
  for (let i = 1; i < pts.length; i++) d.push(pts[i]!.t - pts[i - 1]!.t);
  d.sort((a, b) => a - b);
  return Math.max(floor, d[Math.floor(d.length / 2)]!);
}

/** breaks[i] is true when point i starts a new segment (a gap of more than 2.5 buckets precedes it). */
export function gapBreaks(pts: TPoint[], bucket: number): boolean[] {
  return pts.map((p, i) => i === 0 || p.t - pts[i - 1]!.t > bucket * 2.5);
}

/** Round axis ticks from 0: steps of 1, 2, 2.5 or 5 x 10^n, at least `minTop` high (so 3 players doesn't fill the chart). */
export function niceTicks(max: number, count = 4, minTop = 4): number[] {
  const m = Math.max(max, minTop);
  const raw = m / count;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = ([1, 2, 2.5, 5, 10].map((k) => k * pow).find((s) => s >= raw) ?? 10 * pow);
  const top = Math.ceil(m / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}

export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${+(n / 1e9).toFixed(a >= 1e10 ? 0 : 1)}B`;
  if (a >= 1e6) return `${+(n / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e4) return `${+(n / 1e3).toFixed(0)}K`;
  if (a >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return `${+n.toFixed(a < 10 && n % 1 ? 1 : 0)}`;
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");

const hm = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const wd = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const md = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const wmd = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

/** The time of one point, as precise as its bucket. */
export function pointLabel(t: number, range: StatsRange, bucket: number): string {
  const d = new Date(t);
  if (range === "1h") return hm.format(d);
  if (range === "24h") return `${wd.format(d)} ${hm.format(d)}`;
  if (bucket >= DAY) return wmd.format(d);
  return `${wmd.format(d)} · ${hm.format(d)}`;
}

export function sinceLabel(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return Date.now() - t < DAY ? `today ${hm.format(d)}` : `${md.format(d)}, ${hm.format(d)}`;
}

export function agoLabel(t: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s} s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

const STEPS = [5 * MIN, 10 * MIN, 15 * MIN, 30 * MIN, HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 7 * DAY, 14 * DAY, 28 * DAY];

/** X-axis ticks on round local times, as many as fit (about one per `minGap` pixels). */
export function timeTicks(start: number, end: number, width: number, range: StatsRange, minGap = 84): { t: number; label: string }[] {
  const fit = Math.max(2, Math.floor(width / minGap));
  const span = end - start;
  const step = STEPS.find((s) => span / s <= fit) ?? STEPS[STEPS.length - 1]!;
  const out: { t: number; label: string }[] = [];
  if (step < DAY) {
    const d = new Date(start);
    d.setSeconds(0, 0);
    const stepMin = step / MIN;
    const mins = d.getHours() * 60 + d.getMinutes();
    d.setHours(0, Math.ceil(mins / stepMin) * stepMin, 0, 0);
    for (let t = d.getTime(); t <= end; ) {
      const x = new Date(t);
      const midnight = x.getHours() === 0 && x.getMinutes() === 0;
      out.push({ t, label: midnight && range !== "1h" ? wd.format(x) : hm.format(x) });
      x.setMinutes(x.getMinutes() + stepMin);
      t = x.getTime();
    }
  } else {
    const days = Math.round(step / DAY);
    const d = new Date(start);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() < start) d.setDate(d.getDate() + 1);
    if (days === 7 || days === 14 || days === 28) while (d.getDay() !== 1) d.setDate(d.getDate() + 1); // weeks start on Monday
    for (; d.getTime() <= end; d.setDate(d.getDate() + days)) out.push({ t: d.getTime(), label: range === "7d" && days === 1 ? wd.format(d) : md.format(d) });
  }
  return out;
}

export interface XY { x: number; y: number }

/**
 * A smooth path through each segment using monotone cubic interpolation (Fritsch-Carlson), which never overshoots:
 * the curve between two samples stays between their values, so it can't invent a peak or dip that wasn't measured.
 * Single-point segments are returned separately to be drawn as dots.
 */
export function buildPaths(px: XY[], breaks: boolean[], baseline: number): { line: string; area: string; dots: string } {
  let line = "";
  let area = "";
  let dots = "";
  const f = (n: number) => n.toFixed(2);
  let i = 0;
  while (i < px.length) {
    let j = i + 1;
    while (j < px.length && !breaks[j]) j++;
    const seg = px.slice(i, j);
    if (seg.length === 1) {
      const p = seg[0]!;
      dots += `M${f(p.x - 2.6)},${f(p.y)}a2.6,2.6 0 1,0 5.2,0a2.6,2.6 0 1,0 -5.2,0`;
    } else {
      const d = monotone(seg);
      line += d;
      area += `${d}L${f(seg[seg.length - 1]!.x)},${f(baseline)}L${f(seg[0]!.x)},${f(baseline)}Z`;
    }
    i = j;
  }
  return { line, area, dots };
}

function monotone(p: XY[]): string {
  const n = p.length;
  const f = (v: number) => v.toFixed(2);
  if (n === 2) return `M${f(p[0]!.x)},${f(p[0]!.y)}L${f(p[1]!.x)},${f(p[1]!.y)}`;
  const dx: number[] = [];
  const s: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const h = p[i + 1]!.x - p[i]!.x || 1e-6;
    dx.push(h);
    s.push((p[i + 1]!.y - p[i]!.y) / h);
  }
  const m: number[] = [s[0]!];
  for (let i = 1; i < n - 1; i++) {
    if (s[i - 1]! * s[i]! <= 0) m.push(0);
    else {
      const w1 = 2 * dx[i]! + dx[i - 1]!;
      const w2 = dx[i]! + 2 * dx[i - 1]!;
      m.push((w1 + w2) / (w1 / s[i - 1]! + w2 / s[i]!));
    }
  }
  m.push(s[n - 2]!);
  let d = `M${f(p[0]!.x)},${f(p[0]!.y)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i]!;
    d += `C${f(p[i]!.x + h / 3)},${f(p[i]!.y + (m[i]! * h) / 3)} ${f(p[i + 1]!.x - h / 3)},${f(p[i + 1]!.y - (m[i + 1]! * h) / 3)} ${f(p[i + 1]!.x)},${f(p[i + 1]!.y)}`;
  }
  return d;
}

/** Index of the point nearest to x (points sorted by x). */
export function nearest(px: XY[], x: number): number {
  if (!px.length) return -1;
  let lo = 0;
  let hi = px.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (px[mid]!.x < x) lo = mid;
    else hi = mid;
  }
  return Math.abs(px[lo]!.x - x) <= Math.abs(px[hi]!.x - x) ? lo : hi;
}

export const easeOut = (p: number) => 1 - Math.pow(1 - p, 4);
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
