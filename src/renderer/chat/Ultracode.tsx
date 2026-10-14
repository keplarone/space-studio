import { useEffect, useRef } from "react";
import { useReducedMotion } from "../lib/motion";

type Star = { x: number; y: number; z: number; r: number; tw: number; hue: number };
type Meteor = { x: number; y: number; vx: number; vy: number; life: number; max: number };

const TINTS = ["255,255,255", "207,224,255", "255,230,196", "214,196,255"];

/**
 * A tiny deep-space interior: three parallax layers of star specks drifting slowly, each twinkling on its own phase, and
 * now and then a micro shooting star whose trail is its own motion blur. Renders one still frame under reduced motion,
 * and stops drawing while it is off screen.
 */
export function UltraSky({ density = 1, className }: { density?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let w = 0;
    let h = 0;
    let stars: Star[] = [];
    let meteor: Meteor | null = null;
    let nextMeteor = 900 + Math.random() * 2200;
    let raf = 0;
    let last = performance.now();
    let visible = true;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const seed = () => {
      // Layout size, not the transformed rect: the pill may be mid-animation (scaled) when it mounts.
      w = Math.max(1, canvas.clientWidth);
      h = Math.max(1, canvas.clientHeight);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(((w * h) / 150) * density);
      stars = Array.from({ length: n }, () => {
        const z = Math.random();
        return { x: Math.random() * w, y: Math.random() * h, z, r: 0.35 + z * 0.85, tw: Math.random() * Math.PI * 2, hue: Math.floor(Math.random() * TINTS.length) };
      });
    };

    const draw = (t: number, dt: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.x -= (0.004 + s.z * 0.012) * dt;
        if (s.x < -2) { s.x = w + 2; s.y = Math.random() * h; }
        const a = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * (0.0012 + s.z * 0.002) + s.tw)) * (0.4 + s.z * 0.6);
        ctx.fillStyle = `rgba(${TINTS[s.hue]},${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.z > 0.92) {
          ctx.fillStyle = `rgba(${TINTS[s.hue]},${(a * 0.18).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (meteor) {
        const m = meteor;
        m.life += dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        const k = m.life / m.max;
        const alpha = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
        const len = 26;
        const sp = Math.hypot(m.vx, m.vy);
        const tx = m.x - (m.vx / sp) * len;
        const ty = m.y - (m.vy / sp) * len;
        const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
        g.addColorStop(0, `rgba(255,255,255,${Math.max(0, alpha).toFixed(3)})`);
        g.addColorStop(0.35, `rgba(200,180,255,${(Math.max(0, alpha) * 0.45).toFixed(3)})`);
        g.addColorStop(1, "rgba(160,140,255,0)");
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.1;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        if (m.life >= m.max) meteor = null;
      } else {
        nextMeteor -= dt;
        if (nextMeteor <= 0) {
          nextMeteor = 2400 + Math.random() * 4200;
          meteor = { x: w * (0.45 + Math.random() * 0.6), y: -2, vx: -(0.16 + Math.random() * 0.1), vy: 0.06 + Math.random() * 0.04, life: 0, max: 520 + Math.random() * 260 };
        }
      }
    };

    const loop = (t: number) => {
      const dt = Math.min(48, t - last);
      last = t;
      draw(t, dt);
      raf = visible ? requestAnimationFrame(loop) : 0;
    };

    seed();
    if (reduced) {
      draw(0, 0);
      return;
    }
    raf = requestAnimationFrame(loop);
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
      if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
    });
    io.observe(canvas);
    const ro = new ResizeObserver(() => seed());
    ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); };
  }, [reduced, density]);

  return <canvas ref={ref} className={["usky", className].filter(Boolean).join(" ")} aria-hidden="true" />;
}

/** The Ultracode word on its living deep-space pill. `size="sm"` is the inline version in the composer's picker button. */
export function UltraPill({ size = "md", active = false }: { size?: "sm" | "md"; active?: boolean }) {
  return (
    <span className="upill" data-size={size} data-active={active || undefined}>
      <span className="upill__aurora" aria-hidden="true" />
      <span className="upill__core" aria-hidden="true">
        <span className="upill__nebula" />
        <UltraSky density={size === "sm" ? 1.4 : 1} />
        <span className="upill__sweep" />
      </span>
      <span className="upill__label">Ultracode</span>
    </span>
  );
}
