import { useLayoutEffect, useRef, useState } from "react";
import { Button, Icon, Popover, Toggle, Tooltip } from "../ui";
import { PlanBadge } from "../ui/common";
import { NAV, useApp } from "../lib/app";
import { bridge, connected } from "../lib/bridge";
import { motionPrefs, useUserReduceMotion } from "../lib/motion";
import markUrl from "../assets/mark.png";

function Settings({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const [reduce, setReduce] = useUserReduceMotion();
  const { me, signOut, signIn } = useApp();
  return (
    <>
      <button ref={anchor} type="button" className="nav__item nav__item--settings" aria-haspopup="dialog" aria-expanded={open}
        aria-label={collapsed ? "Settings" : undefined} onClick={() => setOpen((o) => !o)}>
        <Icon name="settings" size={18} />
        <span className="nav__label">Settings</span>
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} label="Settings" prefer="top" width={300}>
        <div className="settings">
          <Toggle
            label="Reduce motion"
            description={motionPrefs.osReduced() ? "Your system already asks for reduced motion." : "Minimise animations and stop the starfield."}
            checked={reduce}
            onChange={setReduce}
          />
          <div className="settings__sep" />
          {me?.signedIn ? (
            <Button variant="secondary" icon="signOut" onClick={() => { setOpen(false); void signOut(); }}>Sign out</Button>
          ) : (
            <Button variant="secondary" icon="user" disabled={!connected} onClick={() => { setOpen(false); void signIn(); }}>Sign in</Button>
          )}
          <p className="muted small settings__ver">
            Space Studio {bridge ? `v${bridge.version} · ${bridge.platform}` : "(not connected)"}
          </p>
        </div>
      </Popover>
    </>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { view, navigate, me } = useApp();
  const listRef = useRef<HTMLUListElement>(null);
  const [ind, setInd] = useState<{ y: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const list = listRef.current;
      const el = list?.querySelector<HTMLElement>(`[data-id="${view}"]`);
      if (list && el) setInd({ y: el.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop, h: el.offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (listRef.current) ro.observe(listRef.current);
    return () => ro.disconnect();
  }, [view, collapsed]);

  const groups: { key: "main" | "work" | "account"; label: string }[] = [
    { key: "main", label: "General" },
    { key: "work", label: "Create" },
    { key: "account", label: "Account" },
  ];

  return (
    <nav className="sidebar" data-collapsed={collapsed ? "true" : "false"} aria-label="Primary">
      <div className="sidebar__brand">
        <img className="brand-mark" src={markUrl} alt="" width={28} height={28} />
        <span className="sidebar__name">Space Studio<small>by Keplar</small></span>
      </div>
      <ul className="nav" ref={listRef}>
        {ind && <li className="nav__indicator" aria-hidden="true" style={{ transform: `translateY(${ind.y}px)`, height: ind.h }} />}
        {groups.map((g) => (
          <li key={g.key} className="nav__group">
            <span className="nav__group-label">{g.label}</span>
            <ul>
              {NAV.filter((n) => n.group === g.key).map((n) => {
                const btn = (
                  <button type="button" className="nav__item" data-id={n.id} aria-current={view === n.id ? "page" : undefined}
                    aria-label={collapsed ? n.label : undefined} onClick={() => navigate(n.id)}>
                    <Icon name={n.icon} size={18} />
                    <span className="nav__label">{n.label}</span>
                    {n.id === "roblox" && me?.signedIn && me.robloxRequired && !me.robloxLinked && <Icon name="lock" size={14} className="nav__lock" label="Locked" />}
                  </button>
                );
                return <li key={n.id}>{collapsed ? <Tooltip text={n.label} side="right">{btn}</Tooltip> : btn}</li>;
              })}
            </ul>
          </li>
        ))}
      </ul>
      <div className="sidebar__foot">
        {!collapsed && me?.signedIn && <div className="sidebar__plan"><PlanBadge plan={me.plan.id} name={me.plan.name} /></div>}
        <Settings collapsed={collapsed} />
        <button type="button" className="nav__item" onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <Icon name={collapsed ? "chevronRight" : "chevronLeft"} size={18} />
          <span className="nav__label">Collapse</span>
        </button>
      </div>
    </nav>
  );
}
