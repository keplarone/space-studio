import { useState } from "react";
import { Button } from "../ui";

type Part = { kind: "text"; text: string } | { kind: "code"; lang: string; code: string };

export function parseMessage(text: string): Part[] {
  const parts: Part[] = [];
  const re = /```([\w+-]*)[^\n]*\n([\s\S]*?)(?:```|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ kind: "text", text: text.slice(last, m.index) });
    parts.push({ kind: "code", lang: m[1] || "", code: m[2].replace(/\n$/, "") });
    last = re.lastIndex;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setStatus("success");
    } catch {
      setStatus("error");
    }
    window.setTimeout(() => setStatus("idle"), 1600);
  };
  return (
    <figure className="code">
      <figcaption className="code__bar">
        <span>{lang || "code"}</span>
        <Button size="sm" variant="ghost" status={status} successLabel="Copied" errorLabel="Copy failed" onClick={copy} aria-live="polite">
          Copy
        </Button>
      </figcaption>
      <pre><code>{code}</code></pre>
    </figure>
  );
}

export function MessageBody({ text }: { text: string }) {
  return (
    <div className="msg__body">
      {parseMessage(text).map((p, i) =>
        p.kind === "code" ? <CodeBlock key={i} lang={p.lang} code={p.code} /> : p.text.trim() ? <p key={i} className="msg__text">{p.text.replace(/^\n+|\n+$/g, "")}</p> : null,
      )}
    </div>
  );
}
