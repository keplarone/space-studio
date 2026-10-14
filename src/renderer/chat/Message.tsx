import { useEffect, useRef, useState, type ReactNode } from "react";
import { copyText } from "../lib/bridge";

type Part = { kind: "text"; text: string } | { kind: "code"; lang: string; code: string };

export function parseMessage(text: string): Part[] {
  const parts: Part[] = [];
  const re = /```([\w+-]*)[^\n]*\n([\s\S]*?)(?:```|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ kind: "text", text: text.slice(last, m.index) });
    parts.push({ kind: "code", lang: m[1] || "", code: m[2]!.replace(/\n$/, "") });
    last = re.lastIndex;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}

type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "code"; lang: string; code: string };

const BULLET = /^\s*[-*•]\s+/;
const NUMBER = /^\s*\d+[.)]\s+/;

/** Splits plain text into paragraphs, headings and lists (a small, safe subset of Markdown; nothing is rendered as HTML). */
export function toBlocks(text: string): Block[] {
  const out: Block[] = [];
  for (const part of parseMessage(text)) {
    if (part.kind === "code") { out.push(part); continue; }
    for (const chunk of part.text.split(/\n\s*\n/)) {
      const lines = chunk.split("\n").filter((l) => l.trim());
      if (!lines.length) continue;
      let para: string[] = [];
      let list: { kind: "ul" | "ol"; items: string[] } | null = null;
      const flushPara = () => { if (para.length) out.push({ kind: "p", text: para.join("\n") }); para = []; };
      const flushList = () => { if (list) out.push(list); list = null; };
      for (const line of lines) {
        const h = /^\s*#{1,4}\s+(.*)$/.exec(line);
        const kind = BULLET.test(line) ? "ul" : NUMBER.test(line) ? "ol" : null;
        if (h) { flushPara(); flushList(); out.push({ kind: "h", text: h[1]! }); }
        else if (kind) {
          flushPara();
          if (!list || list.kind !== kind) { flushList(); list = { kind, items: [] }; }
          list.items.push(line.replace(kind === "ul" ? BULLET : NUMBER, ""));
        } else if (list && /^\s{2,}\S/.test(line)) {
          list.items[list.items.length - 1] += ` ${line.trim()}`;
        } else { flushList(); para.push(line); }
      }
      flushPara();
      flushList();
    }
  }
  return out;
}

/** Inline `code` and **bold**. */
function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /`([^`\n]+)`|\*\*([^*\n]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(m[1] != null ? <code key={k++} className="icode">{m[1]}</code> : <strong key={k++}>{m[2]}</strong>);
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function CodeBlock({ lang, code, style }: { lang: string; code: string; style?: React.CSSProperties }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => {
    const ok = await copyText(code);
    setStatus(ok ? "copied" : "failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus("idle"), 1800);
  };
  const lines = code.split("\n").length;
  return (
    <figure className="code rv" style={style}>
      <figcaption className="code__bar">
        <span className="code__lang">{lang || "code"}<span className="code__lines">{lines} {lines === 1 ? "line" : "lines"}</span></span>
        <button type="button" className="code__copy" data-status={status} onClick={() => void copy()} aria-label={`Copy ${lang || "code"}`}>
          <span className="code__copy-label" key={status}>{status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : "Copy"}</span>
        </button>
        <span className="sr-only" aria-live="polite">{status === "copied" ? "Copied to clipboard" : status === "failed" ? "Copy failed" : ""}</span>
      </figcaption>
      <pre tabIndex={0} aria-label={`${lang || "Code"} snippet`}><code>{code}</code></pre>
    </figure>
  );
}

/**
 * An answer's body. With `reveal`, each paragraph, list item and code block fades in from a blur and rises into place,
 * one after another, so the answer reads as if it settles onto the page.
 */
export function MessageBody({ text, reveal = false }: { text: string; reveal?: boolean }) {
  let n = 0;
  const d = () => (reveal ? ({ ["--d" as string]: `${Math.min(n++, 14) * 70}ms` } as React.CSSProperties) : undefined);
  return (
    <div className="msg__body" data-reveal={reveal || undefined}>
      {toBlocks(text).map((b, i) => {
        if (b.kind === "code") return <CodeBlock key={i} lang={b.lang} code={b.code} style={d()} />;
        if (b.kind === "h") return <h3 key={i} className="msg__h rv" style={d()}>{inline(b.text)}</h3>;
        if (b.kind === "p") return <p key={i} className="msg__text rv" style={d()}>{inline(b.text)}</p>;
        const L = b.kind;
        return (
          <L key={i} className="msg__list">
            {b.items.map((it, j) => <li key={j} className="rv" style={d()}>{inline(it)}</li>)}
          </L>
        );
      })}
    </div>
  );
}
