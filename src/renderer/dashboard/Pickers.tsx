import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Popover } from "../ui";
import type { Experience, StatsRange } from "../lib/types";
import { RANGES } from "./chart";

/** An experience's Roblox icon, or its initial on a tinted tile while there is none. */
export function ExpIcon({ exp, size = 28 }: { exp: Pick<Experience, "name" | "iconUrl" | "universeId"> | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, borderRadius: Math.round(size * 0.3) };
  if (exp?.iconUrl && !broken) return <img className="exp-icon" src={exp.iconUrl} alt="" style={style} referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  const hue = exp ? [...exp.universeId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7) : 260;
  return (
    <span className="exp-icon exp-icon--mono" aria-hidden="true" style={{ ...style, fontSize: size * 0.42, ["--h" as string]: hue }}>
      {(exp?.name.trim().charAt(0) || "?").toUpperCase()}
    </span>
  );
}

/** "All experiences": up to three icons fanned out. */
export function AllIcon({ list, size = 28 }: { list: Experience[]; size?: number }) {
  const few = list.slice(0, 3);
  if (!few.length) return <span className="exp-icon exp-icon--all" style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }} aria-hidden="true" />;
  return (
    <span className="exp-stack" style={{ width: size + (few.length - 1) * size * 0.32, height: size }} aria-hidden="true">
      {few.map((e, i) => (
        <span key={e.universeId} style={{ left: i * size * 0.32, zIndex: 3 - i }}><ExpIcon exp={e} size={size} /></span>
      ))}
    </span>
  );
}

export function ExperiencePicker({ list, value, onChange }: { list: Experience[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const cur = list.find((e) => e.universeId === value) ?? null;
  const options: { id: string; name: string; exp: Experience | null; note: string }[] = [
    { id: "all", name: "All experiences", exp: null, note: `${list.length} tracked` },
    ...list.map((e) => ({ id: e.universeId, name: e.name, exp: e, note: e.beacon.connected ? "Beacon connected" : "Beacon waiting" })),
  ];
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>("[role=option]")];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };
  return (
    <>
      <button ref={btn} type="button" className="xpick" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {cur ? <ExpIcon exp={cur} size={30} /> : <AllIcon list={list} size={30} />}
        <span className="xpick__text">
          <span className="xpick__k">Experience</span>
          <span className="xpick__v">{cur ? cur.name : "All experiences"}</span>
        </span>
        <span className="xpick__chev" data-open={open || undefined} aria-hidden="true" />
      </button>
      {createPortal(<Popover open={open} onClose={() => setOpen(false)} anchorRef={btn} label="Choose an experience" role="listbox" width={320} align="start">
        <div className="xpick__list" onKeyDown={onKey}>
          {options.map((o, i) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={o.id === value}
              data-autofocus={o.id === value || undefined}
              className="xpick__opt"
              style={{ animationDelay: `${i * 28}ms` }}
              onClick={() => { onChange(o.id); setOpen(false); btn.current?.focus(); }}
            >
              {o.exp ? <ExpIcon exp={o.exp} size={34} /> : <AllIcon list={list} size={34} />}
              <span className="xpick__text">
                <span className="xpick__v">{o.name}</span>
                <span className="xpick__k">{o.note}</span>
              </span>
              {o.id === value && <span className="xpick__tick" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </Popover>, document.body)}
    </>
  );
}

const RANGE_TEXT: Record<StatsRange, string> = { "1h": "1H", "24h": "24H", "7d": "7D", "30d": "30D", "90d": "90D" };
const RANGE_NAME: Record<StatsRange, string> = { "1h": "Last hour", "24h": "Last 24 hours", "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days" };

/** The timeframe: a pill radio group whose white indicator springs between options with a horizontal motion blur. */
export function RangePicker({ value, onChange }: { value: StatsRange; onChange: (r: StatsRange) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);
  const [moving, setMoving] = useState(false);
  const timer = useRef(0);
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current?.querySelector<HTMLElement>(`[data-v="${value}"]`);
      if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => ro.disconnect();
  }, [value]);
  const pick = (r: StatsRange) => {
    if (r === value) return;
    setMoving(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMoving(false), 460);
    onChange(r);
  };
  const onKey = (e: KeyboardEvent) => {
    const i = RANGES.indexOf(value);
    let n = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % RANGES.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i - 1 + RANGES.length) % RANGES.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = RANGES.length - 1;
    if (n < 0) return;
    e.preventDefault();
    pick(RANGES[n]!);
    ref.current?.querySelector<HTMLElement>(`[data-v="${RANGES[n]}"]`)?.focus();
  };
  return (
    <div className="rpick" role="radiogroup" aria-label="Timeframe" ref={ref} onKeyDown={onKey}>
      {ind && <span className="rpick__ind" data-moving={moving || undefined} style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} aria-hidden="true" />}
      {RANGES.map((r) => (
        <button key={r} type="button" role="radio" aria-checked={r === value} aria-label={RANGE_NAME[r]} tabIndex={r === value ? 0 : -1} data-v={r} className="rpick__opt" onClick={() => pick(r)}>
          {RANGE_TEXT[r]}
        </button>
      ))}
    </div>
  );
}
