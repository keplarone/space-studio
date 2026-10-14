import { useLayoutEffect, useRef, useState } from "react";
import { Button, Popover, Toggle } from "../ui";
import { NAV, useApp } from "../lib/app";
import { bridge, connected } from "../lib/bridge";
import { motionPrefs, useUserReduceMotion } from "../lib/motion";
import markUrl from "../assets/mark.png";

function Settings() {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const [reduce, setReduce] = useUserReduceMotion();
  const { me, signOut, signIn } = useApp();
  return (
    <>
      <button ref={anchor} type="button" className="nav__item" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Settings
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} label="Settings" prefer="top" width={300}>
        <div className="settings">
          <Toggle
            label="Reduce motion"
            description={motionPrefs.osReduced() ? "Your system already asks for reduced motion." : "Turns off animations and stops the starfield."}
            checked={reduce}
            onChange={setReduce}
          />
          <div className="settings__sep" />
          {me?.signedIn ? (
            <Button variant="secondary" onClick={() => { setOpen(false); void signOut(); }}>Sign out</Button>
          ) : (
            <Button variant="secondary" disabled={!connected} onClick={() => { setOpen(false); void signIn(); }}>Sign in</Button>
          )}
          <p className="muted small">
            Space Studio {bridge ? `${bridge.version} on ${bridge.platform}` : "(not connected)"}
          </p>
        </div>
      </Popover>
    </>
  );
}

export function Sidebar() {
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
  }, [view]);

  const groups: { key: "main" | "work" | "account"; label: string }[] = [
    { key: "main", label: "General" },
    { key: "work", label: "Create" },
    { key: "account", label: "Account" },
  ];

  return (
    <nav className="sidebar" aria-label="Primary">
      <div className="sidebar__brand">
        <img className="brand-mark" src={markUrl} alt="" width={24} height={24} />
        <span className="sidebar__name">Space Studio<small>by Keplar</small></span>
      </div>
      <ul className="nav" ref={listRef}>
        {ind && <li className="nav__indicator" aria-hidden="true" style={{ transform: `translateY(${ind.y}px)`, height: ind.h }} />}
        {groups.map((g) => (
          <li key={g.key} className="nav__group">
            <span className="nav__group-label" id={`nav-${g.key}`}>{g.label}</span>
            <ul aria-labelledby={`nav-${g.key}`}>
              {NAV.filter((n) => n.group === g.key).map((n) => {
                const locked = n.id === "roblox" && !!me?.signedIn && me.robloxRequired && !me.robloxLinked;
                return (
                  <li key={n.id}>
                    <button type="button" className="nav__item" data-id={n.id} aria-current={view === n.id ? "page" : undefined}
                      aria-label={locked ? `${n.label} (locked until Roblox is linked)` : undefined} onClick={() => navigate(n.id)}>
                      {n.label}
                      {locked && <span className="nav__note" aria-hidden="true">Locked</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      <div className="sidebar__foot">
        {me?.signedIn && <p className="sidebar__plan">{me.plan.name} plan</p>}
        <Settings />
      </div>
    </nav>
  );
}
