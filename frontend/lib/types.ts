// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = 'MANAGER' | 'DEVELOPER'
export type EvaluationStatus = 'PENDING' | 'SCORED' | 'FAILED' | 'SKIPPED'
export type Plan = 'FREE' | 'PRO' | 'ENTERPRISE'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: string
}

export interface RefreshResponse {
  accessToken: string
  expiresIn: string
}

export interface JwtPayload {
  sub: string
  orgId: string
  role: UserRole
  iat: number
  exp: number
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

// ─── Organization ─────────────────────────────────────────────────────────────

export interface Organization {
  id: string
  name: string
  slug: string
  plan: Plan
  seats: number
  current_users: number
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  orgId?: string
  createdAt: string
}

// ─── Project ──────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  orgId: string
  name: string
  slug: string
  createdAt: string
  updatedAt: string
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string
  label: string
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

export interface ApiKeyCreateResponse {
  id: string
  key: string
  signing_secret: string
  label: string
}

// ─── Session Stats ────────────────────────────────────────────────────────────

export interface SessionStats {
  totalPrompts: number
  totalResponses: number
  totalIterations: number
  totalToolCalls: number
  shellCommandsCount: number
  filesChangedCount: number
  avgPromptLength: number
  avgResponseLength: number
  fileTypesTouched?: string[]
  [key: string]: unknown
}

// ─── Score Feedback ───────────────────────────────────────────────────────────

export interface ScoreFeedback {
  summary: string
  strengths: string[]
  improvements: string[]
}

// ─── Session ──────────────────────────────────────────────────────────────────

export interface Session {
  id: string
  userId: string
  orgId: string
  projectId: string
  apiKeyId?: string
  agent: string
  agentVersion: string
  startedAt: string
  endedAt: string
  durationMs: string        // BigInt serialized as string by Prisma
  cliVersion: string
  messages?: unknown[]
  stats?: SessionStats
  signatureValid: boolean
  evaluationStatus: EvaluationStatus
  score: number | null
  feedback: ScoreFeedback | null
  evaluatedAt: string | null
  createdAt: string
  updatedAt?: string
  // Joined fields — present depending on which endpoint returns the session
  user?: { name: string; email: string }
  project?: { name: string; slug: string }
}

// ─── API response envelopes ───────────────────────────────────────────────────

export interface ManagerSessionsResponse {
  sessions: Session[]
  pagination: Pagination
}

export interface DeveloperSessionsResponse {
  sessions: Session[]
  pagination: Pagination
}

export interface UsersResponse {
  users: User[]
}

export interface ApiKeysResponse {
  keys: ApiKey[]
}

// ─── CLI /me ──────────────────────────────────────────────────────────────────

export interface MeResponse {
  user_id: string
  org_id: string
  name: string
  email: string
  projects: Array<{ id: string; slug: string; name: string }>
  default_project_slug: string
  signing_secret: string
}

// ─── Error ────────────────────────────────────────────────────────────────────

export interface ApiError {
  error: string
  code: string
}
