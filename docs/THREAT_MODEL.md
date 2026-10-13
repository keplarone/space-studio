# Space Studio threat model (v0.1)

## Assets
- Keplar session cookies.
- Linked identities (Roblox and Google subjects).
- The person's project source and Blender files.
- Provider API keys (server only).
- Subscription state.
- Cloud job artifacts.
- Credits and spend.

## Trust boundaries
1. **Renderer to main process (IPC).** The renderer is untrusted.
   - It runs sandboxed, with `contextIsolation` on and `nodeIntegration` off.
   - Its CSP is `connect-src 'none'`, so it has no network access of its own.
   - Every IPC call checks the sender (our window, our `file://` top frame).
   - Each call is validated by `src/main/policy.ts`: an allow-listed API path, a fixed set of methods, no traversal or encoded separators, and a size cap.
2. **Main process to keplar.one.**
   - Requests go over HTTPS from a dedicated session partition. Cookies never reach page script.
   - The base origin is fixed, and off-origin URLs throw an error.
3. **Sign-in window.**
   - It is sandboxed, with no preload.
   - Navigation is limited to keplar.one, Google and Roblox OAuth hosts.
   - New windows are denied.
4. **keplar.one API.**
   - Server-side session and object ownership checks run on every call.
   - Writes must come from the same origin and are rate limited.
   - Entitlements are read only from the stored subscription record, which only verified billing events write.
   - Client-supplied plan and price fields are ignored.
5. **Model output.**
   - It is treated as untrusted text. Nothing generated is executed automatically on the person's machine.
   - Studio and Blender changes are proposals that the person reviews and applies.
6. **Cloud workers** (the existing Roblox Cloud and Blender Cloud infrastructure on keplar.one).
   - Each job runs on Vercel Sandbox microVMs with network egress set to deny-all.
   - Jobs are scoped per workspace and run under time and spend limits.
   - Entitlements are re-checked when a job is claimed and between slices.

## Threats and controls
| Threat | Control | Test |
|---|---|---|
| Renderer calls arbitrary API, admin routes, or traversal | API path allow-list, encoded-dot check | `test/policy.test.ts` |
| Navigation or `window.open` to a hostile page | `will-navigate`/`will-redirect` deny, `setWindowOpenHandler` deny plus an external allow-list | `test/policy.test.ts` (allow-lists) |
| Free or Plus user starts cloud jobs through the API or a modified client | `cloudDecision` on the server at creation, queueing and claim | `test/core.test.ts`, keplar-live `tests/space-studio.test.ts` |
| Forged or replayed billing webhook | HMAC plus timestamp window, idempotent event ids, ordering by `occurredAt` | `core.test.ts` and keplar-live tests |
| Account takeover through email-match merge | Identities keyed by (provider, subject); a conflict is refused | `core.test.ts` |
| Account lockout through unlinking | `planUnlink` refuses removing the last sign-in method | `core.test.ts` |
| Link CSRF, replay or identity substitution | OAuth state, PKCE S256 and nonce in a sealed short-lived cookie bound to the signed-in account; race-safe `insertIfAbsent` index | keplar-live tests |
| Prompt injection from project files or docs | System rules state that retrieved content is data; tools are allow-listed per model; no auto-execution | Covered by design. No automated red-team suite yet. |
| Runaway spend | Per-model `maxUsdPerTask`, credit reservation before calls, per-plan cloud minutes and concurrency | `core.test.ts` |
| Secrets in logs | Tokens are never logged; the Roblox OAuth tokens are not stored (not needed for linking) | Covered by review |

## Not yet done
- Code signing.
- Auto-update signature verification.
- An OS-keychain credential store (the session lives in Chromium's cookie store, encrypted by the OS on macOS and Windows).
- A dependency-scanning CI job.
- Penetration testing.

No certification or formal compliance (SOC 2, ISO, ASVS) is claimed. OWASP ASVS was used as a reference.
