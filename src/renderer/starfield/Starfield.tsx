import { useEffect, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  LineSegments,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from "three";
import { useReducedMotion } from "../lib/motion";

/**
 * The background: a three.js star volume drifting upward, with occasional shooting stars.
 *
 * Stars live in a box in front of the camera; perspective gives the depth parallax (near stars cross the screen faster).
 * The drift runs in the vertex shader from one time uniform, so a frame costs the CPU almost nothing. Rendering is capped at
 * 40 fps, stops while the window is hidden or has been in the background for 30 s, and draws a single still frame when
 * reduced motion is on. Device pixel ratio is capped at 2.
 */

const FPS = 40;
const BLUR_PAUSE_MS = 30_000;
const BOX = { w: 220, h: 140, near: 6, far: 190 };

// Star colours, weighted: mostly white and blue-white like a real sky, with clear blues, golds, oranges, reds and violets.
const PALETTE: [string, number][] = [
  ["#ffffff", 22], ["#dfe8ff", 12], ["#9ec2ff", 12], ["#5f8dff", 8], ["#79e3ff", 5],
  ["#fff1c9", 9], ["#ffd36b", 8], ["#ffa64d", 7], ["#ff6b4a", 5], ["#ff4f7b", 4],
  ["#c58bff", 6], ["#8f6bff", 5],
];

function pick(): Color {
  const total = PALETTE.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [hex, w] of PALETTE) {
    r -= w;
    if (r <= 0) return new Color(hex);
  }
  return new Color("#ffffff");
}

const STAR_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aSpeed;
  attribute float aPhase;
  uniform float uTime;
  uniform float uHeight;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    vec3 p = position;
    p.y = mod(p.y + uTime * aSpeed + uHeight * 0.5, uHeight) - uHeight * 0.5;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(aSize * uPixelRatio * (260.0 / -mv.z), 1.5, 18.0 * uPixelRatio);
    vColor = aColor;
    vTwinkle = 0.78 + 0.22 * sin(uTime * (0.6 + aPhase) + aPhase * 6.2831);
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float core = smoothstep(0.5, 0.0, d);
    core = pow(core, 1.8);
    // Faint four-point spikes on every star; they only show on the larger ones.
    float spikes = max(0.0, 1.0 - abs(c.x) * 26.0) * smoothstep(0.5, 0.0, abs(c.y))
                 + max(0.0, 1.0 - abs(c.y) * 26.0) * smoothstep(0.5, 0.0, abs(c.x));
    float a = (core + spikes * 0.18) * vTwinkle;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

const METEOR_VERTEX = /* glsl */ `
  attribute float aT;
  varying float vT;
  void main() {
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const METEOR_FRAGMENT = /* glsl */ `
  uniform float uLife;
  uniform vec3 uColor;
  varying float vT;
  void main() {
    float a = (1.0 - vT) * uLife;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

type Meteor = { line: LineSegments; vx: number; vy: number; x: number; y: number; z: number; len: number; age: number; max: number };

export function Starfield() {
  const hostRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: false, alpha: false, powerPreference: "low-power" });
    } catch {
      return; // No WebGL: the page background stays plain black.
    }
    renderer.setClearColor(0x000000, 1);
    const canvas = renderer.domElement;
    canvas.className = "starfield";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);

    const scene = new Scene();
    const camera = new PerspectiveCamera(60, 1, 0.1, 400);
    camera.position.set(0, 0, 0);

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);

    // Star count follows the window area: about 12,000 on a 1440×900 window, never more than 14,000.
    const count = Math.min(14_000, Math.max(4_000, Math.round((window.innerWidth * window.innerHeight) / 110)));
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const speed = new Float32Array(count);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * BOX.w;
      pos[i * 3 + 1] = (Math.random() - 0.5) * BOX.h;
      pos[i * 3 + 2] = -(BOX.near + Math.random() * (BOX.far - BOX.near));
      const c = pick();
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      // Most stars are small; a few are large and bright.
      const r = Math.random();
      size[i] = r > 0.993 ? 10 + Math.random() * 6 : r > 0.95 ? 5 + Math.random() * 3 : 2 + Math.random() * 2.6;
      speed[i] = 0.9 + Math.random() * 1.4;
      phase[i] = Math.random();
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(pos, 3));
    geo.setAttribute("aColor", new BufferAttribute(col, 3));
    geo.setAttribute("aSize", new BufferAttribute(size, 1));
    geo.setAttribute("aSpeed", new BufferAttribute(speed, 1));
    geo.setAttribute("aPhase", new BufferAttribute(phase, 1));
    const starMat = new ShaderMaterial({
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      uniforms: { uTime: { value: 0 }, uHeight: { value: BOX.h }, uPixelRatio: { value: pixelRatio } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const stars = new Points(geo, starMat);
    stars.frustumCulled = false;
    scene.add(stars);

    const meteors: Meteor[] = [];
    const spawnMeteor = () => {
      const z = -(30 + Math.random() * 60);
      const half = Math.tan((camera.fov * Math.PI) / 360) * -z;
      const x = (Math.random() - 0.2) * half * camera.aspect * 1.6;
      const y = half * (0.2 + Math.random() * 0.8);
      const angle = (200 + Math.random() * 30) * (Math.PI / 180); // down and to the left
      const v = 55 + Math.random() * 40;
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(new Float32Array(6), 3));
      g.setAttribute("aT", new BufferAttribute(new Float32Array([0, 1]), 1));
      const m = new ShaderMaterial({
        vertexShader: METEOR_VERTEX,
        fragmentShader: METEOR_FRAGMENT,
        uniforms: { uLife: { value: 0 }, uColor: { value: pick().lerp(new Color("#ffffff"), 0.55) } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      const line = new LineSegments(g, m);
      line.frustumCulled = false;
      scene.add(line);
      meteors.push({ line, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, x, y, z, len: 0.16 + Math.random() * 0.1, age: 0, max: 0.9 + Math.random() * 0.6 });
    };

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();

    let raf = 0;
    let last = 0;
    let time = Math.random() * 1000;
    let nextMeteor = 3 + Math.random() * 5;
    let running = false;
    let blurTimer = 0;

    const draw = () => renderer.render(scene, camera);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 1000 / FPS) return;
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      time += dt;
      starMat.uniforms.uTime!.value = time;

      nextMeteor -= dt;
      if (nextMeteor <= 0 && meteors.length < 2) {
        spawnMeteor();
        nextMeteor = 5 + Math.random() * 9;
      }
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i]!;
        m.age += dt;
        const p = m.age / m.max;
        if (p >= 1) {
          scene.remove(m.line);
          m.line.geometry.dispose();
          (m.line.material as ShaderMaterial).dispose();
          meteors.splice(i, 1);
          continue;
        }
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        const a = m.line.geometry.getAttribute("position") as BufferAttribute;
        a.setXYZ(0, m.x, m.y, m.z);
        a.setXYZ(1, m.x - m.vx * m.len, m.y - m.vy * m.len, m.z);
        a.needsUpdate = true;
        (m.line.material as ShaderMaterial).uniforms.uLife!.value = Math.sin(Math.PI * p) * 0.9;
      }
      draw();
    };

    const start = () => {
      if (running || reduced || document.hidden) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const onResize = () => {
      resize();
      if (!running) draw();
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onBlur = () => {
      window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(stop, BLUR_PAUSE_MS);
    };
    const onFocus = () => {
      window.clearTimeout(blurTimer);
      start();
    };

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    if (reduced) draw();
    else start();

    return () => {
      stop();
      window.clearTimeout(blurTimer);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      for (const m of meteors) {
        m.line.geometry.dispose();
        (m.line.material as ShaderMaterial).dispose();
      }
      geo.dispose();
      starMat.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, [reduced]);

  return <div ref={hostRef} className="starfield-host" aria-hidden="true" />;
}
