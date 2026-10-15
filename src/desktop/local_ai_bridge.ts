/**
 * Local (free) engine bridge. Runs in the Electron MAIN process only: the page still has no network access and reaches this
 * through two IPC calls (space:local:status, space:local:chat), so websites and other programs can't use it.
 *
 * It talks to an OpenAI-compatible server the person runs themselves on THIS computer:
 *   Ollama            http://127.0.0.1:11434/v1/chat/completions   (ollama serve; ollama pull <model>)
 *   llama.cpp server  http://127.0.0.1:8080/v1/chat/completions    (llama-server -m model.gguf)
 * Only 127.0.0.1 is ever contacted (never a hostname, so DNS can't redirect it), on the configured port. Nothing is sent to
 * keplar.one and no credits are used. Answers are only as good as the local model; the app says so in the UI.
 *
 * The prompt is assembled here: a base instruction, the workspace hint, and the specialist track picked by the classifier
 * (src/core/specialists.ts). Update the tracks there, not here.
 */
import { classifyIntent, specialistBlock } from "../core/specialists";
import { LOCAL_ENGINES, type LocalChatRequest, type LocalChatResult, type LocalConfig, type LocalStatus } from "../core/local";
import type { Troubleshoot } from "../core/troubleshoot";
import { errorText, safely } from "../main/safe";

export const LOCAL_HOST = "127.0.0.1";
/** Checking whether the server is there should be quick. */
export const STATUS_TIMEOUT_MS = 3_000;
/** Generating on a laptop CPU is slow; a long answer can take minutes. Past this the request is stopped. */
export const CHAT_TIMEOUT_MS = 180_000;
const MAX_RESPONSE_BYTES = 4_000_000;
const LIMITS = { messages: 40, messageChars: 20_000, totalChars: 120_000, modelChars: 120 };

const BASE_PROMPT = [
  "You are the assistant inside Space Studio, a desktop app for Roblox and Blender creators, running as a local model on the person's own computer.",
  "Answer precisely. Put code in fenced blocks with the language. If you are not sure an API exists, say so instead of guessing.",
].join("\n");
const WORKSPACE_HINT = {
  roblox: "Workspace: Roblox Studio (Luau).",
  blender: "Workspace: Blender (Python/bpy).",
  general: "Workspace: general (Roblox Studio or Blender).",
} as const;

/** Validates untrusted config from the page. Returns null when it isn't acceptable. */
export function validateConfig(raw: unknown): LocalConfig | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (r.engine !== "ollama" && r.engine !== "llamacpp") return null;
  const port = Number(r.port);
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) return null;
  return { engine: r.engine, port };
}

export function validateChat(raw: unknown): LocalChatRequest | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const config = validateConfig(r.config);
  if (!config) return null;
  if (typeof r.model !== "string" || !r.model || r.model.length > LIMITS.modelChars || !/^[\w.:/\-@+]+$/.test(r.model)) return null;
  if (r.workspace !== "roblox" && r.workspace !== "blender" && r.workspace !== "general") return null;
  if (!Array.isArray(r.messages) || !r.messages.length || r.messages.length > LIMITS.messages) return null;
  let total = 0;
  const messages: LocalChatRequest["messages"] = [];
  for (const m of r.messages) {
    const x = (m && typeof m === "object" ? m : {}) as Record<string, unknown>;
    if ((x.role !== "user" && x.role !== "assistant") || typeof x.content !== "string" || !x.content.trim() || x.content.length > LIMITS.messageChars) return null;
    total += x.content.length;
    messages.push({ role: x.role, content: x.content });
  }
  if (total > LIMITS.totalChars || messages[messages.length - 1]!.role !== "user") return null;
  return { config, model: r.model, workspace: r.workspace, messages };
}

const base = (c: LocalConfig) => `http://${LOCAL_HOST}:${c.port}`;

function explainLocal(c: LocalConfig, e: unknown): Partial<Troubleshoot> {
  const name = LOCAL_ENGINES[c.engine].name;
  const msg = errorText(e);
  const refused = /ECONNREFUSED|fetch failed|connect/i.test(msg);
  if (refused)
    return {
      code: "local_unreachable",
      title: `${name} isn't running on port ${c.port}`,
      steps: c.engine === "ollama"
        ? ["Install Ollama from ollama.com/download and open it (or run `ollama serve`).", "Download a coding model, for example `ollama pull qwen2.5-coder:7b`.", `Check the port in Local engine settings matches Ollama (default ${LOCAL_ENGINES.ollama.defaultPort}), then try again.`]
        : ["Start the server with `llama-server -m <your-model>.gguf --port " + c.port + "`.", "Check the port in Local engine settings matches the server, then try again."],
      actions: ["retry", "open_settings", "use_cloud", "copy_error"],
      helpUrl: LOCAL_ENGINES[c.engine].installUrl,
    };
  return { code: "local_failed", title: `${name} couldn't answer`, actions: ["retry", "open_settings", "use_cloud", "copy_error"] };
}

async function readJson(res: Response): Promise<unknown> {
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_RESPONSE_BYTES) throw new Error(`The local server's reply was too large (${len} bytes).`);
  const text = await res.text();
  if (text.length > MAX_RESPONSE_BYTES) throw new Error("The local server's reply was too large.");
  try { return JSON.parse(text); } catch { throw new Error(`The local server didn't return JSON (HTTP ${res.status}).`); }
}

/** Is the local server there, and which models does it have? */
export async function localStatus(config: LocalConfig, fetcher: typeof fetch = fetch): Promise<LocalStatus> {
  const r = await safely(`Connecting to ${LOCAL_ENGINES[config.engine].name}`, async (signal) => {
    const res = await fetcher(`${base(config)}/v1/models`, { signal, redirect: "error" });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${base(config)}/v1/models`);
    const data = (await readJson(res)) as { data?: { id?: unknown }[] };
    return (data.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === "string" && id.length <= LIMITS.modelChars).slice(0, 100);
  }, { timeoutMs: STATUS_TIMEOUT_MS, explain: (e) => explainLocal(config, e) });
  if (!r.ok) return { reachable: false, troubleshoot: r.troubleshoot };
  return { reachable: true, models: r.value };
}

/** One chat turn on the local model. Never throws; every failure is a troubleshooting card. */
export async function localChat(req: LocalChatRequest, fetcher: typeof fetch = fetch): Promise<LocalChatResult> {
  const lastUser = req.messages[req.messages.length - 1]!.content;
  const { track } = classifyIntent(lastUser, req.workspace);
  const system = `${BASE_PROMPT}\n${WORKSPACE_HINT[req.workspace]}\n\n${specialistBlock(track)}`;
  const t0 = Date.now();
  const r = await safely(`${req.model} on ${LOCAL_ENGINES[req.config.engine].name}`, async (signal) => {
    const res = await fetcher(`${base(req.config)}/v1/chat/completions`, {
      method: "POST",
      signal,
      redirect: "error",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: req.model, stream: false, messages: [{ role: "system", content: system }, ...req.messages] }),
    });
    const data = (await readJson(res)) as { choices?: { message?: { content?: unknown } }[]; usage?: { prompt_tokens?: unknown; completion_tokens?: unknown }; error?: { message?: unknown } | string };
    if (!res.ok) {
      const detail = typeof data.error === "string" ? data.error : typeof data.error?.message === "string" ? data.error.message : "";
      throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ""}`);
    }
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) throw new Error("The local model returned an empty answer.");
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return { text: text.trim(), promptTokens: num(data.usage?.prompt_tokens), completionTokens: num(data.usage?.completion_tokens) };
  }, {
    timeoutMs: CHAT_TIMEOUT_MS,
    explain: (e) => {
      const msg = errorText(e);
      if (/model .*not found|no such model|HTTP 404/i.test(msg))
        return { code: "local_model_missing", title: `${req.model} isn't installed`, steps: req.config.engine === "ollama" ? [`Run \`ollama pull ${req.model}\`, or pick a model you already have in Local engine settings.`] : ["Start llama.cpp with the model you want, then pick it in Local engine settings."], actions: ["open_settings", "retry", "use_cloud", "copy_error"] };
      if (/took longer/i.test(msg))
        return { code: "local_timeout", title: "The local model took too long", steps: ["Ask for something shorter, or choose a smaller model.", "Close other heavy apps so the model has more memory and CPU.", "Or switch to a cloud model for this question."], actions: ["retry", "open_settings", "use_cloud", "copy_error"] };
      return explainLocal(req.config, e);
    },
  });
  if (!r.ok) return { ok: false, troubleshoot: r.troubleshoot };
  return { ok: true, text: r.value.text, model: req.model, track, usage: { promptTokens: r.value.promptTokens, completionTokens: r.value.completionTokens, latencyMs: Date.now() - t0 } };
}
