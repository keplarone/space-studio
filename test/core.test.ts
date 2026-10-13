import assert from "node:assert/strict";
import { test } from "node:test";
import { MODELS, modelById, publicView, resolvedSlug } from "../src/core/models";
import { applyBillingEvent, cloudDecision, effectivePlan, modelAllowed, type Subscription } from "../src/core/plans";
import { planLink, planUnlink, type Identity } from "../src/core/identities";
import { extractEscalation, route } from "../src/core/router";

const NOW = Date.parse("2026-10-13T12:00:00Z");
const sub = (plan: Subscription["plan"], status: Subscription["status"] = "active", periodEnd: string | null = "2026-11-13T00:00:00Z"): Subscription =>
  ({ plan, status, periodEnd, appliedEvents: [], updatedAt: "", lastEventAt: 0 });
const idle = { runningJobs: 0, minutesThisMonth: 0 };

test("four distinct models with exact names and distinct profiles", () => {
  assert.deepEqual(MODELS.map((m) => m.name), ["Orbit 3.8", "Nebula 4.2", "Solar 5.4", "Nova 5.5"]);
  assert.equal(new Set(MODELS.map((m) => m.system)).size, 4);
  assert.equal(new Set(MODELS.map((m) => JSON.stringify([m.budgets, m.tools]))).size, 4);
  for (const m of MODELS) {
    assert.equal(m.underlying.provider, "Anthropic");
    assert.match(m.underlying.slug, /^anthropic\//);
    assert.equal(m.customization, "specialized configuration (no fine-tuning)");
    assert.ok(m.budgets.reasoningTokens < m.budgets.maxOutputTokens);
    const v = publicView(m, true);
    assert.ok(!("system" in v), "system prompt never sent to clients");
    assert.equal(v.provider, "Anthropic");
  }
  // Budgets grow with the tier.
  const cap = MODELS.map((m) => m.budgets.maxUsdPerTask);
  assert.deepEqual([...cap].sort((a, b) => a - b), cap);
});

test("no retired model names in the registry", () => {
  const all = JSON.stringify(MODELS);
  assert.doesNotMatch(all, /Quasar|Supernova/);
});

test("slug override accepts only Anthropic slugs", () => {
  const orbit = modelById("orbit")!;
  assert.equal(resolvedSlug(orbit, { SPACE_MODEL_ORBIT: "anthropic/claude-haiku-5.5" }), "anthropic/claude-haiku-5.5");
  assert.equal(resolvedSlug(orbit, { SPACE_MODEL_ORBIT: "openai/gpt-x" }), orbit.underlying.slug);
});

test("cloud: Free and Plus denied, Pro/Team/Enterprise allowed", () => {
  assert.equal(cloudDecision(null, NOW, idle).allowed, false);
  assert.equal(cloudDecision(sub("free"), NOW, idle).allowed, false);
  const plus = cloudDecision(sub("plus"), NOW, idle);
  assert.equal(plus.allowed, false);
  assert.equal(!plus.allowed && plus.code, "space_cloud_requires_pro");
  for (const p of ["pro", "team", "enterprise"] as const) assert.equal(cloudDecision(sub(p), NOW, idle).allowed, true, p);
});

test("cloud: expired, canceled, revoked and lapsed plans are Free", () => {
  for (const s of ["canceled", "expired", "revoked"] as const) assert.equal(cloudDecision(sub("pro", s), NOW, idle).allowed, false, s);
  assert.equal(cloudDecision(sub("pro", "active", "2026-10-01T00:00:00Z"), NOW, idle).allowed, false);
  assert.equal(effectivePlan(sub("team", "active", "2026-10-01T00:00:00Z"), NOW), "free");
  assert.equal(effectivePlan({ ...sub("pro"), plan: "ultra" as never }, NOW), "free");
});

test("cloud: concurrency and monthly quota enforced", () => {
  const d = cloudDecision(sub("pro"), NOW, { runningJobs: 2, minutesThisMonth: 0 });
  assert.equal(!d.allowed && d.code, "space_cloud_concurrency");
  const q = cloudDecision(sub("pro"), NOW, { runningJobs: 0, minutesThisMonth: 600 });
  assert.equal(!q.allowed && q.code, "space_cloud_quota");
});

test("models by plan", () => {
  assert.equal(modelAllowed(null, NOW, "orbit"), true);
  assert.equal(modelAllowed(null, NOW, "nova"), false);
  assert.equal(modelAllowed(sub("plus"), NOW, "solar"), true);
  assert.equal(modelAllowed(sub("plus"), NOW, "nova"), false);
  assert.equal(modelAllowed(sub("pro"), NOW, "nova"), true);
});

test("billing events are idempotent and ordered", () => {
  const ev = { id: "evt_1", type: "subscription.activated" as const, plan: "pro" as const, periodEnd: "2026-11-13T00:00:00Z", occurredAt: 100 };
  const a = applyBillingEvent(null, ev, "t1");
  assert.equal(a.changed, true);
  const b = applyBillingEvent(a.sub, ev, "t2");
  assert.equal(b.changed, false);
  assert.deepEqual(b.sub, a.sub);
  const cancel = applyBillingEvent(a.sub, { ...ev, id: "evt_2", type: "subscription.revoked", occurredAt: 200 }, "t3");
  assert.equal(effectivePlan(cancel.sub, NOW), "free");
  // A delayed retry of the older activation can't re-grant Pro.
  const late = applyBillingEvent(cancel.sub, { ...ev, id: "evt_0", occurredAt: 50 }, "t4");
  assert.equal(late.changed, false);
  assert.equal(effectivePlan(late.sub, NOW), "free");
  assert.throws(() => applyBillingEvent(null, { ...ev, plan: "galaxy" as never }, "t"));
});

const keplar: Identity = { provider: "keplar", subject: "u1", label: "a@x.co", linkedAt: "", canSignIn: true };
const roblox = (subject: string): Identity => ({ provider: "roblox", subject, label: "builder", linkedAt: "", canSignIn: false });
const index = (owners: Record<string, string>) => ({ ownerOf: async (p: string, s: string) => owners[`${p}:${s}`] ?? null });

test("linking: conflicts refused, email never merges, reauth required", async () => {
  const ok = await planLink("acc1", [keplar], roblox("r1"), index({}), NOW - 1000, NOW);
  assert.equal(ok.ok, true);
  const conflict = await planLink("acc1", [keplar], roblox("r1"), index({ "roblox:r1": "acc2" }), NOW - 1000, NOW);
  assert.equal(!conflict.ok && conflict.code, "identity_conflict");
  // Same email on a Google identity owned by another account is still a conflict; email plays no part.
  const g: Identity = { provider: "google", subject: "g9", label: "a@x.co", linkedAt: "", canSignIn: true };
  const c2 = await planLink("acc1", [keplar], g, index({ "google:g9": "acc2" }), NOW - 1000, NOW);
  assert.equal(c2.ok, false);
  const stale = await planLink("acc1", [keplar], roblox("r1"), index({}), NOW - 60 * 60_000, NOW);
  assert.equal(!stale.ok && stale.code, "reauth_required");
  const other = await planLink("acc1", [keplar, roblox("r1")], roblox("r2"), index({}), NOW - 1000, NOW);
  assert.equal(!other.ok && other.code, "already_linked_other");
});

test("unlinking never removes the last sign-in method", () => {
  const last = planUnlink([keplar, roblox("r1")], "keplar", NOW - 1000, NOW);
  assert.equal(!last.ok && last.code, "last_method");
  const r = planUnlink([keplar, roblox("r1")], "roblox", NOW - 1000, NOW);
  assert.equal(r.ok, true);
  const g: Identity = { provider: "google", subject: "g1", label: null, linkedAt: "", canSignIn: true };
  assert.equal(planUnlink([keplar, g], "keplar", NOW - 1000, NOW).ok, true);
  assert.equal(planUnlink([keplar, g], "keplar", null, NOW).ok, false);
});

test("routing honors the explicit choice", () => {
  const hard = "Design the multiplayer architecture with server-authoritative replication and anti-cheat for my entire game";
  const r = route("orbit", hard, { allowEscalation: false, allowed: () => true });
  assert.equal(r.served.id, "orbit");
  assert.equal(r.suggestion?.to, "nebula");
  const e = route("orbit", hard, { allowEscalation: true, allowed: () => true });
  assert.equal(e.served.id, "nebula");
  assert.equal(e.escalated, true);
  const blocked = route("solar", hard + " ".repeat(7000) + "```a``` ```b```", { allowEscalation: true, allowed: (id) => id !== "nova" });
  assert.equal(blocked.served.id, "solar");
  assert.equal(route("nova", hard, { allowEscalation: true, allowed: () => true }).served.id, "nova");
  assert.deepEqual(extractEscalation("Here.\nESCALATE: needs multi-file work"), { text: "Here.", reason: "needs multi-file work" });
});
