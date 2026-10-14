import assert from "node:assert/strict";
import { test } from "node:test";
import { ALLOWANCES, CREDIT_PACKS, creditBalance, creditsFor, outOfCreditsReason, PRICES, TYPICAL_CREDITS, USD_PER_CREDIT, weekWindow, WEEK_MS } from "../src/core/credits";
import { MODELS } from "../src/core/models";

const NOW = Date.parse("2026-10-14T12:30:00Z"); // a Wednesday
const none = { fiveHour: 0, week: 0, month: 0, previousMonth: 0 };

test("a credit is a cent of actual cost, rounded up, minimum one", () => {
  assert.equal(USD_PER_CREDIT, 0.01);
  assert.equal(creditsFor(0), 0);
  assert.equal(creditsFor(-1), 0);
  assert.equal(creditsFor(Number.NaN), 0);
  assert.equal(creditsFor(0.0001), 1);
  assert.equal(creditsFor(0.03), 3);
  assert.equal(creditsFor(0.031), 4);
});

test("Free has a 5-hour and a weekly limit; the tighter one binds", () => {
  const a = ALLOWANCES.free;
  assert.equal(a.kind, "windows");
  if (a.kind !== "windows") return;
  const fresh = creditBalance("free", none, NOW);
  assert.equal(fresh.remaining, a.perFiveHours);
  assert.equal(fresh.limitedBy, "five_hours");
  assert.equal(fresh.resetsAt, "2026-10-14T15:00:00.000Z");
  assert.equal(fresh.windows.length, 2);
  const tiredWeek = creditBalance("free", { ...none, fiveHour: 0, week: a.perWeek - 5 }, NOW);
  assert.equal(tiredWeek.remaining, 5);
  assert.equal(tiredWeek.limitedBy, "week");
  assert.equal(tiredWeek.resetsAt, "2026-10-19T00:00:00.000Z"); // next Monday 00:00 UTC
  const spent = creditBalance("free", { ...none, fiveHour: a.perFiveHours + 9, week: 40 }, NOW);
  assert.equal(spent.remaining, 0);
  assert.match(outOfCreditsReason(spent, NOW)!, /5-hour limit\. It resets in 3 h/);
  assert.equal(outOfCreditsReason(fresh, NOW), null);
});

test("weeks start on Monday", () => {
  const mon = Date.parse("2026-10-12T00:00:00Z"), sun = Date.parse("2026-10-18T23:59:59Z");
  assert.equal(weekWindow(mon), weekWindow(sun));
  assert.equal(weekWindow(mon) - 1, weekWindow(mon - 1));
  assert.equal(weekWindow(mon + WEEK_MS), weekWindow(mon) + 1);
});

test("paid plans: monthly credits with at most one month of rollover", () => {
  const per = ALLOWANCES.pro.kind === "monthly" ? ALLOWANCES.pro.perMonth : 0;
  assert.equal(creditBalance("pro", none, NOW).remaining, per * 2); // nothing used last month: a full month carries over
  assert.equal(creditBalance("pro", { ...none, previousMonth: per * 5 }, NOW).remaining, per); // overspent last month: no carry, no debt
  assert.equal(creditBalance("pro", { ...none, previousMonth: per - 100, month: 50 }, NOW).remaining, per + 100 - 50);
  const b = creditBalance("pro", { ...none, month: 10_000 }, NOW);
  assert.equal(b.remaining, 0);
  assert.match(outOfCreditsReason(b, NOW)!, /renew in 18 days/);
  assert.equal(b.resetsAt, "2026-11-01T00:00:00.000Z");
});

test("Enterprise is custom", () => {
  assert.equal(creditBalance("enterprise", { ...none, month: 1e9 }, NOW).limitedBy, "custom");
});

test("prices: higher plans include more credits and cost less per credit, yearly is ten months", () => {
  const paid = (["plus", "pro", "team"] as const).map((p) => {
    const a = ALLOWANCES[p];
    return { p, credits: a.kind === "monthly" ? a.perMonth : 0, usd: PRICES[p].monthlyUsd! };
  });
  for (let i = 1; i < paid.length; i++) {
    assert.ok(paid[i]!.credits > paid[i - 1]!.credits);
    assert.ok(paid[i]!.usd / paid[i]!.credits < paid[i - 1]!.usd / paid[i - 1]!.credits);
  }
  for (const { p, credits, usd } of paid) {
    assert.equal(PRICES[p].yearlyUsd, usd * 10);
    // Even at full use the included credits cost at most about half the price.
    assert.ok(credits * USD_PER_CREDIT <= usd * 0.5, p);
  }
  assert.equal(PRICES.free.monthlyUsd, 0);
});

test("credit packs get cheaper per credit with size and never undercut cost", () => {
  for (let i = 0; i < CREDIT_PACKS.length; i++) {
    const per = CREDIT_PACKS[i]!.usd / CREDIT_PACKS[i]!.credits;
    assert.ok(per > USD_PER_CREDIT * 1.25);
    if (i) assert.ok(per < CREDIT_PACKS[i - 1]!.usd / CREDIT_PACKS[i - 1]!.credits);
  }
});

test("typical task costs grow with the model and fit each model's own budget", () => {
  const typ = MODELS.map((m) => TYPICAL_CREDITS[m.id]);
  assert.deepEqual([...typ].sort((a, b) => a - b), typ);
  for (const m of MODELS) assert.ok(TYPICAL_CREDITS[m.id] <= creditsFor(m.budgets.maxUsdPerTask));
});
