import { useEffect, useId, useState } from "react";
import { openExternal } from "../lib/bridge";
import { useLocalEngine } from "../lib/localEngine";
import { LOCAL_ENGINES, type LocalEngineKind } from "../../core/local";
import { withCode } from "./TroubleshootCard";

/**
 * Local (free) settings inside the model picker: which local server (Ollama or llama.cpp), its port, a live connection check and
 * the models it has. Answers come from the person's own computer: free and offline, quality set by the model they run.
 */
export function LocalPanel({ onDone }: { onDone: () => void }) {
  const e = useLocalEngine();
  const ids = useId();
  const [port, setPort] = useState(String(e.config.port));
  useEffect(() => setPort(String(e.config.port)), [e.config.port]);
  useEffect(() => { if (!e.status && !e.checking) void e.check(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const s = e.status;
  const models = s?.reachable ? s.models : [];
  const commitPort = () => {
    const n = Number(port);
    if (Number.isInteger(n) && n >= 1024 && n <= 65535 && n !== e.config.port) { e.setPort(n); void e.check(); }
    else setPort(String(e.config.port));
  };

  return (
    <div className="local">
      <p className="local__lede">Runs on a model on this computer. Free and offline. Nothing is sent to Keplar and no credits are used; answers are only as good as the model you run.</p>

      <div className="local__row">
        <label className="local__field">
          <span>Local server</span>
          <select value={e.config.engine} onChange={(ev) => e.setEngine(ev.target.value as LocalEngineKind)}>
            {(Object.keys(LOCAL_ENGINES) as LocalEngineKind[]).map((k) => <option key={k} value={k}>{LOCAL_ENGINES[k].name}</option>)}
          </select>
        </label>
        <label className="local__field local__field--port">
          <span>Port</span>
          <input inputMode="numeric" value={port} onChange={(ev) => setPort(ev.target.value.replace(/\D/g, "").slice(0, 5))} onBlur={commitPort} onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); commitPort(); } }} />
        </label>
        <button type="button" className="btn btn--secondary btn--sm local__check" aria-busy={e.checking || undefined} onClick={() => void e.check()}>
          {e.checking ? "Checking…" : "Check"}
        </button>
      </div>

      <div className="local__status" role="status" data-state={e.checking ? "checking" : s?.reachable ? "ok" : s ? "down" : "idle"}>
        <span className="local__dot" aria-hidden="true" />
        {e.checking ? "Connecting to 127.0.0.1…" : s?.reachable ? `Connected · ${models.length} model${models.length === 1 ? "" : "s"}` : s ? s.troubleshoot.title : "Not checked yet"}
      </div>

      {s && !s.reachable && (
        <ol className="local__steps">
          {s.troubleshoot.steps.map((x) => <li key={x}>{withCode(x)}</li>)}
          <li className="local__get"><button type="button" className="btn btn--ghost btn--sm" onClick={() => void openExternal(LOCAL_ENGINES[e.config.engine].installUrl)}>Get {LOCAL_ENGINES[e.config.engine].name}</button></li>
        </ol>
      )}

      {s?.reachable && (
        models.length ? (
          <>
            <p className="picker__kicker" id={`${ids}-lm`}>Model on this computer</p>
            <div className="local__models" role="radiogroup" aria-labelledby={`${ids}-lm`}>
              {models.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={m === e.model} className="local__model" onClick={() => { e.setModel(m); onDone(); }}>
                  <span>{m}</span>{m === e.model && <span className="local__sel">Selected</span>}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="local__empty">The server is running but has no models. With Ollama, run <code>ollama pull qwen2.5-coder:7b</code>, then press Check.</p>
        )
      )}
    </div>
  );
}
