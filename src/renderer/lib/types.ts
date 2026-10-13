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
  provider: string;
  underlyingModel: string;
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
  pricing: { published: boolean; note: string };
}

export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  usd: number;
  units: number;
  latencyMs: number;
}

export interface ChatResponse {
  text: string;
  served: { id: ModelId; name: string; underlyingModel: string };
  requested: ModelId;
  escalation: { suggested: boolean; to: ModelId | null; reason: string | null };
  usage: ChatUsage;
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
