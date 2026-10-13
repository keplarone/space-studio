import type { SVGProps } from "react";

/** Inline icon set — 24px grid, 1.5px stroke, round caps/joins. */
const PATHS = {
  home: "M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z",
  folder: "M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z",
  roblox: "M6.2 3.8 20.2 7.6 16.4 21.6 2.4 17.8z M10.6 10.3l3.4.9-.9 3.4-3.4-.9z",
  blender: "M14 6.5a6 6 0 1 1-6 6 M14 9.5a3 3 0 1 1-3 3 M3 9.5h8 M6 6.5l6.5-3",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2.5v2 M12 19.5v2 M4.6 4.6l1.4 1.4 M18 18l1.4 1.4 M2.5 12h2 M19.5 12h2 M4.6 19.4 6 18 M18 6l1.4-1.4",
  box: "M12 3 20 7.5v9L12 21l-8-4.5v-9z M4 7.5l8 4.5 8-4.5 M12 12v9",
  search: "M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z M15.5 15.5 20 20",
  cloud: "M7 18.5a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 9a4.75 4.75 0 0 1 .5 9.5z",
  history: "M4 12a8 8 0 1 0 2.4-5.7 M4 4.5v3.8h3.8 M12 8v4.5l3 2",
  shield: "M12 3.5 19 6v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6z M9 12l2.2 2.2L15.5 10",
  card: "M3.5 7A1.5 1.5 0 0 1 5 5.5h14A1.5 1.5 0 0 1 20.5 7v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17z M3.5 9.5h17 M7 15h4",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M19.4 13.5l1.6 1.2-1.8 3.1-1.9-.7a7.5 7.5 0 0 1-1.6.9L15.4 20h-3.6l-.3-2a7.5 7.5 0 0 1-1.6-.9l-1.9.7-1.8-3.1 1.6-1.2a7.6 7.6 0 0 1 0-1.9L6.2 10.3 8 7.2l1.9.7a7.5 7.5 0 0 1 1.6-.9l.3-2h3.6l.3 2a7.5 7.5 0 0 1 1.6.9l1.9-.7 1.8 3.1-1.6 1.2a7.6 7.6 0 0 1 0 1.9z",
  chevronDown: "M6 9.5l6 6 6-6",
  chevronRight: "M9.5 6l6 6-6 6",
  chevronLeft: "M14.5 6l-6 6 6 6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  close: "M6 6l12 12 M18 6 6 18",
  plus: "M12 5v14 M5 12h14",
  copy: "M8.5 8.5h10v11h-10z M15.5 8.5V4.5h-10v11h3",
  send: "M4.5 12 20 4.5 15.5 20l-3-6.5z M12.5 13.5 20 4.5",
  alert: "M12 4 21 19.5H3z M12 10v4 M12 17h.01",
  info: "M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z M12 11v5.5 M12 7.75h.01",
  lock: "M6.5 10.5h11v9.5h-11z M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  unlink: "M15.7 14l3-3a4 4 0 0 0-5.7-5.7l-1 1 M8.3 10l-3 3a4 4 0 0 0 5.7 5.7l1-1 M4 4l16 16",
  external: "M13.5 4.5h6v6 M19.5 4.5 11 13 M17 14v5H5V7h5",
  signOut: "M14.5 7.5V5h-9.5v14h9.5v-2.5 M10 12h10 M17 9l3 3-3 3",
  trash: "M4.5 7h15 M9.5 7V4.5h5V7 M6.5 7l1 12.5h9l1-12.5 M10.5 11v5 M13.5 11v5",
  download: "M12 4v11 M7.5 11 12 15.5 16.5 11 M5 19.5h14",
  sparkle: "M12 3.5 13.8 10.2 20.5 12l-6.7 1.8L12 20.5l-1.8-6.7L3.5 12l6.7-1.8z",
  panelRight: "M4 5h16v14H4z M14.5 5v14",
  panelLeft: "M4 5h16v14H4z M9.5 5v14",
  activity: "M3.5 12h4l2.5-6 4 12 2.5-6h4",
  monitor: "M4 5h16v11H4z M9 20h6 M12 16v4",
  user: "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8z M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5",
  google: "M20 12.2c0-.6 0-1.1-.2-1.7H12v3.3h4.5a3.9 3.9 0 0 1-1.7 2.5v2h2.7c1.6-1.4 2.5-3.6 2.5-6.1z M12 20.5c2.3 0 4.2-.8 5.5-2.1l-2.7-2a5 5 0 0 1-7.5-2.7H4.5v2.1A8.5 8.5 0 0 0 12 20.5z M7.3 13.7a5 5 0 0 1 0-3.4V8.2H4.5a8.5 8.5 0 0 0 0 7.6z M12 6.9c1.3 0 2.5.4 3.4 1.3l2.4-2.4A8.5 8.5 0 0 0 4.5 8.2l2.8 2.1A5 5 0 0 1 12 6.9z",
  keplar: "M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z M3.5 12c3-1.5 14-1.5 17 0 M12 3.5c-2 3-2 14 0 17",
  orbit: "M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z M4 12c0-2.2 3.6-4 8-4s8 1.8 8 4-3.6 4-8 4-8-1.8-8-4z",
  arrowUp: "M12 19V5 M6 11l6-6 6 6",
  grip: "M10 6h.01 M14 6h.01 M10 12h.01 M14 12h.01 M10 18h.01 M14 18h.01",
} as const;

export type IconName = keyof typeof PATHS;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  label?: string;
}

export function Icon({ name, size = 18, label, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={["icon", className].filter(Boolean).join(" ")}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Animated: check mark draws itself in. */
export function CheckResolve({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" className="icon icon-check-resolve" aria-hidden="true" focusable="false">
      <path d={PATHS.check} pathLength={1} />
    </svg>
  );
}

/** Animated: chevron that rotates with `open`. */
export function Chevron({ open, size = 16 }: { open: boolean; size?: number }) {
  return <Icon name="chevronRight" size={size} className="icon-chevron" data-open={open ? "true" : "false"} />;
}

/** Animated: orbit mark — the satellite swings to a new position whenever `spinKey` changes. */
export function ModelSwitchIcon({ spinKey, size = 16 }: { spinKey: string; size?: number }) {
  return (
    <svg key={spinKey} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" className="icon icon-model-switch" aria-hidden="true" focusable="false">
      <ellipse cx="12" cy="12" rx="8.5" ry="4" />
      <circle cx="12" cy="12" r="2.2" />
      <g className="icon-model-switch__sat">
        <circle cx="20.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" className="icon icon-spinner" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8" opacity="0.25" />
      <path d="M20 12a8 8 0 0 0-8-8" />
    </svg>
  );
}
