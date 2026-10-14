import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "../ui";
import { NotConnected } from "../ui/common";
import { RollingNumber } from "../ui/RollingNumber";
import { connected } from "../lib/bridge";
import { load, save } from "../lib/storage";
import { useExperiences, useStats, type AddResult } from "../lib/stats";
import type { Experience, Stats, StatsRange } from "../lib/types";
import { TimeChart } from "../dashboard/TimeChart";
import { ExperiencePicker, RangePicker } from "../dashboard/Pickers";
import { AddExperience, BeaconSheet, ExperienceManager, type BeaconSheetState } from "../dashboard/Experiences";
import { Ago, CardError, RobuxIcon, RollIn, Shimmer } from "../dashboard/bits";
import { RANGES, RANGE_LABEL, fmtInt, sinceLabel } from "../dashboard/chart";

const SHORT: Record<StatsRange, string> = { "1h": "1H", "24h": "24H", "7d": "7D", "30d": "30D", "90d": "90D" };
const LIVE_MS = 5 * 60_000;

type Shown = { key: string; data: Stats; at: number };

/**
 * The creator dashboard: live players and beacon-reported revenue for the experiences this account tracks.
 * Every number and point comes from keplar.one; anything it doesn't have is shown as missing, with what would fill it.
 */
export function Dashboard() {
  const xp = useExperiences();
  const [sheet, setSheet] = useState<BeaconSheetState>(null);
  const [universe, setUniverse] = useState<string>(() => load("dashboard.universe", "all"));
  const [range, setRange] = useState<StatsRange>(() => {
    const r = load<string>("dashboard.range", "24h");
    return (RANGES as string[]).includes(r) ? (r as StatsRange) : "24h";
  });
  useEffect(() => save("dashboard.universe", universe), [universe]);
  useEffect(() => save("dashboard.range", range), [range]);

  const list = xp.state.status === "ready" ? xp.state.data : null;
  // A choice that is no longer tracked (removed elsewhere) shows "All" without forgetting it: a just-added experience
  // is chosen before the list has reloaded with it.

  const onAdded = useCallback((r: Extract<AddResult, { ok: true }>) => {
    setUniverse(r.experience.universeId);
    setSheet({ exp: r.experience, script: r.script, reason: "added" });
  }, []);

  if (!connected) {
    return (
      <div className="view-body dash">
        <DashHeader />
        <NotConnected />
      </div>
    );
  }

  let body: ReactNode;
  if (xp.state.status === "error") {
    body = (
      <div className="view-body dash">
        <DashHeader />
        <section className="card rise">
          <CardError message={xp.state.message} onRetry={() => void xp.reload()} />
        </section>
      </div>
    );
  } else if (!list) {
    body = <div className="view-body dash"><DashSkeleton /></div>;
  } else if (!list.length) {
    body = <Onboarding add={xp.add} onAdded={onAdded} />;
  } else {
    body = (
      <Live
        list={list}
        universe={list.some((e) => e.universeId === universe) ? universe : "all"}
        range={range}
        onUniverse={setUniverse}
        onRange={setRange}
        manager={
          <ExperienceManager
            list={list}
            add={xp.add}
            remove={xp.remove}
            rotateBeacon={xp.rotateBeacon}
            onAdded={onAdded}
            onSheet={setSheet}
            selected={universe}
            onSelect={(id) => { setUniverse(id); document.querySelector(".view[data-view=dashboard]")?.scrollTo({ top: 0, behavior: "smooth" }); }}
          />
        }
      />
    );
  }

  return (
    <>
      {body}
      <BeaconSheet state={sheet} onClose={() => setSheet(null)} />
    </>
  );
}

function DashHeader({ eyebrow, controls }: { eyebrow?: ReactNode; controls?: ReactNode }) {
  return (
    <header className="dash-head rise">
      <div className="dash-head__l">
        <p className="dash-head__eyebrow">{eyebrow ?? "Roblox"}</p>
        <h1 className="dash-head__title" tabIndex={-1}>Creator dashboard</h1>
      </div>
      {controls && <div className="dash-head__r">{controls}</div>}
    </header>
  );
}

/** Keeps the last data that arrived, so switching experience or range morphs from it instead of flashing a skeleton. */
function useShown(state: ReturnType<typeof useStats>, key: string): Shown | null {
  const ref = useRef<Shown | null>(null);
  if (state.status === "ready" && (ref.current?.data !== state.data || ref.current.key !== key)) ref.current = { key, data: state.data, at: state.at };
  return ref.current;
}

function Live({ list, universe, range, onUniverse, onRange, manager }: {
  list: Experience[];
  universe: string;
  range: StatsRange;
  onUniverse: (u: string) => void;
  onRange: (r: StatsRange) => void;
  manager: ReactNode;
}) {
  const key = `${universe}|${range}`;
  const stats = useStats(universe, range, range === "1h" ? 15_000 : 60_000);
  const kept = useShown(stats, key);
  const err = stats.status === "error" ? stats.message : null;
  // Never present another experience's or range's numbers under a failed request for this one.
  const shown = kept && !(err && kept.key !== key) ? kept : null;
  const switching = !!shown && shown.key !== key;

  const exp = list.find((e) => e.universeId === universe) ?? null;
  const beaconConnected = exp ? exp.beacon.connected : list.some((e) => e.beacon.connected);

  return (
    <div className="view-body dash">
      <DashHeader
        eyebrow={shown ? <><span className="dash-head__dot" data-busy={switching || stats.status === "loading" || undefined} aria-hidden="true" /><Ago t={shown.at} prefix="Updated " /></> : "Loading your numbers"}
        controls={<><ExperiencePicker list={list} value={universe} onChange={onUniverse} /><RangePicker value={range} onChange={onRange} /></>}
      />
      {err && shown && (
        <div className="dash-warn rise" role="alert">
          <span>Couldn't refresh: {err} Showing data from <Ago t={shown.at} />.</span>
          <Button size="sm" variant="secondary" onClick={stats.refresh}>Retry</Button>
        </div>
      )}
      {!shown ? (
        err ? (
          <section className="card rise"><CardError message={err} onRetry={stats.refresh} /></section>
        ) : (
          <DashSkeleton charts />
        )
      ) : (
        <>
          <div className="dash-top">
            <CcuCard shown={shown} range={range} busy={switching} />
            <Tiles s={shown.data} range={range} busy={switching} />
          </div>
          <div className="dash-bottom">
            <RevenueCard shown={shown} range={range} busy={switching} beaconConnected={beaconConnected} />
            {manager}
          </div>
        </>
      )}
      {!shown && manager}
    </div>
  );
}

/* ---------- Concurrent players ---------- */

function CcuCard({ shown, range, busy }: { shown: Shown; range: StatsRange; busy: boolean }) {
  const s = shown.data;
  const live = s.now ? Date.now() - Date.parse(s.now.at) < LIVE_MS : false;
  const since = sinceLabel(s.ccu.sampledSince);
  const sinceMs = s.ccu.sampledSince ? Date.parse(s.ccu.sampledSince) : null;
  const noneYet = !s.ccu.sampledSince;
  return (
    <section className="card ccu rise" data-busy={busy || undefined} aria-labelledby="ccu-h" style={{ animationDelay: "40ms" }}>
      <header className="card__head">
        <div className="ccu__lead">
          <h2 id="ccu-h" className="card__title">Concurrent players</h2>
          <div className="ccu__now">
            {s.now ? <RollIn className="big" value={s.now.playing} /> : <span className="big big--none">—</span>}
            {s.now && (live ? (
              <span className="live-badge"><i aria-hidden="true" />Live</span>
            ) : (
              <span className="stale-badge">Last seen <Ago t={Date.parse(s.now.at)} /></span>
            ))}
          </div>
          <p className="card__sub">{since ? `Recorded by Space Studio since ${since}` : "Not recorded yet"}</p>
        </div>
        <div className="chips">
          <span className="chip2">Peak {s.ccu.peak != null ? <b><RollingNumber value={s.ccu.peak} /></b> : <b>—</b>} <em>{SHORT[range]}</em></span>
        </div>
      </header>
      <div className="card__chart">
        <TimeChart
          points={s.ccu.points}
          range={range}
          end={shown.at}
          seriesKey={shown.key}
          tone="blue"
          live={live}
          recordedFrom={sinceMs}
          delay={200}
          label={`Concurrent players, ${RANGE_LABEL[range]}`}
          describe={(v) => <><b>{fmtInt(v)}</b> {v === 1 ? "player" : "players"}</>}
          describeText={(v) => `${fmtInt(v)} ${v === 1 ? "player" : "players"}`}
          empty={
            <div className="chart-empty">
              <p className="chart-empty__t">{noneYet ? "No samples yet" : `No samples in the ${RANGE_LABEL[range]}`}</p>
              <p className="chart-empty__b">
                {noneYet
                  ? "Roblox doesn't publish player history, so Space Studio records it: every minute while this dashboard is open, and every hour otherwise. Recording starts now."
                  : `Space Studio has recorded this experience since ${since}. Samples are taken every minute while this dashboard is open, and every hour otherwise.`}
              </p>
            </div>
          }
        />
      </div>
    </section>
  );
}

/* ---------- Tiles ---------- */

function Tiles({ s, range, busy }: { s: Stats; range: StatsRange; busy: boolean }) {
  const noBeacon = s.robux.earned == null;
  const tiles: { label: string; value: number | null; note: string; robux?: boolean; tone?: string }[] = [
    { label: "Playing now", value: s.now?.playing ?? null, note: s.now ? "Live from Roblox" : "Waiting for Roblox", tone: "blue" },
    { label: "Visits", value: s.now?.visits ?? null, note: s.now ? "All time, from Roblox" : "Waiting for Roblox" },
    { label: "Favorites", value: s.now?.favorites ?? null, note: s.now ? "All time, from Roblox" : "Waiting for Roblox" },
    { label: "Peak players", value: s.ccu.peak, note: s.ccu.peak != null ? `Highest sample · ${SHORT[range]}` : "No samples in range", tone: "blue" },
    { label: "Robux earned", value: s.robux.earned, note: noBeacon ? "Needs the sales beacon" : `Net · ${SHORT[range]} · from beacon`, robux: true, tone: "green" },
    { label: "Pending Robux", value: s.robux.pending, note: noBeacon ? "Needs the sales beacon" : `Estimate · ~${s.robux.pendingWindowHours} h Roblox hold`, robux: true, tone: "green" },
  ];
  return (
    <section className="tiles" aria-label="Key numbers" data-busy={busy || undefined}>
      {tiles.map((t, i) => (
        <div key={t.label} className="tile" data-tone={t.tone} style={{ animationDelay: `${120 + i * 70}ms` }}>
          <span className="tile__label">{t.label}</span>
          <span className="tile__value">
            {t.robux && t.value != null && <RobuxIcon size={17} />}
            {t.value != null ? <RollIn value={t.value} delay={120 + i * 70} /> : <span className="tile__none">—</span>}
          </span>
          <span className="tile__note">{t.note}</span>
        </div>
      ))}
    </section>
  );
}

/* ---------- Revenue ---------- */

function RevenueCard({ shown, range, busy, beaconConnected }: { shown: Shown; range: StatsRange; busy: boolean; beaconConnected: boolean }) {
  const r = shown.data.revenue;
  const on = r.connected;
  const split = r.bySource.product + r.bySource.gamepass;
  const pp = split > 0 ? (r.bySource.product / split) * 100 : 0;
  const scrollToManager = () => {
    const el = document.getElementById("xman-h");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  return (
    <section className="card rev rise" data-busy={busy || undefined} aria-labelledby="rev-h" style={{ animationDelay: "180ms" }}>
      <header className="card__head">
        <div className="ccu__lead">
          <h2 id="rev-h" className="card__title">Revenue <span className="card__title-r">· {RANGE_LABEL[range]}</span></h2>
          <div className="rev__total">
            {on ? <><RobuxIcon size={30} /><RollIn className="big" value={r.total} /></> : <span className="big big--none">—</span>}
          </div>
          <p className="card__sub">{on ? <>{fmtInt(r.sales)} {r.sales === 1 ? "sale" : "sales"} reported by your beacon{shown.data.robux.lastSaleAt ? <> · last <Ago t={Date.parse(shown.data.robux.lastSaleAt)} /></> : null}</> : "Net Robux from your game's own sales beacon"}</p>
        </div>
        {on && (
          <div className="split" aria-label={`Developer Products ${fmtInt(r.bySource.product)} Robux, Game Passes ${fmtInt(r.bySource.gamepass)} Robux`}>
            <div className="split__bar" aria-hidden="true">
              {split > 0 ? (
                <>
                  <i className="split__a" style={{ width: `${pp}%` }} />
                  <i className="split__b" style={{ width: `${100 - pp}%` }} />
                </>
              ) : <i className="split__0" />}
            </div>
            <div className="split__legend">
              <span><i className="split__a" />Products <b>{fmtInt(r.bySource.product)}</b></span>
              <span><i className="split__b" />Game Passes <b>{fmtInt(r.bySource.gamepass)}</b></span>
            </div>
          </div>
        )}
      </header>
      <div className="card__chart">
        <TimeChart
          points={on ? r.points : []}
          range={range}
          end={shown.at}
          seriesKey={shown.key}
          tone="green"
          delay={380}
          label={`Net Robux per period, ${RANGE_LABEL[range]}`}
          describe={(v) => <><RobuxIcon size={13} /><b>{fmtInt(v)}</b></>}
          describeText={(v) => `${fmtInt(v)} Robux`}
          empty={
            on ? (
              <div className="chart-empty">
                <p className="chart-empty__t">No sales in the {RANGE_LABEL[range]}</p>
                <p className="chart-empty__b">Your beacon is connected. Each Developer Product or Game Pass purchase shows up here within seconds.</p>
              </div>
            ) : (
              <div className="chart-empty">
                <p className="chart-empty__t">Revenue appears once the beacon script runs in your live game</p>
                <p className="chart-empty__b">
                  {beaconConnected
                    ? "The beacon has connected, but hasn't reported sales for this view yet."
                    : "Roblox doesn't share sales with other apps. Paste the beacon script into your game and publish it: it reports each sale here as it happens."}
                </p>
                <Button size="sm" variant="secondary" onClick={scrollToManager}>Set up the beacon</Button>
              </div>
            )
          }
        />
      </div>
    </section>
  );
}

/* ---------- Empty: first experience ---------- */

function Onboarding({ add, onAdded }: { add: (link: string) => Promise<AddResult>; onAdded: (r: Extract<AddResult, { ok: true }>) => void }) {
  return (
    <div className="view-body dash">
      <DashHeader />
      <section className="card onb rise" aria-labelledby="onb-h" style={{ animationDelay: "80ms" }}>
        <div className="onb__glow" aria-hidden="true" />
        <div className="onb__in">
          <p className="onb__eyebrow">Start here</p>
          <h2 id="onb-h" className="onb__title">Add your first experience</h2>
          <p className="onb__lede">Paste its Roblox link. Space Studio starts recording live players right away, and shows sales the moment your game's beacon reports them.</p>
          <AddExperience add={add} count={0} onAdded={onAdded} autoFocus />
          <ul className="onb__what">
            <li data-tone="blue"><b>Live players</b><span>Sampled from Roblox every minute while you watch, and hourly otherwise. History starts when you add it.</span></li>
            <li data-tone="green"><b>Revenue</b><span>Developer Product and Game Pass sales, reported in real time by a small script in your game.</span></li>
            <li><b>Robux</b><span>Earned and pending, from those same sales. Pending is an estimate of Roblox's holding period.</span></li>
          </ul>
        </div>
        <div className="onb__art" aria-hidden="true">
          <svg viewBox="0 0 320 220">
            {[40, 90, 140].map((y) => <line key={y} x1="20" x2="300" y1={y} y2={y} className="onb__grid" />)}
            <line x1="20" x2="300" y1="190" y2="190" className="onb__base" />
            <line x1="46" x2="300" y1="190" y2="190" className="onb__future" />
            <circle cx="40" cy="190" r="7" className="onb__ring" />
            <circle cx="40" cy="190" r="6" className="onb__dot" />
            <text x="58" y="174" className="onb__now">Recording starts here</text>
            <text x="40" y="214" className="onb__axis">Now</text>
          </svg>
        </div>
      </section>
    </div>
  );
}

/* ---------- Loading ---------- */

function DashSkeleton({ charts }: { charts?: boolean }) {
  const card = (cls: string, n = 0) => (
    <div className={`card ${cls} skel`} style={{ animationDelay: `${n}ms` }}>
      <Shimmer w={150} h={13} />
      <Shimmer w={180} h={44} r={14} style={{ marginTop: 14 }} />
      <Shimmer w={240} h={11} style={{ marginTop: 12 }} />
      <div className="skel__plot">
        <svg viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0,78 C60,70 90,40 150,48 S250,72 300,40 S370,30 400,34 L400,100 L0,100 Z" /></svg>
      </div>
    </div>
  );
  return (
    <div role="status" aria-live="polite" className="dash-skel">
      <span className="sr-only">Loading your dashboard…</span>
      {!charts && <DashHeader controls={<><Shimmer w={220} h={52} /><Shimmer w={300} h={48} /></>} />}
      <div className="dash-top">
        {card("ccu")}
        <div className="tiles">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="tile skel" style={{ animationDelay: `${i * 40}ms` }}>
              <Shimmer w="55%" h={11} />
              <Shimmer w="70%" h={24} r={10} style={{ marginTop: 10 }} />
              <Shimmer w="80%" h={10} style={{ marginTop: 10 }} />
            </div>
          ))}
        </div>
      </div>
      <div className="dash-bottom">
        {card("rev", 80)}
        {!charts && (
          <div className="card xman skel">
            <Shimmer w={150} h={13} />
            {[0, 1, 2].map((i) => (
              <div key={i} className="skel__row"><Shimmer w={40} h={40} r={12} /><span><Shimmer w={160} h={12} /><Shimmer w={210} h={10} style={{ marginTop: 8 }} /></span></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
