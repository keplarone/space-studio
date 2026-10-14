import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Starfield } from "./starfield/Starfield";
import { Aura, MotionFilters } from "./shell/Atmosphere";
import { TopBar } from "./shell/TopBar";
import { Tutorial } from "./shell/Tutorial";
import { AppProvider, NAV, useApp, type ViewId } from "./lib/app";
import { connected } from "./lib/bridge";
import { fx } from "./lib/fx";
import { load, save } from "./lib/storage";
import { useReducedMotion } from "./lib/motion";
import { Home } from "./views/Home";
import { Dashboard } from "./views/Dashboard";
import { Workspace } from "./views/Workspace";
import { Cloud } from "./views/Cloud";
import { Account } from "./views/Account";
import { Billing } from "./views/Billing";
import { SignIn } from "./views/SignIn";
import { Onboarding } from "./views/Onboarding";
import mark from "./assets/mark.png";

const VIEWS: Record<ViewId, () => ReactNode> = {
  home: () => <Home />,
  dashboard: () => <Dashboard />,
  roblox: () => <Workspace kind="roblox" />,
  blender: () => <Workspace kind="blender" />,
  cloud: () => <Cloud />,
  billing: () => <Billing />,
  account: () => <Account />,
};

/**
 * All visited views stay mounted (state and scroll kept). The incoming view slides in from the direction of travel through a
 * motion blur that resolves as it settles; rapid switching cancels the previous animation.
 */
function Views() {
  const { view } = useApp();
  const reduced = useReducedMotion();
  const refs = useRef<Partial<Record<ViewId, HTMLDivElement | null>>>({});
  const prev = useRef<ViewId>(view);
  const anim = useRef<Animation | null>(null);
  const [visited, setVisited] = useState<Set<ViewId>>(() => new Set([view]));

  useEffect(() => {
    setVisited((v) => (v.has(view) ? v : new Set(v).add(view)));
    if (prev.current === view) return;
    const order = NAV.map((n) => n.id);
    const dir = order.indexOf(view) > order.indexOf(prev.current) ? 1 : -1;
    prev.current = view;
    anim.current?.cancel();
    const el = refs.current[view];
    if (!el) return;
    if (!reduced) {
      anim.current = el.animate(
        [
          { opacity: 0, transform: `translateX(${dir * 72}px) scale(0.985)`, filter: "blur(14px)" },
          { opacity: 1, transform: `translateX(${dir * -4}px) scale(1)`, filter: "blur(1.5px)", offset: 0.6 },
          { opacity: 1, transform: "translateX(0) scale(1)", filter: "blur(0px)" },
        ],
        { duration: 560, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      );
      anim.current.onfinish = () => { el.style.filter = ""; };
    }
    el.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, [view, reduced]);

  return (
    <>
      {NAV.map((n) =>
        visited.has(n.id) || n.id === view ? (
          <div key={n.id} ref={(el) => { refs.current[n.id] = el; }} className="view" hidden={n.id !== view} inert={n.id !== view} data-view={n.id}>
            {VIEWS[n.id]()}
          </div>
        ) : null,
      )}
    </>
  );
}

/** The main app. `arriving` plays the end-of-onboarding entrance; the tutorial follows it once. */
function Shell({ arriving, onArrived }: { arriving: boolean; onArrived: () => void }) {
  const [tour, setTour] = useState(false);
  useEffect(() => {
    if (!arriving) { if (!load("tourDone", false)) setTour(true); return; }
    fx.arrive();
    const t = window.setTimeout(() => { onArrived(); setTour(true); }, 2600);
    return () => window.clearTimeout(t);
  }, [arriving, onArrived]);
  return (
    <div className="shell" data-arriving={arriving || undefined}>
      <a className="skip-link" href="#main">Skip to content</a>
      <TopBar />
      <main id="main" className="main" tabIndex={-1}>
        <Views />
      </main>
      {arriving && <div className="arrival-flash" aria-hidden="true" />}
      {tour && !arriving && <Tutorial onDone={() => { save("tourDone", true); setTour(false); }} />}
    </div>
  );
}

function Splash() {
  return (
    <div className="splash" role="status" aria-label="Loading Space Studio">
      <img src={mark} alt="" />
    </div>
  );
}

/** Sign in -> onboarding -> arrival -> the app (with a one-time tutorial). */
function Gate() {
  const { meState, me } = useApp();
  const [arriving, setArriving] = useState(false);
  const wasOnboarding = useRef(false);
  const arrived = useCallback(() => setArriving(false), []);
  const onboardingDone = !me?.signedIn || me.onboarding == null || me.onboarding.completed;

  useEffect(() => {
    if (me?.signedIn && !onboardingDone) wasOnboarding.current = true;
    if (me?.signedIn && onboardingDone && wasOnboarding.current) { wasOnboarding.current = false; setArriving(true); }
  }, [me?.signedIn, onboardingDone]);

  if (connected && meState.kind === "loading") return <Splash />;
  if (!connected || meState.kind !== "ready" || !me?.signedIn) return <SignIn />;
  if (!onboardingDone) return <Onboarding />;
  return <Shell arriving={arriving} onArrived={arrived} />;
}

export function App() {
  return (
    <AppProvider>
      <MotionFilters />
      <Starfield />
      <Aura />
      <Gate />
    </AppProvider>
  );
}
