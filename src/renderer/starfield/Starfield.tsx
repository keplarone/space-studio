import { useEffect, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  WebGLRenderer,
} from "three";
import { fx } from "../lib/fx";

/**
 * The Space Studio universe, the same one space.keplar.one flies through: stars coloured by stellar class with power-law
 * brightness, twinkle and diffraction spikes on the brightest; a Milky Way band far behind; procedural nebula auras; shooting
 * stars. Here the camera drifts forward forever (the field wraps), leans toward the pointer, and jumps to warp on fx events
 * (every prompt, navigation, the end of onboarding).
 *
 * Motion blur is real accumulation: instead of clearing, each frame fades the previous one, so anything that moves leaves a
 * trail that grows with speed. Star brightness is divided by the trail's steady-state gain, so a still sky looks the same.
 *
 * Budget: DPR capped at 2, ≤ 60 fps, paused while the window is hidden. Reduced motion: one still frame, no warp.
 */

const DEPTH = 900;
const FIELD = { w: 460, h: 300 };

const CLASSES: { c: string; share: number; lum: number }[] = [
  { c: "#9bb0ff", share: 0.03, lum: 2.2 },
  { c: "#aabfff", share: 0.07, lum: 1.7 },
  { c: "#cad7ff", share: 0.12, lum: 1.35 },
  { c: "#f8f7ff", share: 0.2, lum: 1.15 },
  { c: "#fff4ea", share: 0.18, lum: 1.0 },
  { c: "#ffe2b8", share: 0.16, lum: 0.9 },
  { c: "#ffc58a", share: 0.14, lum: 0.8 },
  { c: "#ff9f7a", share: 0.1, lum: 0.75 },
];
function stellar(): { color: Color; lum: number } {
  let r = Math.random();
  for (const k of CLASSES) if ((r -= k.share) <= 0) return { color: new Color(k.c), lum: k.lum };
  return { color: new Color("#ffffff"), lum: 1 };
}

const STAR_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uFly;
  uniform float uWarp;
  uniform float uMotion;
  uniform float uPixelRatio;
  uniform float uScale;
  uniform float uWrap;
  varying vec3 vColor;
  varying float vTwinkle;
  varying float vBright;
  varying vec2 vDir;
  varying float vWarp;
  void main() {
    vec3 p = position;
    if (uWrap > 0.5) p.z = mod(p.z + uFly, ${DEPTH.toFixed(1)}) - ${DEPTH.toFixed(1)};
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = -mv.z;
    float fade = uWrap > 0.5 ? smoothstep(${DEPTH.toFixed(1)}, ${(DEPTH * 0.72).toFixed(1)}, dist) * smoothstep(1.0, 14.0, dist) : 1.0;
    float grow = 1.0 + uWarp * 5.0;
    gl_PointSize = clamp(aSize * grow * uPixelRatio * (uScale / dist), 1.0, 26.0 * grow * uPixelRatio);
    vColor = aColor * fade;
    vBright = aSize;
    vTwinkle = mix(1.0, 0.82 + 0.18 * sin(uTime * (1.3 + aPhase * 2.0) + aPhase * 40.0), uMotion);
    vec2 ndc = gl_Position.xy / gl_Position.w;
    vDir = normalize(vec2(ndc.x, -ndc.y) + 1e-4);
    vWarp = uWarp;
  }
`;
const STAR_FRAGMENT = /* glsl */ `
  uniform float uGain;
  varying vec3 vColor;
  varying float vTwinkle;
  varying float vBright;
  varying vec2 vDir;
  varying float vWarp;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    // Warp: squeeze each star across its direction of travel and stretch it along it.
    float al = dot(c, vDir), ac = dot(c, vec2(-vDir.y, vDir.x));
    c = vec2(al * mix(1.0, 0.55, vWarp), ac * (1.0 + 5.0 * vWarp));
    float d = length(c);
    float core = exp(-d * d * 60.0);
    float halo = exp(-d * 9.0) * 0.35;
    float big = smoothstep(4.0, 9.0, vBright);
    float spikes = (exp(-abs(c.x) * 70.0) * exp(-abs(c.y) * 5.0) + exp(-abs(c.y) * 70.0) * exp(-abs(c.x) * 5.0)) * big * 0.9 * (1.0 - vWarp);
    float a = (core + halo + spikes) * vTwinkle * (1.0 + vWarp * 0.8) * uGain;
    if (a < 0.002) discard;
    gl_FragColor = vec4(vColor * a, a);
  }
`;
const STREAK_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const STREAK_FRAGMENT = /* glsl */ `
  uniform float uLife;
  uniform float uGain;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float across = exp(-pow((vUv.y - 0.5) * 6.0, 2.0));
    float along = pow(vUv.x, 2.6);
    float head = exp(-pow((1.0 - vUv.x) * 40.0, 2.0)) * 2.2;
    float a = (along + head) * across * uLife * uGain;
    gl_FragColor = vec4(mix(uColor, vec3(1.0), head * 0.5) * a, a);
  }
`;

function nebulaTexture(seed: number, tint: [number, number, number], tint2: [number, number, number]): CanvasTexture {
  const size = 256;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const rnd = (x: number, y: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = rnd(xi, yi), b = rnd(xi + 1, yi), c = rnd(xi, yi + 1), d = rnd(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size, ny = y / size;
      let f = 0, amp = 0.55, freq = 3;
      for (let o = 0; o < 6; o++) { f += amp * noise(nx * freq + seed, ny * freq - seed); freq *= 2.1; amp *= 0.5; }
      const dx = nx - 0.5, dy = ny - 0.5;
      const fall = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 2);
      const v = Math.pow(Math.max(0, f - 0.32), 1.6) * fall * fall * 2.4;
      const mix = Math.min(1, Math.max(0, (f - 0.4) * 2.5));
      const i = (y * size + x) * 4;
      img.data[i] = tint[0] * (1 - mix) + tint2[0] * mix;
      img.data[i + 1] = tint[1] * (1 - mix) + tint2[1] * mix;
      img.data[i + 2] = tint[2] * (1 - mix) + tint2[2] * mix;
      img.data[i + 3] = Math.min(255, v * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

// [x, y, z offset, size, colour A, colour B, opacity] — hydrogen pinks, oxygen teals, dust blues and violets.
const AURAS: [number, number, number, number, [number, number, number], [number, number, number], number][] = [
  [-120, 45, 0, 230, [150, 110, 255], [200, 120, 255], 0.9],
  [130, -55, 150, 250, [255, 110, 160], [255, 170, 110], 0.8],
  [-95, -40, 300, 270, [70, 210, 220], [120, 140, 255], 0.8],
  [115, 60, 450, 290, [200, 110, 255], [255, 120, 180], 0.8],
  [-130, 20, 600, 320, [255, 150, 100], [255, 90, 130], 0.7],
  [-30, 75, 750, 330, [100, 150, 255], [170, 110, 255], 0.75],
];

type Streak = { mesh: Mesh; mat: ShaderMaterial; x: number; y: number; vx: number; vy: number; len: number; age: number; max: number };

/** Warp envelope over `len` seconds: a quick surge, a short hold, then a long ease back. */
function envelope(t: number, len: number): number {
  if (t < 0 || t > len) return 0;
  const up = Math.min(0.4, len * 0.22), hold = up + Math.min(0.5, len * 0.2);
  if (t < up) { const u = t / up; return u * u * (3 - 2 * u); }
  if (t < hold) return 1;
  return Math.pow(1 - (t - hold) / (len - hold), 2.2);
}

const reducedMotion = () =>
  document.documentElement.dataset.motion === "reduced" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Starfield() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = reducedMotion();

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: true });
    } catch {
      return; // No WebGL: the black background stays.
    }
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x000000, 1);
    renderer.autoClear = false;
    const canvas = renderer.domElement;
    canvas.className = "starfield__canvas";
    host.appendChild(canvas);

    const scene = new Scene();
    const camera = new PerspectiveCamera(62, 1, 0.5, 4000);
    const world = new Group();
    scene.add(world);
    const disposers: (() => void)[] = [];

    // ---- stars (wrap around the camera's endless flight) ----
    const count = Math.min(16_000, Math.max(9_000, Math.round((window.innerWidth * window.innerHeight) / 90)));
    const sPos = new Float32Array(count * 3), sCol = new Float32Array(count * 3), sSize = new Float32Array(count), sPhase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      sPos[i * 3] = (Math.random() - 0.5) * FIELD.w;
      sPos[i * 3 + 1] = (Math.random() - 0.5) * FIELD.h;
      sPos[i * 3 + 2] = -Math.random() * DEPTH;
      const { color, lum } = stellar();
      const m = Math.pow(Math.random(), 7.5);
      const bright = 0.55 + Math.min(1, m * 6) * 0.9;
      sCol[i * 3] = color.r * bright; sCol[i * 3 + 1] = color.g * bright; sCol[i * 3 + 2] = color.b * bright;
      sSize[i] = (1.6 + m * 15) * lum;
      sPhase[i] = Math.random();
    }
    const starGeo = new BufferGeometry();
    starGeo.setAttribute("position", new BufferAttribute(sPos, 3));
    starGeo.setAttribute("aColor", new BufferAttribute(sCol, 3));
    starGeo.setAttribute("aSize", new BufferAttribute(sSize, 1));
    starGeo.setAttribute("aPhase", new BufferAttribute(sPhase, 1));
    const uniforms = () => ({
      uTime: { value: Math.random() * 100 }, uFly: { value: Math.random() * DEPTH }, uWarp: { value: 0 }, uMotion: { value: reduced ? 0 : 1 },
      uPixelRatio: { value: pixelRatio }, uScale: { value: 300 }, uWrap: { value: 1 }, uGain: { value: 1 },
    });
    const starMat = new ShaderMaterial({ vertexShader: STAR_VERTEX, fragmentShader: STAR_FRAGMENT, uniforms: uniforms(), transparent: true, depthWrite: false, blending: AdditiveBlending });
    const stars = new Points(starGeo, starMat);
    stars.frustumCulled = false;
    world.add(stars);
    disposers.push(() => { starGeo.dispose(); starMat.dispose(); });

    // ---- Milky Way band, far behind and fixed ----
    const band = new Group();
    band.position.z = -2400;
    band.rotation.z = -0.42;
    const bandCount = 12_000;
    const bPos = new Float32Array(bandCount * 3), bCol = new Float32Array(bandCount * 3), bSize = new Float32Array(bandCount), bPhase = new Float32Array(bandCount);
    for (let i = 0; i < bandCount; i++) {
      const g = (Math.random() + Math.random() + Math.random() - 1.5) * 0.9;
      bPos[i * 3] = (Math.random() - 0.5) * 4200;
      bPos[i * 3 + 1] = g * 320;
      bPos[i * 3 + 2] = (Math.random() - 0.5) * 300;
      const { color } = stellar();
      const k = 0.35 + Math.random() * 0.5;
      bCol[i * 3] = color.r * k; bCol[i * 3 + 1] = color.g * k; bCol[i * 3 + 2] = color.b * k;
      bSize[i] = 1.4 + Math.random() * 2.2;
      bPhase[i] = Math.random();
    }
    const bandGeo = new BufferGeometry();
    bandGeo.setAttribute("position", new BufferAttribute(bPos, 3));
    bandGeo.setAttribute("aColor", new BufferAttribute(bCol, 3));
    bandGeo.setAttribute("aSize", new BufferAttribute(bSize, 1));
    bandGeo.setAttribute("aPhase", new BufferAttribute(bPhase, 1));
    const bandMat = new ShaderMaterial({ vertexShader: STAR_VERTEX, fragmentShader: STAR_FRAGMENT, uniforms: { ...uniforms(), uScale: { value: 3200 }, uWrap: { value: 0 } }, transparent: true, depthWrite: false, blending: AdditiveBlending });
    const bandPoints = new Points(bandGeo, bandMat);
    bandPoints.frustumCulled = false;
    band.add(bandPoints);
    const dustTex = nebulaTexture(11, [255, 214, 170], [150, 170, 255]);
    const dustMats: SpriteMaterial[] = [];
    for (let i = 0; i < 7; i++) {
      const mat = new SpriteMaterial({ map: dustTex, transparent: true, opacity: 0.3, blending: AdditiveBlending, depthWrite: false });
      dustMats.push(mat);
      const sp = new Sprite(mat);
      sp.position.set((i - 3) * 560 + (Math.random() - 0.5) * 140, (Math.random() - 0.5) * 70, 0);
      sp.scale.set(1200, 680, 1);
      band.add(sp);
    }
    world.add(band);
    disposers.push(() => { bandGeo.dispose(); bandMat.dispose(); dustTex.dispose(); dustMats.forEach((m) => m.dispose()); });

    // ---- nebula auras (wrap with the stars) ----
    const auras: { sp: Sprite; offset: number; base: number }[] = [];
    AURAS.forEach(([x, y, offset, size, a, b, opacity], i) => {
      const tex = nebulaTexture(i * 3.7 + 1.3, a, b);
      const mat = new SpriteMaterial({ map: tex, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false });
      const sp = new Sprite(mat);
      sp.position.set(x, y, -offset);
      sp.scale.set(size, size * 0.72, 1);
      sp.material.rotation = Math.random() * Math.PI;
      world.add(sp);
      auras.push({ sp, offset, base: opacity });
      disposers.push(() => { tex.dispose(); mat.dispose(); });
    });

    // ---- screen-space overlay: the motion-blur fade and shooting stars ----
    const overlay = new Scene();
    const ortho = new OrthographicCamera(0, 1, 1, 0, -1, 1);
    const fadeGeo = new PlaneGeometry(1, 1);
    const fadeMat = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 1, blending: NormalBlending, depthWrite: false, depthTest: false });
    const fade = new Mesh(fadeGeo, fadeMat);
    const fadeScene = new Scene();
    fadeScene.add(fade);
    const streakGeo = new PlaneGeometry(1, 1);
    streakGeo.translate(0.5, 0, 0);
    const streaks: Streak[] = [];
    const spawnStreak = () => {
      const w = window.innerWidth, h = window.innerHeight;
      const angle = (-155 - Math.random() * 30) * (Math.PI / 180);
      const speed = (0.9 + Math.random() * 0.8) * Math.max(w, h);
      const mat = new ShaderMaterial({
        vertexShader: STREAK_VERTEX, fragmentShader: STREAK_FRAGMENT,
        uniforms: { uLife: { value: 0 }, uGain: { value: 1 }, uColor: { value: new Color(Math.random() < 0.7 ? "#cfe0ff" : "#ffe6c4") } },
        transparent: true, depthWrite: false, blending: AdditiveBlending,
      });
      const mesh = new Mesh(streakGeo, mat);
      overlay.add(mesh);
      streaks.push({ mesh, mat, x: w * (0.3 + Math.random() * 0.75), y: h * (0.55 + Math.random() * 0.45), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, len: 120 + Math.random() * 180, age: 0, max: 0.55 + Math.random() * 0.5 });
    };
    const dropStreak = (k: number) => {
      const s = streaks[k]!;
      overlay.remove(s.mesh);
      s.mat.dispose();
      streaks.splice(k, 1);
    };
    disposers.push(() => { while (streaks.length) dropStreak(streaks.length - 1); streakGeo.dispose(); fadeGeo.dispose(); fadeMat.dispose(); });

    const resize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      ortho.left = 0; ortho.right = w; ortho.top = h; ortho.bottom = 0;
      ortho.updateProjectionMatrix();
      fade.position.set(w / 2, h / 2, 0);
      fade.scale.set(w, h, 1);
      renderer.clear();
    };
    resize();

    // ---- input: pointer parallax, warp events ----
    const target = { x: 0, y: 0 };
    const eased = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    let warp = { age: -1, len: 1.7, strength: 1 };
    const offWarp = fx.onWarp((d) => {
      if (reduced) return;
      const cur = warp.age >= 0 ? envelope(warp.age, warp.len) * warp.strength : 0;
      // A smaller jump never cuts a bigger one short.
      if (cur > d.strength) return;
      warp = { age: 0, len: Math.max(0.6, d.seconds), strength: Math.max(0, Math.min(1.5, d.strength)) };
    });

    let raf = 0, last = 0, running = false;
    let nextStreak = 2 + Math.random() * 3;
    let speedNow = 0;

    const draw = (trail: number) => {
      // trail = how much of the previous frame survives (0 = hard clear). The fade quad removes the rest.
      fadeMat.opacity = 1 - trail;
      renderer.render(fadeScene, ortho);
      const gain = 1 - trail; // steady-state of an additive trail is 1 / (1 - trail)
      starMat.uniforms.uGain!.value = gain;
      bandMat.uniforms.uGain!.value = gain;
      for (const s of streaks) s.mat.uniforms.uGain!.value = gain;
      for (const m of dustMats) m.opacity = 0.3 * gain;
      for (const a of auras) a.sp.material.opacity = a.base * gain * (a.sp.userData.near as number ?? 1);
      renderer.render(scene, camera);
      renderer.render(overlay, ortho);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 1000 / 60 - 1) return;
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;

      let w = 0;
      if (warp.age >= 0) {
        warp.age += dt;
        w = envelope(warp.age, warp.len) * warp.strength;
        if (warp.age > warp.len) warp.age = -1;
      }
      const t = (starMat.uniforms.uTime!.value += dt);
      bandMat.uniforms.uTime!.value = t;
      const speed = 7 * (1 + w * 120);
      speedNow += (speed - speedNow) * Math.min(1, dt * 8);
      const fly = (starMat.uniforms.uFly!.value += dt * speedNow);
      const wv = Math.min(1, w);
      starMat.uniforms.uWarp!.value = wv;

      eased.x += (target.x - eased.x) * Math.min(1, dt * 3);
      eased.y += (target.y - eased.y) * Math.min(1, dt * 3);
      camera.position.set(eased.x * 6, -eased.y * 4, 0);
      camera.lookAt(eased.x * 2, -eased.y * 1.5, -100);
      camera.rotation.z += Math.sin(t * 0.05) * 0.02 + w * 0.06 * Math.sin(t * 1.3);
      const fov = 62 + w * 26;
      if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
      band.rotation.z = -0.42 + t * 0.002;

      for (let i = 0; i < auras.length; i++) {
        const a = auras[i]!;
        const z = ((a.offset + fly * 0.9) % DEPTH) - DEPTH;
        a.sp.position.z = z;
        a.sp.userData.near = Math.min(1, Math.max(0, (-z - 40) / 160)) * Math.min(1, (DEPTH + z) / 200);
        a.sp.material.rotation += (0.0006 + w * 0.01) * (i % 2 ? 1 : -1);
      }

      nextStreak -= dt;
      if (nextStreak <= 0 && streaks.length < 2) { spawnStreak(); nextStreak = 2.5 + Math.random() * 5.5; }
      for (let k = streaks.length - 1; k >= 0; k--) {
        const s = streaks[k]!;
        s.age += dt;
        const p = s.age / s.max;
        if (p >= 1) { dropStreak(k); continue; }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const len = s.len * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, p * 1.4)));
        const ang = Math.atan2(s.vy, s.vx);
        s.mesh.position.set(s.x - Math.cos(ang) * len, s.y - Math.sin(ang) * len, 0);
        s.mesh.rotation.z = ang;
        s.mesh.scale.set(len, 2.2 * pixelRatio, 1);
        s.mat.uniforms.uLife!.value = Math.sin(Math.PI * p);
      }
      // Trails: a soft blur while drifting, long streaks during warp.
      draw(0.45 + Math.min(1, w) * 0.43);
    };
    const start = () => {
      if (running || reduced || document.hidden) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    const onResize = () => { resize(); if (!running) draw(0); };
    const onVisibility = () => (document.hidden ? stop() : start());
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    if (!reduced) window.addEventListener("pointermove", onPointer, { passive: true });

    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -100);
    if (reduced) draw(0);
    else start();

    return () => {
      stop();
      offWarp();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
      for (const d of disposers) d();
      renderer.dispose();
      canvas.remove();
    };
  }, []);

  return <div ref={hostRef} className="starfield" aria-hidden="true" />;
}
