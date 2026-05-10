import type { ReactNode } from 'react'
import {
  Terminal,
  Shield,
  FileSignature,
  Sparkles,
  Database,
  Server,
  LayoutDashboard,
  ScanLine,
  Eye,
  Send,
  Lock,
  Code2,
} from 'lucide-react'
import { AnnouncementBar } from '@/components/landing/AnnouncementBar'
import { Nav }    from '@/components/landing/Nav'
import { Footer } from '@/components/landing/Footer'

// ─── TOC structure ────────────────────────────────────────────────────────────

const TOC = [
  {
    heading: 'Getting started',
    items: [
      { id: 'overview',      label: 'What is DevScope' },
      { id: 'architecture',  label: 'Architecture'     },
      { id: 'quickstart',    label: 'Quickstart'       },
    ],
  },
  {
    heading: 'CLI',
    items: [
      { id: 'cli-install',  label: 'Install & auth'    },
      { id: 'cli-commands', label: 'Commands'          },
      { id: 'cli-pipeline', label: 'Capture pipeline'  },
    ],
  },
  {
    heading: 'Platform',
    items: [
      { id: 'privacy',     label: 'Privacy & security' },
      { id: 'evaluation',  label: 'Scoring & feedback' },
      { id: 'dashboards',  label: 'Dashboards'         },
    ],
  },
  {
    heading: 'Reference',
    items: [
      { id: 'data-model',  label: 'Data model'  },
      { id: 'api',         label: 'API reference' },
      { id: 'self-host',   label: 'Self-hosting'  },
    ],
  },
]

// ─── Small typographic helpers ────────────────────────────────────────────────

function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="scroll-mt-24 text-h2 mb-3"
      style={{ color: 'var(--text)' }}
    >
      {children}
    </h2>
  )
}

function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-8 mb-2 text-h3" style={{ color: 'var(--text)' }}>
      {children}
    </h3>
  )
}

function P({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
      {children}
    </p>
  )
}

function Mono({ children }: { children: ReactNode }) {
  return (
    <code
      className="rounded px-1.5 py-0.5 font-mono text-[12.5px]"
      style={{
        background:  'var(--surface-2)',
        color:       'var(--text)',
        border:      '1px solid var(--border)',
      }}
    >
      {children}
    </code>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      className="mb-5 overflow-x-auto rounded border p-4 font-mono text-xs leading-relaxed"
      style={{
        background:  'var(--surface)',
        borderColor: 'var(--border)',
        color:       'var(--text)',
      }}
    >
      <code>{children}</code>
    </pre>
  )
}

interface CalloutProps {
  kind: 'info' | 'warn'
  children: ReactNode
}

function Callout({ kind, children }: CalloutProps) {
  const styles = kind === 'info'
    ? { borderColor: 'rgba(37,99,235,0.25)',  background: 'rgba(37,99,235,0.06)',  color: 'var(--text-muted)' }
    : { borderColor: 'rgba(217,119,6,0.25)',  background: 'rgba(217,119,6,0.06)',  color: 'var(--text-muted)' }
  return (
    <div className="mb-5 rounded border px-4 py-3 text-sm leading-relaxed" style={styles}>
      {children}
    </div>
  )
}

// ─── Pipeline-step row ────────────────────────────────────────────────────────

interface PipelineStepProps {
  number: string
  title:  string
  icon:   typeof Terminal
  body:   string
}

function PipelineStep({ number, title, icon: Icon, body }: PipelineStepProps) {
  return (
    <li
      className="flex gap-4 rounded border p-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded"
        style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
      >
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <div className="mb-1 flex items-baseline gap-2">
          <span className="font-mono text-xs" style={{ color: 'var(--text-faint)' }}>{number}</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{body}</p>
      </div>
    </li>
  )
}

// ─── Endpoint table row ───────────────────────────────────────────────────────

interface EndpointRowProps {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path:   string
  auth:   string
  desc:   string
}

const METHOD_COLOR: Record<EndpointRowProps['method'], string> = {
  GET:    '#86EFAC',
  POST:   '#93C5FD',
  PATCH:  '#FCD34D',
  DELETE: '#FCA5A5',
}

function EndpointRow({ method, path, auth, desc }: EndpointRowProps) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td className="py-2.5 pr-4 align-top">
        <span
          className="font-mono text-[11px] font-bold"
          style={{ color: METHOD_COLOR[method] }}
        >
          {method}
        </span>
      </td>
      <td className="py-2.5 pr-4 align-top">
        <code className="font-mono text-xs" style={{ color: 'var(--text)' }}>{path}</code>
      </td>
      <td className="py-2.5 pr-4 align-top">
        <span className="font-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>{auth}</span>
      </td>
      <td className="py-2.5 align-top text-sm" style={{ color: 'var(--text-muted)' }}>
        {desc}
      </td>
    </tr>
  )
}

function EndpointTable({ children }: { children: ReactNode }) {
  return (
    <div
      className="mb-5 overflow-x-auto rounded border"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th className="py-2 pl-4 pr-4 text-left text-[11px] font-medium uppercase tracking-wider"
                style={{ color: 'var(--text-faint)' }}>Method</th>
            <th className="py-2 pr-4 text-left text-[11px] font-medium uppercase tracking-wider"
                style={{ color: 'var(--text-faint)' }}>Path</th>
            <th className="py-2 pr-4 text-left text-[11px] font-medium uppercase tracking-wider"
                style={{ color: 'var(--text-faint)' }}>Auth</th>
            <th className="py-2 pr-4 text-left text-[11px] font-medium uppercase tracking-wider"
                style={{ color: 'var(--text-faint)' }}>Description</th>
          </tr>
        </thead>
        <tbody className="[&_td:first-child]:pl-4">{children}</tbody>
      </table>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar() {
  return (
    <aside className="hidden lg:block">
      <nav className="sticky top-20 space-y-6">
        {TOC.map((group) => (
          <div key={group.heading}>
            <h4
              className="mb-2 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-faint)' }}
            >
              {group.heading}
            </h4>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="block rounded py-1 text-sm transition-colors duration-150"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  return (
    <div style={{ background: 'var(--bg)' }}>
      <AnnouncementBar />
      <Nav />

      <main className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
        {/* Header */}
        <header className="mb-12">
          <p
            className="mb-3 text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--accent)' }}
          >
            Documentation
          </p>
          <h1 className="text-h1" style={{ color: 'var(--text)' }}>
            Everything you need to run DevScope
          </h1>
          <p className="mt-3 max-w-2xl text-sm" style={{ color: 'var(--text-muted)' }}>
            DevScope is a developer-productivity platform that captures, scores, and visualizes
            AI agent sessions. This guide covers the CLI, the backend API, the dashboards, and the
            privacy model that ties them together.
          </p>
        </header>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[220px_1fr]">
          <Sidebar />

          {/* Article */}
          <article className="max-w-3xl">

            {/* ── Overview ─────────────────────────────────────────────── */}
            <section className="mb-14">
              <H2 id="overview">What is DevScope</H2>
              <P>
                DevScope answers a question most engineering teams cannot answer today:
                <i> how is my team actually using AI coding agents?</i> It is a thin
                command-line tool that wraps your existing agent invocations
                ({<Mono>claude code</Mono>}, {<Mono>codex</Mono>}, etc.), captures what
                happened during the session, evaluates it with an LLM, and surfaces the
                results in two role-scoped dashboards.
              </P>
              <P>
                The design goal is straightforward: produce useful analytics without ever
                shipping source code, prompts, or environment secrets off the developer&apos;s
                machine in raw form. Everything is normalized, redacted, and HMAC-signed on
                the client before it goes anywhere.
              </P>

              <H3>Who it&apos;s for</H3>
              <ul className="mb-5 space-y-2 pl-5 text-sm" style={{ color: 'var(--text-muted)', listStyle: 'disc' }}>
                <li><strong style={{ color: 'var(--text)' }}>Engineering managers</strong> who need team-wide visibility into AI agent adoption, quality, and per-developer trends.</li>
                <li><strong style={{ color: 'var(--text)' }}>Individual developers</strong> who want to track their own AI workflow — which agents work best, where iteration loops break down.</li>
                <li><strong style={{ color: 'var(--text)' }}>Platform teams</strong> who need an audit trail of agent use that is compliant by default.</li>
              </ul>
            </section>

            {/* ── Architecture ────────────────────────────────────────── */}
            <section className="mb-14">
              <H2 id="architecture">Architecture</H2>
              <P>
                DevScope has three components. Each runs independently and communicates over HTTPS:
              </P>

              <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { icon: Terminal,         title: 'CLI',      tag: 'Go · Cobra · Viper',  body: 'Wraps the agent, captures the session, redacts, signs, ships.' },
                  { icon: Server,           title: 'Backend',  tag: 'Express · Prisma · PostgreSQL', body: 'Verifies signatures, stores sessions, runs LLM evaluation.' },
                  { icon: LayoutDashboard,  title: 'Frontend', tag: 'Next.js 16 · React 19',         body: 'Manager and developer dashboards, served from one app.' },
                ].map((c) => (
                  <div
                    key={c.title}
                    className="rounded border p-4"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <div
                      className="mb-3 flex h-8 w-8 items-center justify-center rounded"
                      style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                    >
                      <c.icon size={15} />
                    </div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{c.title}</p>
                    <p className="mt-0.5 font-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>{c.tag}</p>
                    <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{c.body}</p>
                  </div>
                ))}
              </div>

              <H3>Data flow</H3>
              <CodeBlock>{`Developer machine                    Backend                    Browser
─────────────────                    ───────                    ───────
$ devscope run claude code           POST /api/v1/cli/sessions  /dashboard
        │                                     │                       │
        ▼                                     ▼                       ▼
[ snapshot → diff → normalize  ─────▶ verify HMAC ──▶ store ──▶ score │
  redact   → extract → sign ]        signature                via LLM │
                                              │                       │
                                              └────── PostgreSQL ─────┘`}</CodeBlock>
              <P>
                The CLI never sends raw prompts or source. The backend never accepts an
                unsigned session. The dashboards never see anything that the backend hasn&apos;t
                already verified.
              </P>
            </section>

            {/* ── Quickstart ──────────────────────────────────────────── */}
            <section className="mb-14">
              <H2 id="quickstart">Quickstart</H2>
              <P>
                Three commands gets your first session into the dashboard.
              </P>

              <H3>1. Install the CLI</H3>
              <CodeBlock>{`# macOS / Linux
curl -fsSL https://devscope.dev/install.sh | sh

# or build from source (Go 1.22+)
go install github.com/manik-prakash/devscope/cli@latest`}</CodeBlock>

              <H3>2. Authenticate</H3>
              <P>
                Generate an API key from <Mono>/me/api-keys</Mono> in the dashboard, then
                paste it when prompted. The key and signing secret are shown <i>once</i> —
                store them immediately.
              </P>
              <CodeBlock>{`$ devscope auth
? Paste your API key:        ds_live_••••••••••••
? Paste your signing secret: ••••••••••••••••••••
✓ Authenticated as alex@acme.dev (acme/web-platform)`}</CodeBlock>

              <H3>3. Wrap your agent</H3>
              <CodeBlock>{`$ devscope run claude code
  capturing session…
  ✓ snapshot taken    (231 files)
  ✓ diff computed     (4 files changed)
  ✓ payload signed    (HMAC-SHA256)
  ✓ shipped           (session id: ses_01H…)`}</CodeBlock>
              <P>
                The session appears in <Mono>/me/sessions</Mono> within a few seconds. A
                score (0–100) lands shortly after, once the evaluation pipeline finishes.
              </P>
            </section>

            {/* ── CLI Install ─────────────────────────────────────────── */}
            <section className="mb-14">
              <H2 id="cli-install">CLI: install & auth</H2>
              <P>
                The CLI is a single static Go binary. It uses <Mono>Cobra</Mono> for commands
                and <Mono>Viper</Mono> for configuration. Config lives in
                <Mono>~/.devscope/config.yaml</Mono>.
              </P>
              <Callout kind="info">
                The signing secret is what proves a session came from you. Treat it like
                an SSH private key — never commit it, never share it. If it leaks, revoke
                the corresponding API key from the dashboard.
              </Callout>
              <CodeBlock>{`# Show current account + config
$ devscope status
account:     alex@acme.dev
org:         acme
project:     web-platform (default)
api version: v1
cli version: 0.1.0

# Refresh project/user mappings from the backend
$ devscope sync

# Sign out (clears local credentials)
$ devscope logout`}</CodeBlock>
            </section>

            {/* ── CLI Commands ────────────────────────────────────────── */}
            <section className="mb-14">
              <H2 id="cli-commands">CLI: commands</H2>

              <div
                className="mb-5 overflow-x-auto rounded border"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="py-2 pl-4 pr-4 text-left text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Command</th>
                      <th className="py-2 pr-4 text-left text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { cmd: 'devscope auth',                desc: 'Interactive login. Stores the API key + signing secret locally.' },
                      { cmd: 'devscope run <agent> [args]',  desc: 'Wrap an agent invocation. Captures, signs, and ships the session.' },
                      { cmd: 'devscope sync',                desc: 'Refresh org / project / user mappings from the backend.' },
                      { cmd: 'devscope status',              desc: 'Show the current account, default project, and CLI version.' },
                      { cmd: 'devscope config <key> <val>',  desc: 'Read or write a config value (e.g. default project).' },
                      { cmd: 'devscope logout',              desc: 'Clear credentials from the local machine.' },
                    ].map((r) => (
                      <tr key={r.cmd} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="py-2.5 pl-4 pr-4 align-top">
                          <code className="font-mono text-xs" style={{ color: 'var(--text)' }}>{r.cmd}</code>
                        </td>
                        <td className="py-2.5 pr-4 align-top text-sm" style={{ color: 'var(--text-muted)' }}>{r.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <H3>Supported agents</H3>
              <P>
                Adapters live in <Mono>cli/internal/agent/adapters/</Mono>. Today the CLI
                ships with first-class support for <Mono>claude code</Mono> and
                <Mono>codex</Mono>; the adapter interface is intentionally small so adding
                a new agent means implementing one Go interface.
              </P>

              <H3>Offline queue</H3>
              <P>
                If the backend is unreachable, a signed payload is written to
                <Mono>~/.devscope/queue/</Mono> as a JSON file and drained on the next
                successful <Mono>devscope run</Mono>. No session is ever lost to a flaky network.
              </P>
            </section>

            {/* ── Capture pipeline ────────────────────────────────────── */}
            <section className="mb-14">
              <H2 id="cli-pipeline">CLI: capture pipeline</H2>
              <P>
                Every <Mono>devscope run</Mono> invocation walks the payload through a
                seven-stage pipeline. Each stage lives in its own file under
                <Mono>cli/internal/pipeline/</Mono> and is independently tested.
              </P>

              <ol className="mb-6 space-y-3">
                <PipelineStep number="01" icon={ScanLine}      title="Snapshot"  body="Walk the working tree and record file hashes before the agent runs. Used as the baseline for diffing."        />
                <PipelineStep number="02" icon={Eye}           title="Diff"      body="After the agent exits, re-hash and compute what changed: files added, modified, removed. No content is captured." />
                <PipelineStep number="03" icon={Code2}         title="Normalize" body="Parse the agent's log file via its adapter into a canonical message shape (prompts, responses, tool calls)."   />
                <PipelineStep number="04" icon={Shield}        title="Redact"    body="Run prompt/response strings through PII and secret detection. Emails, tokens, and key-shaped strings are masked." />
                <PipelineStep number="05" icon={Sparkles}      title="Extract"   body="Compute behavioral stats: prompt count, iterations, tool calls, avg prompt length, files changed, shell commands." />
                <PipelineStep number="06" icon={FileSignature} title="Sign"      body="HMAC-SHA256 the payload with the developer's signing secret. The backend will reject anything unsigned."           />
                <PipelineStep number="07" icon={Send}          title="Ship"      body="POST the signed payload to /api/v1/cli/sessions. On failure, write to the offline queue and continue."           />
              </ol>

              <Callout kind="info">
                Each stage is a pure function over the previous stage&apos;s output. You can
                inspect any intermediate result by passing <Mono>--dry-run</Mono>, which
                runs the pipeline and prints the final payload without shipping.
              </Callout>
            </section>

            {/* ── Privacy ─────────────────────────────────────────────── */}
            <section className="mb-14">
              <H2 id="privacy">Privacy & security</H2>
              <P>
                Privacy is a design constraint, not a feature flag. Three guarantees:
              </P>

              <H3>1. Source code never leaves the machine</H3>
              <P>
                The diff stage records <i>which</i> files changed, not their contents. File
                paths are recorded; file bodies are not. Shell commands are captured but
                only as their argv arrays.
              </P>

              <H3>2. PII and secrets are redacted before signing</H3>
              <P>
                The redact stage runs before the sign stage, which means: if a secret
                slipped through redaction, the signature would still be over a payload
                containing it. So redaction is strict by default — anything that looks
                like an email, an API key, a JWT, or a high-entropy string is replaced
                with <Mono>[REDACTED]</Mono>.
              </P>

              <H3>3. Every payload is cryptographically signed</H3>
              <P>
                The signing secret is generated server-side when you create an API key
                and shown to you exactly once. The backend recomputes the HMAC on receipt;
                a session with an invalid signature is stored with
                <Mono>evaluationStatus = SKIPPED</Mono> and never scored.
              </P>

              <H3>Auth on the backend</H3>
              <ul className="mb-5 space-y-2 pl-5 text-sm" style={{ color: 'var(--text-muted)', listStyle: 'disc' }}>
                <li><strong style={{ color: 'var(--text)' }}>Dashboard users</strong> authenticate with email + password and receive a JWT access token plus a server-side, revocable refresh token.</li>
                <li><strong style={{ color: 'var(--text)' }}>CLI clients</strong> authenticate with an API key on the <Mono>Authorization</Mono> header and additionally sign each session payload with their signing secret.</li>
                <li><strong style={{ color: 'var(--text)' }}>Roles</strong> are enforced at the route level via <Mono>requireRole</Mono> middleware. Managers can see all sessions in their org; developers only see their own.</li>
              </ul>
            </section>

            {/* ── Evaluation ──────────────────────────────────────────── */}
            <section className="mb-14">
              <H2 id="evaluation">Scoring & feedback</H2>
              <P>
                After a signed session lands in the database, the backend kicks off an
                LLM evaluation via OpenRouter as a fire-and-forget background job. The
                model receives the normalized message log plus the extracted stats and
                returns three things:
              </P>

              <ul className="mb-5 space-y-2 pl-5 text-sm" style={{ color: 'var(--text-muted)', listStyle: 'disc' }}>
                <li><strong style={{ color: 'var(--text)' }}>A score from 0 to 100</strong>, weighted across prompt quality, iteration efficiency, and tool utilization.</li>
                <li><strong style={{ color: 'var(--text)' }}>A short summary</strong> of what the session accomplished.</li>
                <li><strong style={{ color: 'var(--text)' }}>Strengths and improvements</strong> — concrete callouts the developer can act on.</li>
              </ul>

              <P>
                Evaluation status moves through three terminal states:
              </P>
              <CodeBlock>{`PENDING  → evaluation in flight
SCORED   → score + feedback persisted
FAILED   → evaluation errored (will not retry automatically)
SKIPPED  → signature invalid; the session is stored but never scored`}</CodeBlock>
            </section>

            {/* ── Dashboards ──────────────────────────────────────────── */}
            <section className="mb-14">
              <H2 id="dashboards">Dashboards</H2>
              <P>
                One Next.js app serves two distinct experiences, gated by JWT role:
              </P>

              <H3>Manager dashboard ({<Mono>/dashboard</Mono>})</H3>
              <ul className="mb-5 space-y-2 pl-5 text-sm" style={{ color: 'var(--text-muted)', listStyle: 'disc' }}>
                <li><strong style={{ color: 'var(--text)' }}>Overview</strong> — org-level rollups: sessions this week, average score, active developers, most-used agent, recent activity.</li>
                <li><strong style={{ color: 'var(--text)' }}>Projects</strong> — per-project leaderboards, score trends, and session feeds.</li>
                <li><strong style={{ color: 'var(--text)' }}>Team</strong> — developer roster with quick stats; click through for individual deep-dives.</li>
                <li><strong style={{ color: 'var(--text)' }}>Sessions</strong> — full session table with filters and CSV export.</li>
                <li><strong style={{ color: 'var(--text)' }}>Settings</strong> — member management and org-wide config.</li>
              </ul>

              <H3>Developer dashboard ({<Mono>/me</Mono>})</H3>
              <ul className="mb-5 space-y-2 pl-5 text-sm" style={{ color: 'var(--text-muted)', listStyle: 'disc' }}>
                <li><strong style={{ color: 'var(--text)' }}>My stats</strong> — score trend, radar chart across the three score axes, week-over-week insight cards.</li>
                <li><strong style={{ color: 'var(--text)' }}>Sessions</strong> — your sessions only; click to open the detail drawer with full feedback.</li>
                <li><strong style={{ color: 'var(--text)' }}>API keys</strong> — generate, view, and revoke keys for the CLI.</li>
                <li><strong style={{ color: 'var(--text)' }}>Settings</strong> — profile + password.</li>
              </ul>
            </section>

            {/* ── Data Model ──────────────────────────────────────────── */}
            <section className="mb-14">
              <H2 id="data-model">Data model</H2>
              <P>
                The schema is intentionally simple. Five entities, scoped to an organization.
              </P>

              <CodeBlock>{`Organization ──┬── User (MANAGER | DEVELOPER)
               │     └── ProjectMember ── Project
               │
               ├── Project ── Session
               │
               └── ApiKey (per User)

Session
├── agent, agentVersion, cliVersion
├── startedAt, endedAt, durationMs
├── messages   (sanitized, redacted JSON)
├── stats      (behavioral metadata — counts, averages)
├── signatureValid
├── evaluationStatus: PENDING | SCORED | FAILED | SKIPPED
├── score      (0–100, nullable until SCORED)
└── feedback   { summary, strengths[], improvements[] }`}</CodeBlock>

              <P>
                Sessions are immutable once written. Re-running the evaluator produces an
                updated <Mono>score</Mono>, <Mono>feedback</Mono>, and
                <Mono>evaluatedAt</Mono>, but the captured payload is never modified.
              </P>
            </section>

            {/* ── API Reference ───────────────────────────────────────── */}
            <section className="mb-14">
              <H2 id="api">API reference</H2>
              <P>
                The API is versioned under <Mono>/api/v1</Mono>. Two authentication schemes,
                used by different clients:
              </P>
              <ul className="mb-5 space-y-2 pl-5 text-sm" style={{ color: 'var(--text-muted)', listStyle: 'disc' }}>
                <li><strong style={{ color: 'var(--text)' }}>JWT</strong> — dashboard clients. Bearer token in <Mono>Authorization</Mono>.</li>
                <li><strong style={{ color: 'var(--text)' }}>API key</strong> — CLI clients. Key in <Mono>Authorization</Mono>; payloads additionally HMAC-signed.</li>
              </ul>

              <H3>Auth</H3>
              <EndpointTable>
                <EndpointRow method="POST" path="/api/v1/auth/login"   auth="—"   desc="Email + password → access token + refresh token." />
                <EndpointRow method="POST" path="/api/v1/auth/refresh" auth="—"   desc="Exchange a refresh token for a new access token." />
                <EndpointRow method="POST" path="/api/v1/auth/logout"  auth="JWT" desc="Revoke the current refresh token server-side." />
              </EndpointTable>

              <H3>CLI</H3>
              <EndpointTable>
                <EndpointRow method="GET"  path="/api/v1/cli/me"              auth="API key" desc="Return the calling user, org, project mappings, and signing secret prefix." />
                <EndpointRow method="POST" path="/api/v1/cli/sessions"        auth="API key" desc="Ingest a signed session payload. Verifies HMAC before persisting." />
                <EndpointRow method="GET"  path="/api/v1/cli/sessions/recent" auth="API key" desc="Recent sessions for the calling key (for the CLI status pane)." />
              </EndpointTable>

              <H3>Manager</H3>
              <EndpointTable>
                <EndpointRow method="GET"  path="/api/v1/manager/org"                auth="JWT (MANAGER)" desc="Organization metadata for the current user." />
                <EndpointRow method="GET"  path="/api/v1/manager/users"              auth="JWT (MANAGER)" desc="List all users in the organization." />
                <EndpointRow method="POST" path="/api/v1/manager/projects"           auth="JWT (MANAGER)" desc="Create a new project under the org." />
                <EndpointRow method="GET"  path="/api/v1/manager/sessions"           auth="JWT (MANAGER)" desc="Paginated list of all sessions in the org." />
                <EndpointRow method="GET"  path="/api/v1/manager/sessions/:id"       auth="JWT (MANAGER)" desc="Full session detail including messages and feedback." />
              </EndpointTable>

              <H3>Developer</H3>
              <EndpointTable>
                <EndpointRow method="GET"    path="/api/v1/developer/sessions"          auth="JWT" desc="Paginated list of the calling user's own sessions." />
                <EndpointRow method="GET"    path="/api/v1/developer/sessions/:id"      auth="JWT" desc="Full session detail (scoped to the calling user)." />
                <EndpointRow method="GET"    path="/api/v1/developer/api-keys"          auth="JWT" desc="List the user's active and revoked API keys." />
                <EndpointRow method="POST"   path="/api/v1/developer/api-keys"          auth="JWT" desc="Generate a new API key + signing secret. Shown once." />
                <EndpointRow method="DELETE" path="/api/v1/developer/api-keys/:keyId"   auth="JWT" desc="Revoke an existing key. Sessions signed with it stop being accepted." />
              </EndpointTable>

              <H3>Health</H3>
              <EndpointTable>
                <EndpointRow method="GET" path="/api/v1/health" auth="—" desc="Liveness probe. Returns 200 if the process is up and the DB is reachable." />
              </EndpointTable>
            </section>

            {/* ── Self-hosting ────────────────────────────────────────── */}
            <section className="mb-14">
              <H2 id="self-host">Self-hosting</H2>
              <P>
                DevScope is built to be self-hostable. The backend is a stock Express +
                Prisma app; the frontend is a stock Next.js 16 app. You need:
              </P>

              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { icon: Database, title: 'PostgreSQL 16', body: 'Any managed Postgres (Neon, Supabase, RDS) works. Run prisma migrations once.' },
                  { icon: Lock,     title: 'OpenRouter key', body: 'For LLM evaluation. Set OPENROUTER_API_KEY in the backend env.' },
                  { icon: Server,   title: 'Node 20+ host',  body: 'Any Node runtime — Fly, Render, Railway, or your own VM.' },
                ].map((c) => (
                  <div
                    key={c.title}
                    className="rounded border p-4"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <div
                      className="mb-2 flex h-8 w-8 items-center justify-center rounded"
                      style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                    >
                      <c.icon size={14} />
                    </div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{c.title}</p>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{c.body}</p>
                  </div>
                ))}
              </div>

              <H3>Required env vars</H3>
              <CodeBlock>{`# backend/.env
DATABASE_URL=postgresql://user:pass@host:5432/devscope
JWT_SECRET=<32+ char random string>
OPENROUTER_API_KEY=sk-or-...
CORS_ORIGINS=https://your-dashboard.example.com

# frontend/.env.local
NEXT_PUBLIC_API_URL=https://api.your-domain.example.com/api/v1`}</CodeBlock>

              <H3>First-run setup</H3>
              <CodeBlock>{`# 1. Apply database schema
cd backend
npx prisma migrate deploy

# 2. Seed an initial organization + manager account
npm run seed -- --org "Acme" --email you@acme.dev

# 3. Start the backend
npm run start

# 4. Start the frontend
cd ../frontend
npm run build && npm run start

# 5. Log in at https://your-dashboard.example.com/login`}</CodeBlock>

              <Callout kind="warn">
                The seed script prints the initial manager&apos;s temporary password to
                stdout exactly once. Capture it before the process exits — there is no
                way to recover it afterward, only to reset it via the database.
              </Callout>
            </section>

          </article>
        </div>
      </main>

      <Footer />
    </div>
  )
}
