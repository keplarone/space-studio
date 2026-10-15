import assert from "node:assert/strict";
import { test } from "node:test";
import { safely, TimeoutError, withTimeout } from "../src/main/safe";

test("safely returns the value, or a troubleshooting card with the real error", async () => {
  assert.deepEqual(await safely("Saving", async () => 42), { ok: true, value: 42 });
  const r = await safely("Saving the script", async () => { throw new Error("EACCES: permission denied, open 'C:/game/x.lua'"); });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.troubleshoot.kind, "troubleshoot");
  assert.equal(r.troubleshoot.title, "Saving the script didn't work");
  assert.match(r.troubleshoot.error, /EACCES: permission denied/);
  assert.ok(r.troubleshoot.steps.length > 0);
});

test("a stuck operation is cut off at its timeout and aborted", async () => {
  let aborted = false;
  const t0 = Date.now();
  const r = await safely("Running Blender", (signal) => new Promise((_, reject) => { signal.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); }); }), { timeoutMs: 80 });
  assert.ok(Date.now() - t0 < 1000);
  assert.equal(aborted, true);
  assert.equal(r.ok, false);
  if (!r.ok) { assert.equal(r.troubleshoot.code, "timeout"); assert.match(r.troubleshoot.title, /took too long/); }
  await assert.rejects(withTimeout(new Promise(() => {}), 20, "x"), TimeoutError);
});

test("synchronous throws and a throwing explainer are contained too", async () => {
  const r = await safely("Compiling", () => { throw new TypeError("bad"); }, { explain: () => { throw new Error("explainer broke"); } });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.troubleshoot.error, /TypeError: bad/);
});
