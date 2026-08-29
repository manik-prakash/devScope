// ─── Enums ────────────────────────────────────────────────────────────────────
// Keep in sync with backend/prisma/schema.prisma (UserRole, EvaluationStatus, Plan).

export type UserRole = 'ADMIN' | 'MANAGER' | 'DEVELOPER'
export type EvaluationStatus = 'PENDING' | 'SCORED' | 'FAILED' | 'SKIPPED'
export type EvaluationConfidence = 'HIGH' | 'MEDIUM' | 'LOW'
export type Plan = 'FREE' | 'PRO' | 'ENTERPRISE'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  name: string
  email: string
}

export interface AuthTokens {
  accessToken: string
  expiresIn: string
  mustChangePass?: boolean
  user?: AuthUser
  // The refresh token is delivered as an HttpOnly `ds_refresh` cookie, not in the body.
}

export interface RefreshResponse {
  accessToken: string
  expiresIn: string
  mustChangePass?: boolean
  user?: AuthUser
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
  mustChangePass?: boolean
  createdAt: string
}

// ─── Invite result ────────────────────────────────────────────────────────────

export interface InvitedUserResult {
  id:           string
  name:         string
  email:        string
  role:         UserRole
  /** Present when the backend created a fresh user. Null when an existing user was just added to a new project. */
  tempPassword: string | null
  /** True if the user already existed and was simply added to a project (Phase 4 path). */
  isExisting?: boolean
}

// ─── Project ──────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  orgId: string
  name: string
  slug: string
  createdAt: string
  updatedAt: string
  /** Populated by GET /manager/projects */
  _count?: {
    members:  number
    sessions: number
  }
}

// Returned by GET /manager/projects/:slug (detail view)
export interface ProjectMember {
  projectId: string
  userId:    string
  role:      UserRole
  createdAt: string
  user: {
    id:             string
    name:           string
    email:          string
    role:           UserRole
    mustChangePass: boolean
  }
}

export interface ProjectDetail extends Omit<Project, '_count'> {
  members: ProjectMember[]
  _count: {
    sessions: number
  }
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
  /** Real per-dimension evaluator output. Present on session-detail and list
   *  responses for sessions that ran the multi-stage evaluator; null for legacy
   *  / unsigned / unscored sessions. */
  scoreDetail?: {
    promptQuality: number
    iterationEfficiency: number
    toolUtilization: number
    overallScore: number
    confidence: EvaluationConfidence
  } | null
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
