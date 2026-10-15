import assert from "node:assert/strict";
import { test } from "node:test";
import { localChat, localStatus, validateChat, validateConfig } from "../src/desktop/local_ai_bridge";

const cfg = { engine: "ollama" as const, port: 11434 };
const req = (content = "Make my RemoteEvent safe") => ({ config: cfg, model: "qwen2.5-coder:7b", workspace: "roblox" as const, messages: [{ role: "user" as const, content }] });

test("only 127.0.0.1 on the configured port is contacted, with the specialist prompt", async () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fake = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : {} });
    if (url.endsWith("/v1/models")) return Response.json({ data: [{ id: "qwen2.5-coder:7b" }, { id: "llama3.1:8b" }] });
    return Response.json({ choices: [{ message: { content: "Validate on the server." } }], usage: { prompt_tokens: 120, completion_tokens: 9 } });
  }) as typeof fetch;
  const s = await localStatus(cfg, fake);
  assert.deepEqual(s, { reachable: true, models: ["qwen2.5-coder:7b", "llama3.1:8b"] });
  const r = await localChat(req(), fake);
  assert.equal(r.ok, true);
  if (r.ok) { assert.equal(r.text, "Validate on the server."); assert.equal(r.track, "luau"); assert.equal(r.usage.completionTokens, 9); }
  assert.ok(calls.every((c) => c.url.startsWith("http://127.0.0.1:11434/")));
  const sent = calls[1]!.body as { model: string; stream: boolean; messages: { role: string; content: string }[] };
  assert.equal(sent.model, "qwen2.5-coder:7b");
  assert.equal(sent.stream, false);
  assert.match(sent.messages[0]!.content, /Specialist focus: Roblox Luau systems/);
});

test("server not running -> a troubleshooting card with install steps, never a throw", async () => {
  const refused = (async () => { throw new TypeError("fetch failed", { cause: new Error("connect ECONNREFUSED 127.0.0.1:11434") }); }) as typeof fetch;
  const s = await localStatus(cfg, refused);
  assert.equal(s.reachable, false);
  if (!s.reachable) { assert.equal(s.troubleshoot.code, "local_unreachable"); assert.match(s.troubleshoot.title, /Ollama isn't running on port 11434/); assert.ok(s.troubleshoot.steps.some((x) => x.includes("ollama pull"))); }
  const r = await localChat(req(), refused);
  assert.equal(r.ok, false);
});

test("missing model and bad replies become clear cards", async () => {
  const missing = (async () => Response.json({ error: { message: "model 'qwen2.5-coder:7b' not found" } }, { status: 404 })) as typeof fetch;
  const r = await localChat(req(), missing);
  assert.equal(r.ok, false);
  if (!r.ok) { assert.equal(r.troubleshoot.code, "local_model_missing"); assert.match(r.troubleshoot.steps[0]!, /ollama pull qwen2.5-coder:7b/); }
  const empty = (async () => Response.json({ choices: [{ message: { content: "" } }] })) as typeof fetch;
  const e = await localChat(req(), empty);
  assert.equal(e.ok, false);
  const html = (async () => new Response("<html>", { status: 200 })) as typeof fetch;
  const h = await localChat(req(), html);
  assert.equal(h.ok, false);
  if (!h.ok) assert.match(h.troubleshoot.error, /didn't return JSON/);
});

test("untrusted input from the page is validated", () => {
  assert.equal(validateConfig({ engine: "ollama", port: 80 }), null); // privileged ports refused
  assert.equal(validateConfig({ engine: "remote", port: 11434 }), null);
  assert.equal(validateConfig({ engine: "llamacpp", port: "8080" })?.port, 8080);
  assert.equal(validateChat({ ...req(), model: "a b" }), null);
  assert.equal(validateChat({ ...req(), model: "../../etc" }) !== null, true); // a model name is only sent in the JSON body, never used as a path or host
  assert.equal(validateChat({ ...req(), messages: [] }), null);
  assert.equal(validateChat({ ...req(), messages: [{ role: "system", content: "x" }] }), null);
  assert.equal(validateChat({ ...req("x".repeat(20_001)) }), null);
  assert.equal(validateChat({ ...req(), messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "yo" }] }), null);
});
