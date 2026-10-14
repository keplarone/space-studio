export type PlanId = "free" | "plus" | "pro" | "team" | "enterprise";
export type ModelId = "orbit" | "nebula" | "solar" | "nova";
export type Workspace = "roblox" | "blender" | "general";

export interface ModelView {
  id: ModelId;
  name: string;
  tagline: string;
  strengths: string[];
  capabilities: string[];
  speed: "fastest" | "fast" | "steady" | "thorough";
  creditNote: string;
  available: boolean;
  ownership?: string;
  customization: string;
  minPlan: "free" | "plus" | "pro";
}

export interface Identity {
  provider: "keplar" | "google" | "roblox";
  linked: boolean;
  label: string | null;
  linkedAt: string | null;
  canUnlink: boolean;
  unlinkBlockedReason: string | null;
}

export interface Me {
  signedIn: boolean;
  email: string | null;
  plan: { id: PlanId; name: string; status: "active" | "none" | "expired" | "canceled"; renewsAt: string | null };
  features: {
    cloud: boolean;
    cloudReason: string | null;
    maxCloudJobsConcurrent: number;
    cloudMinutesMonthly: number;
    storageMb: number;
  };
  models: ModelView[];
  identities: Identity[];
  providers: { keplar: true; google: boolean; roblox: boolean };
  robloxRequired: boolean;
  robloxLinked: boolean;
  pricing: Pricing;
  /** null when signed out. */
  credits: CreditBalance | null;
  /** null when signed out (or from an older keplar.one). */
  profile?: { displayName: string; username: string | null; avatarUrl: string | null } | null;
  onboarding?: { completed: boolean; ageBand: AgeBand | null; parentConsent: "not_needed" | "awaiting_parent" | "approved" | string } | null;
}

export type AgeBand = "under13" | "13to17" | "adult";

export type CreditAllowance =
  | { kind: "windows"; perFiveHours: number; perWeek: number }
  | { kind: "monthly"; perMonth: number; rollover: boolean }
  | { kind: "custom" };

export interface Pricing {
  published: boolean;
  checkoutOpen?: boolean;
  note: string;
  prices?: Record<PlanId, { monthlyUsd: number | null; yearlyUsd: number | null; perSeat: boolean }>;
  allowances?: Record<PlanId, CreditAllowance>;
  packs?: readonly { id: string; credits: number; usd: number }[];
  rules?: readonly string[];
  typicalCredits?: Record<ModelId, number>;
}

export interface CreditBalance {
  plan: PlanId;
  remaining: number;
  limitedBy: "five_hours" | "week" | "month" | "custom";
  resetsAt: string | null;
  windows: { label: string; used: number; limit: number; resetsAt: string }[];
}

export type Effort = "low" | "medium" | "high" | "extra" | "ultracode";

export interface Experience {
  universeId: string;
  placeId: string | null;
  name: string;
  iconUrl: string | null;
  addedAt: string;
  beacon: { connected: boolean; lastEventAt: string | null };
}

export type StatsRange = "1h" | "24h" | "7d" | "30d" | "90d";
export interface Point { t: string; v: number }
export interface Stats {
  range: StatsRange;
  universe: string;
  now: { playing: number; visits: number; favorites: number; at: string } | null;
  ccu: { points: Point[]; peak: number | null; sampledSince: string | null };
  revenue: { connected: boolean; points: Point[]; total: number; sales: number; bySource: { product: number; gamepass: number } };
  robux: { earned: number | null; pending: number | null; pendingWindowHours: number; lastSaleAt: string | null };
}

export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  /** Space Studio credits this answer used (keplar.one >= credits release). */
  credits?: number;
  /** Older keplar.one responses. */
  units?: number;
  latencyMs: number;
}

export interface ChatResponse {
  text: string;
  served: { id: ModelId; name: string };
  requested: ModelId;
  escalation: { suggested: boolean; to: ModelId | null; reason: string | null };
  usage: ChatUsage;
  credits?: { remaining: number; resetsAt: string | null; limitedBy: CreditBalance["limitedBy"] };
  effort?: Effort;
  passes?: number;
}

export interface ApiError {
  error?: string;
  code?: string;
}

export interface JobView {
  id: string;
  status: string;
  goal?: string;
  prompt?: string;
  createdAt?: string;
  updatedAt?: string;
  usage?: Record<string, unknown> | null;
  stopReason?: string | null;
  [key: string]: unknown;
}

export interface CloudView {
  eligible: boolean;
  reason: string | null;
  plan: PlanId;
  quotas: Partial<Me["features"]>;
  roblox: { jobs: JobView[] };
  blender: { jobs: JobView[] };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  served?: ChatResponse["served"];
  requested?: ModelId;
  usage?: ChatUsage;
  escalation?: ChatResponse["escalation"];
  at: number;
}

export interface ChatSession {
  id: string;
  workspace: Workspace;
  title: string;
  createdAt: number;
  model: ModelId;
  messages: ChatMessage[];
}

/* ---------- Onboarding (POST /api/space-studio/profile) ---------- */

export type CreatorRole = "roblox" | "blender" | "both" | "exploring";
export type CreatorExperience = "new" | "some" | "experienced" | "studio";
export type CreatorGoal = "ship_faster" | "learn_luau" | "fix_bugs" | "grow_players" | "monetize" | "make_3d_assets";

export interface ProfileRequest {
  /** YYYY-MM-DD. The server decides the age band; the app only uses it to decide whether to ask for a parent's email. */
  birthDate: string;
  role: CreatorRole | null;
  experience: CreatorExperience | null;
  goals: CreatorGoal[];
  workspaces: ("roblox" | "blender")[];
  consents: { productEmails: boolean; improveWithUsage: boolean };
  /** Sent when the person is under 13: a parent or guardian approves before AI features unlock. */
  parentEmail?: string;
}

/** What the app reads from the reply. Every field is optional so a partial or older server still works. */
export interface ProfileResponse {
  ok?: boolean;
  onboarding?: Me["onboarding"];
  parentConsent?: string | { status?: string; emailSent?: boolean; email?: string | null } | null;
  emailSent?: boolean;
  error?: string;
  code?: string;
}
