# Space Studio API contract (keplar.one, same-origin, cookie session)

All routes live under /api/space-studio. JSON. Errors: `{ error: string, code: string }` with HTTP status.

GET  /api/space-studio/me
  -> { signedIn: boolean, email: string|null,
       plan: { id: "free"|"plus"|"pro"|"team"|"enterprise", name: string, status: "active"|"none"|"expired"|"canceled", renewsAt: string|null },
       features: { cloud: boolean, cloudReason: string|null, maxCloudJobsConcurrent: number, cloudMinutesMonthly: number, storageMb: number },
       models: ModelView[],
       identities: Identity[],
       providers: { keplar: true, google: boolean, roblox: boolean },   // which sign-in/link methods are configured on the server
       robloxRequired: boolean, robloxLinked: boolean,                 // core workspace locked when robloxRequired && !robloxLinked
       pricing: { published: boolean, note: string } }
  Signed out -> 200 { signedIn: false, ...defaults } (models still listed).

ModelView = { id: "orbit"|"nebula"|"solar"|"nova", name: "Orbit 3.8"|..., tagline, strengths: string[], capabilities: string[],
  speed: "fastest"|"fast"|"steady"|"thorough", creditNote: string, available: boolean, ownership: "Keplar configuration on Anthropic Claude",
  provider: "Anthropic", underlyingModel: string /* e.g. "Claude Haiku 4.5" */, customization: "specialized configuration (no fine-tuning)",
  minPlan: "free"|"plus"|"pro" }

Identity = { provider: "keplar"|"google"|"roblox", linked: boolean, label: string|null /* username/email */, linkedAt: string|null, canUnlink: boolean, unlinkBlockedReason: string|null }

POST /api/space-studio/chat   { model: "orbit"|"nebula"|"solar"|"nova", messages: [{role:"user"|"assistant", content:string}], workspace: "roblox"|"blender"|"general", allowEscalation?: boolean }
  -> { text: string, served: { id, name, underlyingModel }, requested: id, escalation: { suggested: boolean, to: id|null, reason: string|null },
       usage: { promptTokens, completionTokens, usd, units, latencyMs } }
  401 signed out; 402 out of credits / plan; 403 code "roblox_link_required"; 503 model unavailable.

GET  /api/space-studio/cloud
  -> { eligible: boolean, reason: string|null, plan: id, quotas: {...features}, roblox: { jobs: JobView[] }, blender: { jobs: JobView[] } }
  JobView (as returned by existing /api/roblox-cloud/jobs and /api/blender-cloud/jobs list): { id, status, goal|prompt, createdAt, updatedAt, usage?, stopReason? , ...}
  Ineligible users get eligible:false and empty job lists (never an error page).
POST /api/space-studio/cloud/jobs { kind: "roblox"|"blender", ...job fields } -> 201 { job } | 403 { code: "space_cloud_requires_pro" }

GET    /api/space-studio/identities -> { identities: Identity[] }
GET    /api/space-studio/identities/roblox/start  -> 302 to Roblox OAuth (PKCE). 503 code "roblox_not_configured" when not configured.
GET    /api/space-studio/identities/roblox/callback -> 302 back to /space-studio/app?view=account&linked=roblox | &link_error=<code>
DELETE /api/space-studio/identities { provider } -> { identities } | 409 { code: "last_method" } | 409 {code:"reauth_required"}

Existing routes the UI should reuse:
  GET/DELETE/POST /api/account/sessions  (list, sign out one {id}, {action:"all"})
  GET/POST /api/account/delete           ({confirmEmail} schedules deletion; {action:"cancel"} cancels; GET -> scheduled date)
  GET /api/account/export                (data export)
  /signin?next=/space-studio/app         (sign in: Keplar email link, Google)

## Desktop bridge (preload, `window.space`)

The renderer is a local page with no network access (CSP `connect-src 'none'`). Everything goes through this narrow IPC API,
implemented in src/main (the main process makes the HTTPS calls to keplar.one with the Space Studio session cookies, which the
renderer never sees).

```ts
interface SpaceBridge {
  api<T = unknown>(req: { method: "GET" | "POST" | "DELETE"; path: string; body?: unknown }): Promise<{ status: number; data: T }>;
    // path must start with /api/space-studio/ or /api/account/ (anything else is rejected in main)
  signIn(): Promise<{ signedIn: boolean }>;        // opens a keplar.one sign-in window (Keplar email link or Google)
  signOut(): Promise<void>;
  linkRoblox(): Promise<{ linked: boolean; error?: string }>; // opens /api/space-studio/identities/roblox/start in an auth window
  openExternal(url: string): Promise<void>;          // https://keplar.one, roblox.com, blender.org only
  detect(): Promise<{ blender: { path: string; version: string | null }[]; robloxStudio: { path: string }[] }>;
  platform: "win32" | "darwin" | "linux";
  version: string;
}
```
