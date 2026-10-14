import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { RollingNumber } from "../ui/RollingNumber";
import { Button } from "../ui";
import { useReducedMotion } from "../lib/motion";
import robux from "../assets/robux.png";
import { agoLabel } from "./chart";

/** A RollingNumber that, on its first appearance, rolls up from zeros in every column to the real value. */
export function RollIn({ value, className, delay = 0, format = (n: number) => Math.round(n).toLocaleString("en-US") }: { value: number; className?: string; delay?: number; format?: (n: number) => string }) {
  const reduced = useReducedMotion();
  const [armed, setArmed] = useState(reduced);
  useEffect(() => {
    if (armed) return;
    const t = window.setTimeout(() => setArmed(true), 60 + delay);
    return () => window.clearTimeout(t);
  }, [armed, delay]);
  const fmt = armed ? format : (n: number) => format(n).replace(/\d/g, "0");
  return <RollingNumber value={value} format={fmt} className={className} durationMs={armed ? 1100 : 900} />;
}

export function RobuxIcon({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return <img className="rbx-ico" src={robux} alt="" aria-hidden="true" style={{ width: size, height: size * 1.1, ...style }} />;
}

/** "12 s ago", kept fresh. */
export function Ago({ t, prefix = "" }: { t: number; prefix?: string }) {
  const [, setN] = useState(0);
  useEffect(() => {
    const i = window.setInterval(() => setN((n) => n + 1), 5000);
    return () => window.clearInterval(i);
  }, []);
  return <>{prefix}{agoLabel(t)}</>;
}

export function Shimmer({ w = "100%", h = 14, r = 999, style }: { w?: number | string; h?: number | string; r?: number; style?: CSSProperties }) {
  return <span className="shim" aria-hidden="true" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

export function CardError({ message, onRetry, children }: { message: string; onRetry: () => void; children?: ReactNode }) {
  return (
    <div className="card-err" role="alert">
      <p className="card-err__t">{message}</p>
      <p className="card-err__b">Nothing is shown in its place, so no number on this page is out of date.</p>
      {children}
      <Button size="sm" variant="secondary" onClick={onRetry}>Retry</Button>
    </div>
  );
}
