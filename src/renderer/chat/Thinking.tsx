import { useEffect, useState } from "react";
import type { Effort } from "../lib/types";
import { effortLabel } from "./prefs";

/**
 * The thinking indicator: three points of light on tilted orbits, each dragging a comet-like trail (its own motion blur),
 * beside a line of text that a slow light sweep passes over. Elapsed time appears once it takes a while.
 */
export function Thinking({ modelName, effort, since }: { modelName: string; effort: Effort; since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - since) / 1000));
  const ultra = effort === "ultracode";
  return (
    <div className="thinking" data-ultra={ultra || undefined} role="status">
      <span className="orbit" aria-hidden="true">
        <span className="orbit__core" />
        <span className="orbit__ring orbit__ring--a"><i /></span>
        <span className="orbit__ring orbit__ring--b"><i /></span>
        <span className="orbit__ring orbit__ring--c"><i /></span>
      </span>
      <span className="thinking__text">
        <span className="thinking__shine">Thinking with {modelName}</span>
        <span className="thinking__effort">{ultra ? "Ultracode" : `${effortLabel(effort)} effort`}</span>
      </span>
      {s >= 3 && <span className="thinking__time" aria-hidden="true">{s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`}</span>}
    </div>
  );
}
