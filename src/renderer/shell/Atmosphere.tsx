import { useEffect, useState } from "react";
import { fx } from "../lib/fx";

/** Purple aura colours: each prompt moves to the next one, crossfading over two seconds. */
export const AURAS = ["rgb(176, 104, 255)", "rgb(150, 140, 255)", "rgb(196, 96, 236)", "rgb(214, 110, 220)", "rgb(170, 118, 250)"] as const;

/**
 * The slight purple aura over the star field, plus a lens-shaped shockwave that bursts from the centre on every prompt.
 * Two identical keyframe names alternate so the burst restarts each time.
 */
export function Aura() {
  const [i, setI] = useState(0);
  const [jumps, setJumps] = useState(0);
  useEffect(() => fx.onAura(() => { setI((n) => (n + 1) % AURAS.length); setJumps((n) => n + 1); }), []);
  const color = AURAS[i]!;
  return (
    <>
      <div className="aura" aria-hidden="true" style={{ backgroundColor: color }} data-flare={jumps ? (jumps % 2 ? "a" : "b") : undefined} />
      {jumps > 0 && <div key={jumps} className="shockwave" aria-hidden="true" style={{ ["--wave" as string]: color }} />}
    </>
  );
}

/**
 * SVG filters for directional motion blur, referenced from CSS (filter: url(#mb-x)). Their strength is animated by the
 * elements that use them through CSS variables on keyframes, so this only declares the shapes.
 */
export function MotionFilters() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <filter id="mb-x" x="-20%" y="-5%" width="140%" height="110%"><feGaussianBlur stdDeviation="9 0" /></filter>
        <filter id="mb-x-soft" x="-20%" y="-5%" width="140%" height="110%"><feGaussianBlur stdDeviation="4 0" /></filter>
        <filter id="mb-y" x="-5%" y="-30%" width="110%" height="160%"><feGaussianBlur stdDeviation="0 2.2" /></filter>
        <filter id="mb-z" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
    </svg>
  );
}
