import { useEffect, useRef, useState, type ReactNode } from "react";
import { Starfield } from "./starfield/Starfield";
import { Sidebar } from "./layout/Sidebar";
import { AiPanel, AI_MAX, AI_MIN } from "./layout/AiPanel";
import { ActivityPanel } from "./layout/ActivityPanel";
import { Button } from "./ui";
import { AppProvider, NAV, useApp, type ViewId } from "./lib/app";
import { load, remove, save } from "./lib/storage";
import { useReducedMotion } from "./lib/motion";
import { Home } from "./views/Home";
import { Workspace } from "./views/Workspace";
import { Cloud } from "./views/Cloud";
import { Account } from "./views/Account";
import { Billing } from "./views/Billing";
import { Assets, Projects, Research, SolarSmart, TaskHistory } from "./views/Simple";

const VIEWS: Record<ViewId, () => ReactNode> = {
  home: () => <Home />,
  projects: () => <Projects />,
  roblox: () => <Workspace kind="roblox" />,
  blender: () => <Workspace kind="blender" />,
  solar: () => <SolarSmart />,
  assets: () => <Assets />,
  research: () => <Research />,
  cloud: () => <Cloud />,
  history: () => <TaskHistory />,
  account: () => <Account />,
  billing: () => <Billing />,
};

/**
 * All views stay mounted (state + scroll preserved). Inactive views are `hidden` + `inert`.
 * The incoming view animates in with a short directional translate+opacity via WAAPI,
 * cancelling any in-flight animation so rapid switching is interruptible.
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
    if (!el || reduced) return;
    anim.current = el.animate(
      [
        { opacity: 0, transform: `translateY(${dir * 10}px)` },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    // Move focus to the view heading for screen readers / keyboard users.
    el.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, [view, reduced]);

  return (
    <>
      {NAV.map((n) =>
        visited.has(n.id) || n.id === view ? (
          <div
            key={n.id}
            ref={(el) => {
              refs.current[n.id] = el;
            }}
            className="view"
            hidden={n.id !== view}
            inert={n.id !== view}
            data-view={n.id}
          >
            {VIEWS[n.id]()}
          </div>
        ) : null,
      )}
    </>
  );
}

function Shell() {
  const [aiOpen, setAiOpen] = useState<boolean>(() => load("aiOpen", true));
  const [aiWidth, setAiWidth] = useState<number>(() => Math.max(AI_MIN, Math.min(AI_MAX, load("aiWidth", 340))));
  const [actOpen, setActOpen] = useState<boolean>(() => load("activityOpen", false));

  useEffect(() => remove("sidebarCollapsed"), []); // the sidebar no longer collapses; drop the old preference
  useEffect(() => save("aiOpen", aiOpen), [aiOpen]);
  useEffect(() => save("activityOpen", actOpen), [actOpen]);
  useEffect(() => {
    const t = window.setTimeout(() => save("aiWidth", aiWidth), 200);
    return () => window.clearTimeout(t);
  }, [aiWidth]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <Sidebar />
      <div className="center">
        <main id="main" className="main" tabIndex={-1}>
          {!aiOpen && (
            <div className="main__tools">
              <Button size="sm" variant="ghost" onClick={() => setAiOpen(true)}>Show assistant</Button>
            </div>
          )}
          <Views />
        </main>
        <ActivityPanel open={actOpen} onToggle={() => setActOpen((o) => !o)} />
      </div>
      {aiOpen && <AiPanel width={aiWidth} setWidth={setAiWidth} onClose={() => setAiOpen(false)} />}
    </div>
  );
}

export function App() {
  return (
    <AppProvider>
      <Starfield />
      <Shell />
    </AppProvider>
  );
}
