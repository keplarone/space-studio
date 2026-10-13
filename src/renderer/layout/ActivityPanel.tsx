import { useSyncExternalStore } from "react";
import { Button, Chevron } from "../ui";
import { activity } from "../lib/bridge";

export function ActivityPanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const entries = useSyncExternalStore(activity.subscribe, activity.get);
  const pending = entries.filter((e) => e.status === null).length;
  return (
    <section className="activity" data-open={open ? "true" : "false"} aria-label="Request activity">
      <div className="activity__bar">
        <button type="button" className="activity__toggle" aria-expanded={open} aria-controls="activity-list" onClick={onToggle}>
          <Chevron open={open} size={14} />
          <span>Activity</span>
          <span className="muted small">{entries.length} request{entries.length === 1 ? "" : "s"}{pending ? ` · ${pending} pending` : ""}</span>
        </button>
        {open && entries.length > 0 && <Button size="sm" variant="ghost" onClick={activity.clear}>Clear</Button>}
      </div>
      <div id="activity-list" className="activity__list" hidden={!open}>
        {entries.length === 0 ? (
          <p className="muted small pad">No requests yet. Every call the app makes to keplar.one is listed here.</p>
        ) : (
          <table className="activity__table">
            <thead>
              <tr><th scope="col">Time</th><th scope="col">Method</th><th scope="col">Path</th><th scope="col">Status</th><th scope="col">Duration</th></tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{new Date(e.at).toLocaleTimeString()}</td>
                  <td className="mono">{e.method}</td>
                  <td className="mono ellipsis">{e.path}</td>
                  <td className="mono" data-status={e.status === null ? "pending" : e.status === 0 ? "offline" : e.status < 300 ? "ok" : e.status < 500 ? "warn" : "err"}>
                    {e.status === null ? "…" : e.status === 0 ? "not connected" : e.status}
                  </td>
                  <td className="mono">{e.ms === null ? "—" : `${e.ms} ms`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
