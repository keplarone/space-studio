# Space Studio — status (v0.1.0, 2026-10-13)

Only what has actually run is marked as working. Everything else is listed as not built or untested.

## Working and tested
| Area | What exists | Evidence |
|---|---|---|
| Model registry | Orbit 3.8 / Nebula 4.2 / Solar 5.4 / Nova 5.5 as distinct model configurations: prompts, tools, budgets, escalation. No fine-tuning is claimed. | `test/core.test.ts` |
| Routing | The explicit model choice is honored. Escalation is suggested, and only switches when the user allowed it. The model that answered is recorded. | `test/core.test.ts`, keplar-live `tests/space-studio.test.ts` |
| Plans and cloud gate | Free and Plus are denied cloud. Pro, Team and Enterprise are allowed within concurrency and minute limits. Expired, canceled, revoked and lapsed plans count as Free. The server re-checks at job creation and on every worker slice. | Both test suites |
| Billing events | HMAC and timestamp check, idempotent event ids, out-of-order protection | keplar-live tests |
| Linked accounts | Keplar, Google and Roblox identities. Matching emails never merge accounts. Conflicts are refused. The last sign-in method can't be removed. Changes need a sign-in within the last 10 minutes. | Both test suites |
| Roblox connection | OAuth 2.0 with PKCE, state and nonce, through Roblox's official endpoints. Roblox tokens are never stored or logged. | Unit-tested with mocked Roblox. **The live round trip hasn't run yet.** |
| Account deletion | Uses keplar.one's existing deletion flow: confirmation, grace period, session revocation. It now also removes Space Studio data and frees linked identities. | keplar-live privacy tests |
| Desktop shell | Hardening: sandbox, context isolation, CSP sent as a header, sender-checked IPC, API allow-list, navigation lock-down. Detects Blender and Roblox Studio installs. | `test/policy.test.ts`; launched under Electron 44 with xvfb |
| UI | Montserrat, starfield, motion library, every section, model selector, Cloud page with "Requires Pro" labels, Account & Security, Billing | Typecheck and Vite build pass. A headless Electron smoke test ran with a mock bridge. |

## Needs setup before it works for real people
- **Roblox Creator Dashboard:** register the redirect URI `https://keplar.one/api/space-studio/identities/roblox/callback` on the OAuth app.
- **Paid plans:** no prices have been set; the spec says to measure costs first. Until a billing provider sends signed events to `/api/space-studio/billing/webhook`, everyone is on Free. That means cloud stays locked for everyone.
- **Credits:** Space Studio chat and cloud usage are charged to the account's Keplar credits.

## Not built yet
- Solar Smart: researched, sourced and dated game ideation.
- The research repository and the opportunity database.
- The creator analytics dashboard (it needs Roblox Open Cloud analytics scopes).
- The model evaluation and benchmark pipeline. No benchmark claims are made.
- A Studio plugin and a local Blender runner inside the desktop app. Edits are proposals the user applies; the existing Keplar desktop bridges are not ported yet.
- Asset workspace and project sync with conflict resolution: Projects are only a local list.
- Installers, code signing, auto-update, and a Windows/macOS install check.
- Google linking from inside Space Studio: Google sign-in works through keplar.one sign-in.
- Session idle timeout and a separate Space Studio data export: the existing keplar.one ones are used.
