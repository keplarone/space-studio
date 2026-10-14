import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { Button } from "../ui";
import { NotConnected } from "../ui/common";
import { Chat } from "../chat/Chat";
import { NAV, useApp } from "../lib/app";
import { connected } from "../lib/bridge";

export const AI_MIN = 280;
export const AI_MAX = 560;

function WorkspaceSummary({ ws }: { ws: "roblox" | "blender" }) {
  const { chats, activeChat, me } = useApp();
  const chat = activeChat[ws] ? chats[activeChat[ws]!] : undefined;
  const replies = chat?.messages.filter((m) => m.role === "assistant" && m.usage) ?? [];
  const sum = replies.reduce(
    (a, m) => ({ inT: a.inT + m.usage!.promptTokens, outT: a.outT + m.usage!.completionTokens, credits: a.credits + m.usage!.units, ms: a.ms + m.usage!.latencyMs }),
    { inT: 0, outT: 0, credits: 0, ms: 0 },
  );
  const served = [...new Set(replies.map((m) => m.served?.name).filter(Boolean))];
  const model = me?.models.find((m) => m.id === chat?.model);
  return (
    <div className="ai-summary">
      <h3 className="ai-summary__title">This conversation</h3>
      {!chat || replies.length === 0 ? (
        <p className="muted small">No replies yet. Usage for each reply appears here and under each message.</p>
      ) : (
        <dl className="kv">
          <dt>Replies</dt><dd>{replies.length}</dd>
          <dt>Served by</dt><dd>{served.join(", ")}</dd>
          <dt>Tokens</dt><dd>{sum.inT.toLocaleString()} in / {sum.outT.toLocaleString()} out</dd>
          <dt>Credits</dt><dd>{sum.credits.toLocaleString()}</dd>
          <dt>Avg. latency</dt><dd>{(sum.ms / replies.length / 1000).toFixed(1)}s</dd>
        </dl>
      )}
      {model && (
        <>
          <h3 className="ai-summary__title">Selected model</h3>
          <p className="small"><strong>{model.name}</strong>: {model.tagline}</p>
          <p className="muted small">{model.creditNote}</p>
          <p className="muted small">A Space Studio model configuration. Not fine-tuned.</p>
        </>
      )}
    </div>
  );
}

export function AiPanel({ width, setWidth, onClose }: { width: number; setWidth: (w: number) => void; onClose: () => void }) {
  const { view, me } = useApp();
  const drag = useRef<{ x: number; w: number } | null>(null);
  const label = NAV.find((n) => n.id === view)?.label ?? "";
  const isWs = view === "roblox" || view === "blender";

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, w: width };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setWidth(Math.max(AI_MIN, Math.min(AI_MAX, drag.current.w + (drag.current.x - e.clientX))));
  };
  const onUp = () => (drag.current = null);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 48 : 16;
    if (e.key === "ArrowLeft") setWidth(Math.min(AI_MAX, width + step));
    else if (e.key === "ArrowRight") setWidth(Math.max(AI_MIN, width - step));
    else if (e.key === "Home") setWidth(AI_MIN);
    else if (e.key === "End") setWidth(AI_MAX);
    else return;
    e.preventDefault();
  };

  return (
    <aside className="ai-panel" style={{ width }} aria-label="AI assistant">
      <div
        className="resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize assistant panel"
        aria-valuemin={AI_MIN}
        aria-valuemax={AI_MAX}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      />
      <header className="ai-panel__head">
        <div className="ai-panel__title">
          <strong>Assistant</strong>
          <span className="muted small">Context: {label}</span>
        </div>
        <Button size="sm" variant="ghost" label="Close assistant panel" onClick={onClose}>Close</Button>
      </header>
      <div className="ai-panel__body">
        {!connected ? (
          <div className="pad"><NotConnected /></div>
        ) : isWs ? (
          <WorkspaceSummary ws={view} />
        ) : me?.signedIn ? (
          <Chat workspace="general" compact placeholder="Ask a question" />
        ) : (
          <p className="pad muted small">Sign in to use the assistant.</p>
        )}
      </div>
    </aside>
  );
}
