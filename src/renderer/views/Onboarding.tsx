import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useApp } from "../lib/app";
import { api, errorMessage } from "../lib/bridge";
import { useReducedMotion } from "../lib/motion";
import type { CreatorExperience, CreatorGoal, CreatorRole, ProfileRequest, ProfileResponse } from "../lib/types";
import mark from "../assets/mark.png";

type StepId = "dob" | "parent" | "make" | "experience" | "goals" | "privacy";
type Dir = 1 | -1;

const vars = (v: Record<string, string | number>) => v as CSSProperties;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const ROLES: { id: CreatorRole; title: string; line: string }[] = [
  { id: "roblox", title: "Roblox games", line: "Luau, systems, UI and worlds." },
  { id: "blender", title: "Blender assets", line: "Models, materials and scenes." },
  { id: "both", title: "Both", line: "Games, and the assets made to fit them." },
  { id: "exploring", title: "Just exploring", line: "See what Space Studio can do." },
];

const LEVELS: { id: CreatorExperience; title: string; line: string }[] = [
  { id: "new", title: "New to this", line: "Starting my first project." },
  { id: "some", title: "Some experience", line: "A few projects so far." },
  { id: "experienced", title: "Experienced", line: "I've shipped games or assets." },
  { id: "studio", title: "Pro studio", line: "I run a studio or a team." },
];

const GOALS: { id: CreatorGoal; label: string }[] = [
  { id: "ship_faster", label: "Ship faster" },
  { id: "learn_luau", label: "Learn Luau" },
  { id: "fix_bugs", label: "Fix bugs" },
  { id: "grow_players", label: "Grow players" },
  { id: "monetize", label: "Monetize" },
  { id: "make_3d_assets", label: "Make 3D assets" },
];

const WORKSPACES: Record<CreatorRole, ("roblox" | "blender")[]> = {
  roblox: ["roblox"],
  blender: ["blender"],
  both: ["roblox", "blender"],
  exploring: ["roblox", "blender"],
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ---------- Date of birth ---------- */

interface Dob { month: string; day: string; year: string }

type DobCheck = { ok: true; iso: string; age: number } | { ok: false; error: string };

/** A real calendar date, not in the future and not more than 120 years ago. Age is computed locally for the flow only. */
export function checkDob({ month, day, year }: Dob, today = new Date()): DobCheck {
  if (!month || !day || !year) return { ok: false, error: "Enter your full date of birth: month, day and year." };
  const m = Number(month), d = Number(day), y = Number(year);
  if (!/^\d{4}$/.test(year)) return { ok: false, error: "Enter the year with four digits, like 2009." };
  if (!Number.isInteger(d) || d < 1 || d > 31) return { ok: false, error: "Enter a day between 1 and 31." };
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return { ok: false, error: `${MONTHS[m - 1]} ${year} doesn't have a day ${d}. Check the day and month.` };
  }
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (date > t) return { ok: false, error: "That date is in the future. Check the year." };
  let age = t.getFullYear() - y;
  if (t.getMonth() < m - 1 || (t.getMonth() === m - 1 && t.getDate() < d)) age -= 1;
  if (age > 120) return { ok: false, error: "That's more than 120 years ago. Check the year." };
  const iso = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { ok: true, iso, age };
}

/* ---------- Small pieces ---------- */

/** Single choice as a radio group of tiles. Arrow keys move and select, like native radios. */
function Tiles<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; title: string; line: string }[]; value: T | null; onChange: (v: T) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const idx = options.findIndex((o) => o.id === value);
  const onKey = (e: KeyboardEvent) => {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = options[((idx < 0 ? (delta > 0 ? -1 : 0) : idx) + delta + options.length) % options.length]!;
    onChange(next.id);
    ref.current?.querySelector<HTMLElement>(`[data-id="${next.id}"]`)?.focus();
  };
  return (
    <div className="ob-tiles" role="radiogroup" aria-label={label} ref={ref} onKeyDown={onKey}>
      {options.map((o, i) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          data-id={o.id}
          aria-checked={value === o.id}
          tabIndex={value === o.id || (idx < 0 && i === 0) ? 0 : -1}
          className="ob-tile ob-r"
          style={vars({ "--d": `${260 + i * 60}ms` })}
          onClick={() => onChange(o.id)}
        >
          <span className="ob-tile__title">{o.title}</span>
          <span className="ob-tile__line">{o.line}</span>
        </button>
      ))}
    </div>
  );
}

function Switch({ checked, onChange, title, desc, delay }: { checked: boolean; onChange: (v: boolean) => void; title: string; desc: string; delay: number }) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-d`}
      className="ob-switch ob-r"
      style={vars({ "--d": `${delay}ms` })}
      onClick={() => onChange(!checked)}
    >
      <span className="ob-switch__text">
        <span id={`${id}-t`} className="ob-switch__title">{title}</span>
        <span id={`${id}-d`} className="ob-switch__desc">{desc}</span>
      </span>
      <span className="ob-switch__track" aria-hidden="true"><span className="ob-switch__thumb" /></span>
    </button>
  );
}

/** Masks an email for display: p•••@example.com. */
function maskEmail(e: string): string {
  const [u, d] = e.split("@");
  if (!u || !d) return e;
  return `${u.charAt(0)}${"•".repeat(Math.min(5, Math.max(2, u.length - 1)))}@${d}`;
}

/* ---------- Waiting for a parent ---------- */

function Waiting({ sent, email, onResolved }: { sent: boolean | null; email: string | null; onResolved: () => void }) {
  const { refreshMe, signOut, me } = useApp();
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  const h1 = useRef<HTMLHeadingElement>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; h1.current?.focus({ preventScroll: true }); return () => { alive.current = false; }; }, []);

  const refresh = async () => {
    setChecking(true);
    const fresh = await refreshMe();
    if (!alive.current) return;
    setChecking(false);
    if (!fresh) return;
    if (fresh.onboarding?.parentConsent === "awaiting_parent") setCheckedAt(Date.now());
    else onResolved();
  };

  const who = email ? maskEmail(email) : null;
  let title: ReactNode;
  let body: string;
  if (sent === false) {
    title = <>Almost there. <span className="grad-text">One more thing.</span></>;
    body = `Your answers are saved, but the email to ${who ?? "your parent or guardian"} didn't go out. Check the address with them, then refresh.`;
  } else {
    title = <>We emailed your <span className="grad-text">parent or guardian</span>.</>;
    body = `${who ? `It went to ${who}. ` : ""}Once they approve, Space Studio unlocks right here. Until then, AI features stay off.`;
  }

  return (
    <div className="ob-wait">
      <div className="ob-beacon ob-r" style={vars({ "--d": "80ms" })} aria-hidden="true">
        <span className="ob-beacon__halo" />
        <span className="ob-beacon__halo ob-beacon__halo--late" />
        <img src={mark} alt="" />
      </div>
      <span className="ob-eyebrow ob-eyebrow--amber ob-r" style={vars({ "--d": "180ms" })}>Waiting for a parent</span>
      <h1 ref={h1} tabIndex={-1} className="ob-title ob-r" style={vars({ "--d": "240ms" })}>{title}</h1>
      <p className="ob-copy ob-r" style={vars({ "--d": "320ms" })}>{body}</p>
      <div className="ob-wait__bar ob-r" style={vars({ "--d": "380ms" })} aria-hidden="true"><i /></div>
      <p className="ob-wait__status" role="status">
        {checking ? "Checking…" : checkedAt ? "Still waiting for approval. We checked just now." : ""}
      </p>
      <div className="ob-wait__actions ob-r" style={vars({ "--d": "440ms" })}>
        <button type="button" className="ob-btn btn3d" onClick={() => void refresh()} disabled={checking} aria-busy={checking || undefined}>
          {checking ? "Checking…" : "Refresh"}
        </button>
        <button type="button" className="ob-ghost" disabled={leaving} onClick={() => { setLeaving(true); void signOut(); }}>
          {leaving ? "Signing out…" : `Sign out${me?.email ? ` of ${me.email}` : ""}`}
        </button>
      </div>
    </div>
  );
}

/* ---------- The flow ---------- */

/** One question per screen. The server decides everything for real; the flow only shapes what it asks. */
export function Onboarding() {
  const { me, refreshMe, signOut } = useApp();
  const reduced = useReducedMotion();

  const [dob, setDob] = useState<Dob>({ month: "", day: "", year: "" });
  const [dobError, setDobError] = useState<string | null>(null);
  const [parentEmail, setParentEmail] = useState("");
  const [parentError, setParentError] = useState<string | null>(null);
  const [role, setRole] = useState<CreatorRole | null>(null);
  const [experience, setExperience] = useState<CreatorExperience | null>(null);
  const [goals, setGoals] = useState<CreatorGoal[]>([]);
  const [productEmails, setProductEmails] = useState(false);
  const [improve, setImprove] = useState(false);

  const [step, setStep] = useState<StepId>("dob");
  const [dir, setDir] = useState<Dir>(1);
  const [exiting, setExiting] = useState<{ id: StepId; dir: Dir; key: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [waiting, setWaiting] = useState<{ sent: boolean | null; email: string | null } | null>(
    me?.onboarding?.parentConsent === "awaiting_parent" ? { sent: null, email: null } : null,
  );
  const [signingOut, setSigningOut] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const seq = useRef(0);
  const firstStep = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // Opening the app while a parent hasn't answered yet goes straight to the waiting screen; approval brings the flow back.
  const awaitingNow = me?.onboarding?.parentConsent === "awaiting_parent";
  useEffect(() => {
    if (awaitingNow) setWaiting((w) => w ?? { sent: null, email: null });
    else setWaiting(null);
  }, [awaitingNow]);

  const dobCheck = useMemo(() => checkDob(dob), [dob]);
  const under13 = dobCheck.ok && dobCheck.age < 13;
  const steps: StepId[] = useMemo(() => ["dob", ...(under13 ? (["parent"] as const) : []), "make", "experience", "goals", "privacy"], [under13]);
  const index = Math.max(0, steps.indexOf(step));

  useEffect(() => {
    if (firstStep.current) { firstStep.current = false; return; }
    titleRef.current?.focus({ preventScroll: true });
  }, [step]);

  const goTo = (next: StepId, d: Dir) => {
    if (next === step) return;
    setDir(d);
    setSubmitError(null);
    if (!reduced) setExiting({ id: step, dir: d, key: ++seq.current });
    setStep(next);
  };
  const next = () => { const n = steps[index + 1]; if (n) goTo(n, 1); };
  const back = () => { const p = steps[index - 1]; if (p) goTo(p, -1); };

  useEffect(() => {
    if (!exiting) return;
    const t = window.setTimeout(() => setExiting((e) => (e?.key === exiting.key ? null : e)), 560);
    return () => window.clearTimeout(t);
  }, [exiting]);

  const submit = async () => {
    if (submitting || !dobCheck.ok) return;
    setSubmitting(true);
    setSubmitError(null);
    const body: ProfileRequest = {
      birthDate: dobCheck.iso,
      role,
      experience,
      goals,
      workspaces: role ? WORKSPACES[role] : [],
      consents: { productEmails: under13 ? false : productEmails, improveWithUsage: improve },
      ...(under13 ? { parentEmail: parentEmail.trim() } : {}),
    };
    const r = await api<ProfileResponse>("POST", "/api/space-studio/profile", body);
    if (!alive.current) return;
    if (r.status < 200 || r.status >= 300) {
      setSubmitting(false);
      setSubmitError(
        r.status === 404
          ? "Space Studio can't save your answers yet: this step isn't available on the server. Your answers are kept here; try again in a little while."
          : errorMessage(r.status, r.data, "Your answers didn't save."),
      );
      return;
    }
    const d = r.data ?? {};
    const pc = d.parentConsent;
    const pcStatus = typeof pc === "string" ? pc : pc?.status ?? d.onboarding?.parentConsent ?? null;
    if (pcStatus === "awaiting_parent") {
      const sent = typeof pc === "object" && pc && typeof pc.emailSent === "boolean" ? pc.emailSent : typeof d.emailSent === "boolean" ? d.emailSent : null;
      const email = (typeof pc === "object" && pc?.email) || (under13 ? parentEmail.trim() : null);
      setWaiting({ sent, email });
      setSubmitting(false);
      void refreshMe();
      return;
    }
    setLeaving(true);
    await new Promise((res) => window.setTimeout(res, reduced ? 0 : 620));
    const fresh = await refreshMe();
    if (!alive.current) return;
    // Still here: the account didn't flip to "completed" (or a parent must approve after all).
    setLeaving(false);
    setSubmitting(false);
    if (fresh?.onboarding?.parentConsent === "awaiting_parent") setWaiting({ sent: null, email: under13 ? parentEmail.trim() : null });
    else if (fresh) setSubmitError("Your answers were saved, but your account hasn't caught up yet. Try again in a moment.");
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step === "dob") {
      if (!dobCheck.ok) { setDobError(dobCheck.error); return; }
      setDobError(null);
      next();
    } else if (step === "parent") {
      const v = parentEmail.trim();
      if (!EMAIL.test(v)) { setParentError("Enter a valid email address, like parent@example.com."); return; }
      if (me?.email && v.toLowerCase() === me.email.toLowerCase()) { setParentError("That's your own email. Enter your parent's or guardian's instead."); return; }
      setParentError(null);
      next();
    } else if (step === "privacy") {
      void submit();
    } else next();
  };

  const skip = () => {
    if (step === "make") setRole(null);
    if (step === "experience") setExperience(null);
    if (step === "goals") setGoals([]);
    next();
  };

  const signOutNow = () => { setSigningOut(true); void signOut(); };

  /** Renders one step. `live` is false for the copy that is sliding out (inert, hidden from assistive tech). */
  const render = (id: StepId, live: boolean): ReactNode => {
    const optional = id === "make" || id === "experience" || id === "goals";
    const pos = steps.indexOf(id) + 1;
    const head = (eyebrow: ReactNode, title: ReactNode, copy: ReactNode, amber = false) => (
      <div className="ob-head">
        <span className={amber ? "ob-eyebrow ob-eyebrow--amber ob-r" : "ob-eyebrow ob-r"} style={vars({ "--d": "40ms" })}>{eyebrow}</span>
        <h1 ref={live ? titleRef : undefined} tabIndex={-1} className="ob-title ob-r" style={vars({ "--d": "100ms" })}>{title}</h1>
        <p className="ob-copy ob-r" style={vars({ "--d": "170ms" })}>{copy}</p>
      </div>
    );

    let content: ReactNode;
    switch (id) {
      case "dob": {
        const invalid = !!dobError;
        content = (
          <>
            {head("Step 1 · Required", "When were you born?", "We ask everyone so we can keep younger creators safe. It's never shown to anyone.")}
            <fieldset className="ob-dob ob-r" style={vars({ "--d": "250ms" })} aria-describedby={invalid ? "ob-dob-err" : undefined}>
              <legend className="sr-only">Date of birth</legend>
              <label className="ob-field">
                <span>Month</span>
                <select
                  className="ob-input ob-select"
                  value={dob.month}
                  autoComplete={live ? "bday-month" : "off"}
                  aria-invalid={invalid || undefined}
                  onChange={(e) => { setDob({ ...dob, month: e.target.value }); setDobError(null); }}
                >
                  <option value="" disabled>Month</option>
                  {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
                </select>
              </label>
              <label className="ob-field">
                <span>Day</span>
                <input
                  ref={live ? dayRef : undefined}
                  className="ob-input"
                  inputMode="numeric"
                  autoComplete={live ? "bday-day" : "off"}
                  placeholder="DD"
                  maxLength={2}
                  value={dob.day}
                  aria-invalid={invalid || undefined}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                    setDob({ ...dob, day: v });
                    setDobError(null);
                    if (v.length === 2 || (v.length === 1 && Number(v) > 3)) yearRef.current?.focus();
                  }}
                />
              </label>
              <label className="ob-field">
                <span>Year</span>
                <input
                  ref={live ? yearRef : undefined}
                  className="ob-input"
                  inputMode="numeric"
                  autoComplete={live ? "bday-year" : "off"}
                  placeholder="YYYY"
                  maxLength={4}
                  value={dob.year}
                  aria-invalid={invalid || undefined}
                  onChange={(e) => { setDob({ ...dob, year: e.target.value.replace(/\D/g, "").slice(0, 4) }); setDobError(null); }}
                  onKeyDown={(e) => { if (e.key === "Backspace" && !dob.year) dayRef.current?.focus(); }}
                />
              </label>
            </fieldset>
            {live && dobError && <p id="ob-dob-err" className="ob-error" role="alert">{dobError}</p>}
          </>
        );
        break;
      }
      case "parent":
        content = (
          <>
            {head(
              "A parent needs to say yes",
              "Ask a parent or guardian",
              "Because you're under 13, a parent or guardian has to approve before you can use the AI features. We'll email them what Space Studio is and what it keeps. Nothing else is shared until they say yes.",
              true,
            )}
            <label className="ob-field ob-r" style={vars({ "--d": "250ms" })}>
              <span>Parent or guardian's email</span>
              <input
                className="ob-input"
                type="email"
                autoComplete="off"
                spellCheck={false}
                placeholder="parent@example.com"
                value={parentEmail}
                aria-invalid={!!parentError || undefined}
                aria-describedby={parentError ? "ob-parent-err" : undefined}
                onChange={(e) => { setParentEmail(e.target.value); setParentError(null); }}
              />
            </label>
            {live && parentError && <p id="ob-parent-err" className="ob-error" role="alert">{parentError}</p>}
          </>
        );
        break;
      case "make":
        content = (
          <>
            {head(`Step ${pos} · Optional`, "What do you make?", "So Space Studio opens on the right workspace and suggests the right setup.")}
            <Tiles label="What do you make?" options={ROLES} value={role} onChange={setRole} />
          </>
        );
        break;
      case "experience":
        content = (
          <>
            {head(`Step ${pos} · Optional`, "How experienced are you?", "We'll match explanations to your level: more teaching early on, less once you've shipped.")}
            <Tiles label="How experienced are you?" options={LEVELS} value={experience} onChange={setExperience} />
          </>
        );
        break;
      case "goals":
        content = (
          <>
            {head(`Step ${pos} · Optional`, "What should Space Studio help with?", "Pick as many as you like. Your home screen and suggestions start from these.")}
            <div className="ob-chips" role="group" aria-label="Goals">
              {GOALS.map((g, i) => {
                const on = goals.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={on}
                    className="ob-chip ob-r"
                    style={vars({ "--d": `${250 + i * 45}ms` })}
                    onClick={() => setGoals((cur) => (on ? cur.filter((x) => x !== g.id) : [...cur, g.id]))}
                  >
                    <span className="ob-chip__dot" aria-hidden="true" />
                    {g.label}
                  </button>
                );
              })}
            </div>
          </>
        );
        break;
      case "privacy":
        content = (
          <>
            {head("Last step · Your choice", "How your answers are used", under13 ? "This stays off unless you turn it on. You can change it any time in Account." : "Both stay off unless you turn them on. You can change them any time in Account.")}
            <div className="ob-switches">
              {!under13 && (
                <Switch checked={productEmails} onChange={setProductEmails} delay={250}
                  title="Product emails" desc="New features and tips. A few a month at most." />
              )}
              <Switch checked={improve} onChange={setImprove} delay={310}
                title="Help improve Space Studio" desc="Share which screens and features get used. Never your code, prompts or files." />
              {under13 && <p className="ob-note ob-r" style={vars({ "--d": "360ms" })}>Product emails stay off for creators under 13.</p>}
            </div>
            {live && submitError && <p className="ob-error" role="alert">{submitError}</p>}
          </>
        );
        break;
    }

    const last = id === "privacy";
    return (
      <form className="ob-form" onSubmit={live ? onSubmit : (e) => e.preventDefault()} noValidate>
        <div className="ob-body">{content}</div>
        <div className="ob-actions ob-r" style={vars({ "--d": "360ms" })}>
          {pos > 1 && <button type="button" className="ob-ghost" onClick={back} disabled={submitting}>Back</button>}
          <span className="ob-spacer" />
          {optional && <button type="button" className="ob-ghost" onClick={skip}>Skip</button>}
          <button type="submit" className={last ? "ob-btn ob-btn--enter btn3d" : "ob-btn btn3d"} disabled={submitting} aria-busy={(last && submitting) || undefined}
            data-busy={(last && submitting) || undefined}>
            {last ? (submitting ? "Setting up your space…" : "Enter Space Studio") : id === "parent" ? "Send request" : "Continue"}
          </button>
        </div>
      </form>
    );
  };

  const total = steps.length;
  const progress = waiting ? 1 : (index + 1) / total;
  const progressLabel = waiting ? "Waiting for a parent" : `Step ${index + 1} of ${total}`;

  return (
    <div className="ob" data-leaving={leaving || undefined}>
      <header className="ob-top">
        <span className="ob-brand ob-r" style={vars({ "--d": "40ms" })}>
          <img src={mark} alt="" />
          <span>Space</span>
        </span>
        <div className="ob-top__r ob-r" style={vars({ "--d": "120ms" })}>
          <div className="ob-progress">
            <span className="ob-progress__label" aria-hidden="true">
              <span key={progressLabel} className="ob-progress__text">{progressLabel}</span>
            </span>
            <span
              className="ob-progress__track"
              role="progressbar"
              aria-label="Setup progress"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={waiting ? total : index + 1}
              aria-valuetext={progressLabel}
            >
              <span className="ob-progress__fill" style={{ transform: `scaleX(${progress})` }} />
            </span>
          </div>
          {!waiting && (
            <button type="button" className="ob-ghost ob-ghost--sm" onClick={signOutNow} disabled={signingOut}>
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          )}
        </div>
      </header>

      <main className="ob-main">
        <div className="ob-card">
          <div className="ob-sheen" aria-hidden="true" />
          {waiting ? (
            <Waiting sent={waiting.sent} email={waiting.email} onResolved={() => setWaiting(null)} />
          ) : (
            <div className="ob-stage">
              {exiting && (
                <div key={`x${exiting.key}`} className="ob-step ob-step--out" data-dir={exiting.dir} inert aria-hidden="true">
                  {render(exiting.id, false)}
                </div>
              )}
              <div key={step} className="ob-step ob-step--in" data-dir={dir}>
                {render(step, true)}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
