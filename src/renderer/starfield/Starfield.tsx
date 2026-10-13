import { useEffect, useRef } from "react";
import { useReducedMotion } from "../lib/motion";

/**
 * Cosmic background: one 2D canvas, three depth layers of stars drifting upward (parallax),
 * occasional shooting stars with short fading trails. Low contrast so text stays readable.
 * - DPR-aware (capped at 2), resizes with the window, star count scales with area.
 * - ~30fps; pauses when the document is hidden or the window has been blurred for >30s.
 * - Reduced motion: renders a single static frame.
 */

const COLORS = ["255,255,255", "255,255,255", "170,200,255", "196,176,255", "255,226,150"] as const;
const LAYERS = [
  { density: 0.00011, speed: 3, size: [0.5, 0.9], alpha: [0.18, 0.38] },
  { density: 0.00005, speed: 7, size: [0.8, 1.25], alpha: [0.28, 0.52] },
  { density: 0.000018, speed: 13, size: [1.1, 1.7], alpha: [0.38, 0.65] },
] as const;
const FRAME_MS = 1000 / 30;
const BLUR_PAUSE_MS = 30_000;

interface Star { x: number; y: number; r: number; a: number; c: string; layer: number; tw: number }
interface Meteor { x: number; y: number; vx: number; vy: number; life: number; max: number; len: number }

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !ctx) return;

    let w = 0, h = 0, dpr = 1;
    let stars: Star[] = [];
    let meteors: Meteor[] = [];
    let raf = 0;
    let last = 0;
    let running = false;
    let blurTimer: number | undefined;
    let nextMeteor = performance.now() + rand(4000, 9000);

    const seed = () => {
      stars = [];
      LAYERS.forEach((L, layer) => {
        const n = Math.round(w * h * L.density);
        for (let i = 0; i < n; i++) {
          stars.push({ x: Math.random() * w, y: Math.random() * h, r: rand(L.size[0], L.size[1]), a: rand(L.alpha[0], L.alpha[1]), c: COLORS[(Math.random() * COLORS.length) | 0], layer, tw: Math.random() * Math.PI * 2 });
        }
      });
    };

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      draw(0, performance.now());
    };

    const draw = (dt: number, now: number) => {
      ctx.fillStyle = "#070814";
      ctx.fillRect(0, 0, w, h);
      for (const s of stars) {
        if (dt) {
          s.y -= LAYERS[s.layer].speed * dt;
          if (s.y < -2) { s.y = h + 2; s.x = Math.random() * w; }
          s.tw += dt * 0.6;
        }
        const alpha = s.a * (0.85 + 0.15 * Math.sin(s.tw));
        ctx.fillStyle = `rgba(${s.c},${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!dt) return;
      if (now > nextMeteor && meteors.length < 1) {
        const angle = rand(-2.6, -2.2); // up-left-ish, matching the upward drift
        const speed = rand(520, 760);
        meteors.push({ x: rand(w * 0.3, w), y: rand(h * 0.35, h), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0, max: rand(0.6, 0.9), len: rand(70, 120) });
        nextMeteor = now + rand(6000, 14000);
      }
      meteors = meteors.filter((m) => {
        m.life += dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        const p = m.life / m.max;
        if (p >= 1) return false;
        const fade = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8;
        const sp = Math.hypot(m.vx, m.vy);
        const tx = m.x - (m.vx / sp) * m.len;
        const ty = m.y - (m.vy / sp) * m.len;
        const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
        g.addColorStop(0, `rgba(235,240,255,${(0.55 * fade).toFixed(3)})`);
        g.addColorStop(1, "rgba(170,200,255,0)");
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.1;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        return true;
      });
    };

    const loop = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      const elapsed = now - last;
      if (elapsed < FRAME_MS) return;
      const dt = Math.min(0.1, elapsed / 1000);
      last = now;
      draw(dt, now);
    };

    const start = () => {
      if (running || reduced || document.hidden) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const onVis = () => (document.hidden ? stop() : start());
    const onBlur = () => {
      window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(stop, BLUR_PAUSE_MS);
    };
    const onFocus = () => {
      window.clearTimeout(blurTimer);
      start();
    };

    resize();
    start();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      stop();
      window.clearTimeout(blurTimer);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [reduced]);

  return <canvas ref={canvasRef} className="starfield" aria-hidden="true" />;
}
