import assert from "node:assert/strict";
import { test } from "node:test";
import { apiUrl, isAllowedAuthNavigation, isAllowedExternal, validateApiRequest } from "../src/main/policy";

test("bridge allows only Space Studio and account API paths", () => {
  assert.ok(validateApiRequest({ method: "GET", path: "/api/space-studio/me" }));
  assert.ok(validateApiRequest({ method: "POST", path: "/api/account/delete", body: { confirmEmail: "a@b.co" } }));
  assert.ok(validateApiRequest({ method: "DELETE", path: "/api/account/sessions", body: { id: "x" } }));
  for (const path of ["/api/admin/users", "/api/space-studio/../admin", "//evil.com/api/space-studio/me", "https://evil.com/api/space-studio/me",
    "/api/space-studio/%2e%2e/admin", "/api/space-studio\\..\\admin", "/api/account/deleteeverything", "/api/keys", "api/space-studio/me"]) {
    assert.equal(validateApiRequest({ method: "GET", path }), null, path);
  }
  assert.equal(validateApiRequest({ method: "PUT", path: "/api/space-studio/me" }), null);
  assert.equal(validateApiRequest({ method: "GET", path: "/api/space-studio/me", body: {} }), null);
  assert.equal(validateApiRequest({ method: "POST", path: "/api/space-studio/chat", body: "x".repeat(300_000) }), null);
  assert.equal(validateApiRequest(null), null);
});

test("api URLs stay on keplar.one", () => {
  assert.equal(apiUrl("/api/space-studio/me"), "https://keplar.one/api/space-studio/me");
  assert.throws(() => apiUrl("//evil.com/x"));
});

test("external links: https and allow-listed hosts only", () => {
  assert.ok(isAllowedExternal("https://keplar.one/space-studio#plans"));
  assert.ok(isAllowedExternal("https://space.keplar.one/#plans"));
  assert.ok(isAllowedExternal("https://create.roblox.com/docs"));
  for (const u of ["http://keplar.one", "file:///etc/passwd", "javascript:alert(1)", "https://keplar.one.evil.com", "https://user:pw@keplar.one", "smb://x", 42])
    assert.equal(isAllowedExternal(u), false, String(u));
});

test("sign-in window navigation allow-list", () => {
  assert.ok(isAllowedAuthNavigation("https://keplar.one/signin"));
  assert.ok(isAllowedAuthNavigation("https://accounts.google.com/o/oauth2/v2/auth"));
  assert.equal(isAllowedAuthNavigation("https://evil.com"), false);
  assert.equal(isAllowedAuthNavigation("http://keplar.one"), false);
});

test("the version the app shows matches package.json", async () => {
  const { readFileSync } = await import("node:fs");
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.match(readFileSync("src/main/preload.ts", "utf8"), new RegExp(`version: "${pkg.version.replace(/\./g, "\\.")}"`));
});

test("sign-in start URLs stay on keplar.one and default to Keplar sign-in", async () => {
  const { signInStartUrl } = await import("../src/main/policy");
  assert.equal(signInStartUrl("keplar"), "https://keplar.one/signin?next=%2Fspace-studio");
  assert.equal(signInStartUrl("google"), "https://keplar.one/signin?provider=google&next=%2Fspace-studio");
  assert.equal(signInStartUrl("roblox"), "https://keplar.one/api/space-studio/auth/roblox/start?next=%2Fspace-studio");
  assert.equal(signInStartUrl("https://evil.example"), "https://keplar.one/signin?next=%2Fspace-studio");
  assert.equal(signInStartUrl(undefined), "https://keplar.one/signin?next=%2Fspace-studio");
});
