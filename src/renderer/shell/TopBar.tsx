import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NAV, useApp, type ViewId } from "../lib/app";
import { fx } from "../lib/fx";
import { useStats } from "../lib/stats";
import { RollingNumber, useGlide } from "../ui/RollingNumber";
import mark from "../assets/mark.png";
import robux from "../assets/robux.png";

const PLAN_LABEL: Record<string, string> = { free: "Free", plus: "Plus", pro: "Pro", team: "Team", enterprise: "Enterprise" };

/** Top left: the person's picture and name. Hover (or focus) expands it with their plan and credits and opens the account menu. */
function ProfilePill() {
  const { me, navigate, signOut } = useApp();
  if (!me?.signedIn) return null;
  const name = me.profile?.displayName || me.email?.split("@")[0] || "You";
  const handle = me.profile?.username ? `@${me.profile.username}` : me.email ?? "";
  const avatar = me.profile?.avatarUrl ?? null;
  const credits = me.credits;
  const left = credits && credits.limitedBy !== "custom" ? credits.remaining : null;
  const win = credits?.windows[0];
  const usedPct = win && win.limit > 0 ? Math.min(100, Math.round((win.used / win.limit) * 100)) : 0;
  return (
    <div className="me" data-tour="profile">
      <button type="button" className="me__pill" onClick={() => navigate("account")} aria-label={`${name}, ${PLAN_LABEL[me.plan.id]} plan${left != null ? `, ${left} credits left` : ""}. Open account.`}>
        <span className="me__avatar" aria-hidden="true">
          {avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : <span className="me__initial">{name.trim().charAt(0).toUpperCase() || "U"}</span>}
        </span>
        <span className="me__who">
          <b>{name}</b>
          <span>{handle}</span>
        </span>
        <span className="me__more" aria-hidden="true">
          <span className="chip">{PLAN_LABEL[me.plan.id]}</span>
          {left != null && <span className="chip"><RollingNumber value={left} /> credits</span>}
        </span>
      </button>
      <div className="me__card" role="menu" aria-label="Account menu">
        <button role="menuitem" type="button" onClick={() => navigate("account")}>Profile and linked accounts<span>›</span></button>
        <button role="menuitem" type="button" onClick={() => navigate("billing")}>Plan and credits<span className="me__credits">{left != null ? left.toLocaleString("en-US") : PLAN_LABEL[me.plan.id]}</span></button>
        {win && (
          <div className="me__meter" role="img" aria-label={`${usedPct}% of ${win.label.toLowerCase()} used`}>
            <i style={{ width: `${100 - usedPct}%` }} />
          </div>
        )}
        <button role="menuitem" type="button" onClick={() => navigate("account")}>Security<span>›</span></button>
        <button role="menuitem" type="button" onClick={() => void signOut()}>Sign out<span>›</span></button>
      </div>
    </div>
  );
}

/** The center tab bar. The white indicator springs between tabs with a horizontal motion blur while it travels. */
function NavTabs() {
  const { view, navigate } = useApp();
  const listRef = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);
  const [moving, setMoving] = useState(false);
  const measure = () => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-id="${view}"]`);
    if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth });
  };
  useLayoutEffect(measure, [view]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => window.removeEventListener("resize", measure);
  });
  const go = (id: ViewId) => {
    if (id === view) return;
    setMoving(true);
    window.setTimeout(() => setMoving(false), 420);
    fx.warp(0.32, 0.9);
    navigate(id);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const i = NAV.findIndex((n) => n.id === view);
    if (e.key === "ArrowRight") { e.preventDefault(); go(NAV[(i + 1) % NAV.length]!.id); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(NAV[(i - 1 + NAV.length) % NAV.length]!.id); }
  };
  return (
    <nav className="tabs" aria-label="Primary" data-tour="nav">
      <div className="tabs__list" ref={listRef} role="tablist" onKeyDown={onKey}>
        {ind && <span className="tabs__ind" data-moving={moving || undefined} style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} aria-hidden="true" />}
        {NAV.map((n) => (
          <button key={n.id} type="button" role="tab" data-id={n.id} aria-selected={n.id === view} tabIndex={n.id === view ? 0 : -1} className="tabs__tab" onClick={() => go(n.id)}>
            {n.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

/**
 * Top right: Robux earned in the last 30 days across the tracked experiences, from their own sales beacons. Hovering shows the
 * pending Robux (sales still inside Roblox's holding period) counting smoothly as new sales arrive.
 */
function RobuxPill() {
  const { me, navigate } = useApp();
  const stats = useStats(me?.signedIn ? "all" : null, "30d", 15_000);
  const data = stats.status === "ready" ? stats.data : null;
  const earned = data?.robux.earned ?? null;
  const pending = data?.robux.pending ?? null;
  const shownEarned = useGlide(earned ?? 0, 1400);
  const shownPending = useGlide(pending ?? 0, 1400);
  if (!me?.signedIn) return null;
  const known = earned != null;
  return (
    <button type="button" className="rbx" data-tour="robux" onClick={() => navigate("dashboard")}
      aria-label={known ? `${earned!.toLocaleString("en-US")} Robux earned in the last 30 days${pending != null ? `, ${pending.toLocaleString("en-US")} pending` : ""}. Open the dashboard.` : "Robux: connect an experience on the dashboard to see earnings."}>
      <img className="rbx__icon" src={robux} alt="" />
      <span className="rbx__main">
        {known ? <RollingNumber value={shownEarned} /> : <span className="rbx__none">Connect</span>}
      </span>
      <span className="rbx__more" aria-hidden="true">
        <span className="rbx__label">Pending</span>
        {pending != null ? <RollingNumber className="rbx__pending" value={shownPending} /> : <span className="rbx__none">—</span>}
        <span className="rbx__live" />
      </span>
    </button>
  );
}

function SpaceMark() {
  const { navigate } = useApp();
  return (
    <button type="button" className="space-pill" onClick={() => navigate("home")} aria-label="Space Studio home">
      <img src={mark} alt="" />
      <span>Space</span>
    </button>
  );
}

export function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar__l"><ProfilePill /></div>
      <NavTabs />
      <div className="topbar__r"><RobuxPill /><SpaceMark /></div>
    </header>
  );
}
