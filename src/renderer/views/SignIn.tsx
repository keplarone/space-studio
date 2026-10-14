import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { useApp } from "../lib/app";
import { connected, openExternal } from "../lib/bridge";
import { useReducedMotion } from "../lib/motion";
import { GoogleLogo, KeplarMark, RobloxLogo } from "../ui/logos";
import mark from "../assets/mark.png";

type Provider = "roblox" | "keplar" | "google";
type Mode = "signup" | "login";

/** What Space Studio does, said many ways. The verb is painted with the moving gradient; the rest stays white. */
const LINES: readonly [verb: string, rest: string][] = [
  ["Build", "your first world."],
  ["Scale", "your Roblox games fast."],
  ["Ship", "updates in minutes."],
  ["Turn", "ideas into experiences."],
  ["Grow", "your player count."],
  ["Make", "Blender assets in one prompt."],
  ["Fix", "bugs before players find them."],
  ["Write", "Luau that just works."],
  ["Launch", "your game this weekend."],
  ["Design", "worlds players return to."],
  ["Model", "props, maps and characters."],
  ["Earn", "more from every experience."],
  ["Learn", "Luau while you build."],
];

const CYCLE_MS = 3200;
const NAMES: Record<Provider, string> = { roblox: "Roblox", keplar: "Keplar", google: "Google" };

/** Inline style with CSS custom properties. */
const vars = (v: Record<string, string | number>) => v as CSSProperties;

/* ---------- The cycling headline ---------- */

/**
 * One line of the headline, split into per-character spans inside unbreakable word spans (words never break mid-word).
 * The verb's characters each carry a slice of one shared gradient: their offset inside the word is measured in em so the
 * gradient stays continuous across the separate glyph layers (each glyph animates on its own, so the gradient can't sit on
 * the word itself) and survives font-size changes.
 */
function Line({ verb, rest, phase, delay }: { verb: string; rest: string; phase: "in" | "out"; delay: number }) {
  const verbRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const word = verbRef.current;
    if (!word) return;
    const measure = () => {
      const fs = parseFloat(getComputedStyle(word).fontSize) || 1;
      word.style.setProperty("--ww", `${word.offsetWidth / fs}em`);
      word.querySelectorAll<HTMLElement>(".hl__ch").forEach((ch) => ch.style.setProperty("--cx", `${ch.offsetLeft / fs}em`));
    };
    measure();
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) measure(); }).catch(() => undefined);
    return () => { alive = false; };
  }, [verb]);

  let n = 0;
  const chars = (word: string) =>
    Array.from(word).map((c, i) => (
      <span key={i} className="hl__ch" style={vars({ "--i": n++ })}>{c}</span>
    ));
  const words = rest.split(" ");
  return (
    <span className="hl__line" data-phase={phase} style={vars({ "--d": `${delay}ms` })}>
      <span className="hl__word hl__verb" ref={verbRef}>{chars(verb)}</span>
      {words.map((w, i) => (
        <span key={i}>
          {" "}
          <span className="hl__word">{chars(w)}</span>
        </span>
      ))}
    </span>
  );
}

/**
 * The headline cycles forever. The outgoing line's glyphs lift and blur away one after another while the incoming glyphs rise
 * out of a vertical motion blur. Every line is also laid out invisibly in the same grid cell, so the block is always as tall as
 * the longest line and nothing below it ever moves. Screen readers get the stable name instead of the cycling copy.
 */
function Headline({ id }: { id: string }) {
  const reduced = useReducedMotion();
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.hidden) return;
      setCycle((c) => c + 1);
    }, reduced ? CYCLE_MS * 1.6 : CYCLE_MS);
    return () => window.clearInterval(t);
  }, [reduced]);

  const at = (c: number) => LINES[((c % LINES.length) + LINES.length) % LINES.length]!;
  const shown = cycle === 0 ? [cycle] : [cycle - 1, cycle];

  return (
    <h1 className="hl" id={id}>
      <svg className="hl__defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <filter id="hl-mb-3" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="0 9" /></filter>
          <filter id="hl-mb-2" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="0 5" /></filter>
          <filter id="hl-mb-1" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="0 2" /></filter>
        </defs>
      </svg>
      <span className="sr-only">Space Studio: AI for Roblox and Blender creators</span>
      <span className="hl__stage" aria-hidden="true">
        {LINES.map(([v, r]) => (
          <span key={v} className="hl__sizer">{v} {r}</span>
        ))}
        {shown.map((c) => {
          const [v, r] = at(c);
          return <Line key={c} verb={v} rest={r} phase={c === cycle ? "in" : "out"} delay={cycle === 0 ? 420 : 300} />;
        })}
      </span>
    </h1>
  );
}

/* ---------- Mode switch ---------- */

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);
  const [moving, setMoving] = useState(false);
  const movingTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(movingTimer.current), []);
  const opts: { id: Mode; label: string }[] = [
    { id: "login", label: "Log in" },
    { id: "signup", label: "Sign up" },
  ];

  const measure = useCallback(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-id="${mode}"]`);
    if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth });
  }, [mode]);
  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const pick = (m: Mode, focus = false) => {
    if (m !== mode) {
      setMoving(true);
      window.clearTimeout(movingTimer.current);
      movingTimer.current = window.setTimeout(() => setMoving(false), 520);
      onChange(m);
    }
    if (focus) ref.current?.querySelector<HTMLElement>(`[data-id="${m}"]`)?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      pick(mode === "login" ? "signup" : "login", true);
    }
  };

  return (
    <div className="seg" ref={ref} role="radiogroup" aria-label="Do you have a Space Studio account?" onKeyDown={onKey}>
      {ind && (
        <span
          className="seg__ind"
          data-moving={moving || undefined}
          style={{ transform: `translateX(${ind.x}px)`, width: ind.w }}
          aria-hidden="true"
        />
      )}
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          data-id={o.id}
          aria-checked={mode === o.id}
          tabIndex={mode === o.id ? 0 : -1}
          className="seg__opt"
          onClick={() => pick(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Provider buttons ---------- */

function ProviderButton({
  provider,
  mode,
  logo,
  primary,
  busy,
  disabled,
  unavailable,
  onClick,
}: {
  provider: Provider;
  mode: Mode;
  logo: ReactNode;
  primary?: boolean;
  busy: boolean;
  disabled: boolean;
  unavailable?: boolean;
  onClick: () => void;
}) {
  const verb = mode === "signup" ? "Sign up" : "Log in";
  return (
    <button
      type="button"
      className={primary ? "sp btn3d sp--primary" : "sp sp--glass"}
      data-busy={busy || undefined}
      aria-busy={busy || undefined}
      disabled={disabled || unavailable}
      onClick={onClick}
    >
      <span className="sp__logo" data-provider={provider}>{logo}</span>
      <span className="sp__label">
        {busy ? (
          <span className="sp__roll" key="busy">Waiting for {NAMES[provider]}…</span>
        ) : (
          <>
            <span className="sp__roll" key={mode}>{verb}</span> with {NAMES[provider]}
          </>
        )}
      </span>
      {unavailable ? <span className="sp__note">Unavailable right now</span> : primary && <span className="sp__badge">Recommended</span>}
    </button>
  );
}

/* ---------- Screen ---------- */

const LEDE: Record<Mode, string> = {
  signup: "Make Roblox games and Blender assets with AI that reviews every change with you.",
  login: "Pick up where you left off. Your projects, tasks and Cloud jobs are waiting.",
};

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => {
        if (!connected) return;
        e.preventDefault();
        void openExternal(href);
      }}
    >
      {children}
    </a>
  );
}

/** The sign-in screen. Sign-in itself happens on the provider's own page in a separate window; this screen waits for it. */
export function SignIn() {
  const { meState, me, refreshMe, signIn } = useApp();
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<Mode>("signup");
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const alive = useRef(true);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // The nebula leans gently toward the pointer. Written straight to CSS variables (no React render per move).
  useEffect(() => {
    const el = rootRef.current;
    if (!el || reduced) return;
    let raf = 0;
    let tx = 0, ty = 0, x = 0, y = 0;
    const onMove = (e: PointerEvent) => {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
      if (!raf) raf = requestAnimationFrame(step);
    };
    const step = () => {
      x += (tx - x) * 0.06;
      y += (ty - y) * 0.06;
      el.style.setProperty("--px", x.toFixed(4));
      el.style.setProperty("--py", y.toFixed(4));
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.0005 ? requestAnimationFrame(step) : 0;
    };
    window.addEventListener("pointermove", onMove);
    return () => { window.removeEventListener("pointermove", onMove); cancelAnimationFrame(raf); };
  }, [reduced]);

  const go = async (p: Provider) => {
    if (busy) return;
    setError(null);
    setBusy(p);
    try {
      await signIn(p);
      const fresh = await refreshMe();
      if (!alive.current) return;
      if (!fresh?.signedIn) setError(`You're not signed in yet. If you closed the ${NAMES[p]} window, that's fine: try again whenever you're ready.`);
    } catch {
      if (alive.current) setError(`Sign-in with ${NAMES[p]} didn't open. Try again in a moment.`);
    } finally {
      if (alive.current) setBusy(null);
    }
  };

  const retry = async () => {
    setRetrying(true);
    await refreshMe();
    if (alive.current) setRetrying(false);
  };

  const providers = me?.providers;
  const version = typeof window !== "undefined" ? window.space?.version : undefined;
  const disabled = !connected || busy !== null;

  let notice: ReactNode = null;
  if (!connected) {
    notice = (
      <div className="si-notice" role="status">
        <b>Open Space Studio to sign in.</b>
        <span>Sign-in only works inside the Space Studio app. This window isn't connected to it, so the buttons are paused.</span>
      </div>
    );
  } else if (meState.kind === "error" || meState.kind === "offline") {
    notice = (
      <div className="si-notice si-notice--warn" role="alert">
        <b>{meState.kind === "offline" ? "Can't reach Space Studio's servers." : "Your account didn't load."}</b>
        <span>{meState.kind === "offline" ? "Check your internet connection, then try again." : meState.message}</span>
        <button type="button" className="si-retry" onClick={() => void retry()} disabled={retrying} aria-busy={retrying || undefined}>
          {retrying ? "Retrying…" : "Retry"}
        </button>
      </div>
    );
  }

  return (
    <div className="si" ref={rootRef}>
      <div className="si-nebula" aria-hidden="true">
        <div className="si-nebula__base" />
        <div className="si-nebula__glow si-nebula__glow--a" />
        <div className="si-nebula__glow si-nebula__glow--b" />
        <div className="si-nebula__glow si-nebula__glow--c" />
        <div className="si-nebula__sweep" />
      </div>

      <div className="si-brand si-rise" style={vars({ "--d": "60ms" })}>
        <img src={mark} alt="" />
        <span>Space Studio</span>
      </div>

      <section className="si-panel" aria-labelledby="si-title">
        <div className="si-head">
          <span className="si-eyebrow si-rise" style={vars({ "--d": "180ms" })}>Space Studio by Keplar</span>
          <Headline id="si-title" />
          <p className="si-lede si-rise" style={vars({ "--d": "520ms" })}>
            <span key={mode} className="si-lede__text">{LEDE[mode]}</span>
          </p>
        </div>

        <div className="si-rise" style={vars({ "--d": "640ms" })}>
          <ModeSwitch mode={mode} onChange={(m) => { setMode(m); setError(null); }} />
        </div>

        <div className="si-buttons">
          <div className="si-rise" style={vars({ "--d": "740ms" })}>
            <ProviderButton provider="roblox" mode={mode} primary logo={<RobloxLogo size={20} />} busy={busy === "roblox"} disabled={disabled}
              unavailable={providers ? !providers.roblox : false} onClick={() => void go("roblox")} />
          </div>
          <div className="si-rise" style={vars({ "--d": "820ms" })}>
            <ProviderButton provider="keplar" mode={mode} logo={<KeplarMark size={18} />} busy={busy === "keplar"} disabled={disabled} onClick={() => void go("keplar")} />
          </div>
          <div className="si-rise" style={vars({ "--d": "900ms" })}>
            <ProviderButton provider="google" mode={mode} logo={<GoogleLogo size={19} />} busy={busy === "google"} disabled={disabled}
              unavailable={providers ? !providers.google : false} onClick={() => void go("google")} />
          </div>
        </div>

        <div className="si-live" aria-live="polite">
          {busy && <span className="sr-only">Opening {NAMES[busy]} sign-in in a new window.</span>}
        </div>
        {error && (
          <div className="si-notice si-notice--warn" role="alert">
            <span>{error}</span>
          </div>
        )}
        {notice}

        <p className="si-fine si-rise" style={vars({ "--d": "1000ms" })}>
          You sign in on Roblox's, Keplar's or Google's own page. Space Studio never sees your password. By continuing you agree to the{" "}
          <ExternalLink href="https://keplar.one/terms">Terms</ExternalLink> and <ExternalLink href="https://keplar.one/privacy">Privacy Policy</ExternalLink>.
        </p>
      </section>

      <span className="si-foot si-rise" style={vars({ "--d": "1100ms" })}>
        Space Studio{version ? ` ${version}` : ""} · Windows, macOS and Linux
      </span>
    </div>
  );
}
