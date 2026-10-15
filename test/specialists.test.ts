import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyIntent, specialistBlock, TRACK_IDS, TRACKS } from "../src/core/specialists";

test("routing examples: each track wins for prompts in its area", () => {
  const cases: [string, "roblox" | "blender" | "general", string][] = [
    ["My RemoteEvent lets exploiters give themselves coins, how do I validate it on the server?", "roblox", "luau"],
    ["Save player inventory with DataStoreService and retry with pcall", "general", "luau"],
    ["Write a bpy script that unwraps UVs and bakes a normal map from the high poly", "general", "blender"],
    ["Clean topology for a low poly sword with PBR textures", "roblox", "blender"],
    ["Make a sunset with Atmosphere, bloom and sun rays, plus a particle explosion", "roblox", "vfx"],
    ["Responsive shop UI with UIAspectRatioConstraint and a TweenService pop animation", "roblox", "ui"],
    ["How do I improve D1 retention and the onboarding of my simulator? Daily rewards?", "roblox", "retention"],
    ["Spatial audio for footsteps and ambience, and reduce collisions cost on my map", "roblox", "audio"],
  ];
  for (const [text, ws, want] of cases) assert.equal(classifyIntent(text, ws).track, want, text);
});

test("no clear signal falls back to the workspace's track", () => {
  const c = classifyIntent("hello there", "blender");
  assert.deepEqual([c.track, c.confidence], ["blender", "default"]);
  assert.equal(classifyIntent("can you help me?", "roblox").track, "luau");
  assert.equal(classifyIntent("", "general").track, "luau");
});

test("keywords match whole words only", () => {
  // "ui" inside "build" or "guild" must not pull toward the UI track.
  assert.equal(classifyIntent("build a guild system with a datastore", "general").track, "luau");
});

test("every track has instructions, checked notes and keywords, and builds a prompt block", () => {
  for (const id of TRACK_IDS) {
    const t = TRACKS[id];
    assert.ok(t.instructions.length > 100 && t.notes.length >= 2 && Object.keys(t.keywords).length >= 15, id);
    const b = specialistBlock(id);
    assert.ok(b.startsWith(`Specialist focus: ${t.name}.`));
    for (const n of t.notes) assert.ok(b.includes(n));
  }
});

test("long prompts classify fast", () => {
  const big = "please make my RemoteEvent secure ".repeat(800);
  const t0 = performance.now();
  for (let i = 0; i < 50; i++) classifyIntent(big, "roblox");
  assert.ok((performance.now() - t0) / 50 < 5);
});
