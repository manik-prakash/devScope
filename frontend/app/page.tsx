import Link from 'next/link'
import {
  ArrowRight,
  ScanLine,
  Shield,
  FileSignature,
  Sparkles,
  BarChart3,
  Terminal,
  Server,
  LayoutDashboard,
  Lock,
  Activity,
} from 'lucide-react'
import { AnnouncementBar } from '@/components/landing/AnnouncementBar'
import { Nav }             from '@/components/landing/Nav'
import { Footer }          from '@/components/landing/Footer'
import { HeroIllustration } from '@/components/landing/HeroIllustration'

// ─── Reusable section heading ────────────────────────────────────────────────

interface SectionHeadingProps {
  eyebrow:  string
  title:    string
  subtitle?: string
}

function SectionHeading({ eyebrow, title, subtitle }: SectionHeadingProps) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p
        className="mb-3 text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--accent)' }}
      >
        {eyebrow}
      </p>
      <h2 className="text-h2" style={{ color: 'var(--text)' }}>
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-dot-grid"
      style={{ minHeight: 'calc(100vh - 96px)' }}
    >
      {/* Top fade */}
      <div
        className="absolute inset-x-0 top-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, var(--bg), transparent)' }}
      />
      {/* Bottom fade */}
      <div
        className="absolute inset-x-0 bottom-0 h-48 pointer-events-none"
        style={{ background: 'linear-gradient(to top, var(--bg), transparent)' }}
      />

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
        {/* Left column */}
        <div className="relative z-10">
          <span
            className="mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
            style={{
              background:  'var(--surface)',
              borderColor: 'var(--border)',
              color:       'var(--text-muted)',
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--success)' }}
            />
            Now in private beta
          </span>

          <h1 className="text-display" style={{ color: 'var(--text)' }}>
            AI agent analytics for{' '}
            <span style={{ color: 'var(--accent)' }}>engineering teams</span>
          </h1>

          <p
            className="mt-6 max-w-lg text-base leading-relaxed"
            style={{ color: 'var(--text-muted)' }}
          >
            Capture, score, and visualize every session your developers run with
            Claude Code and Codex — without sending source code off the box.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150"
              style={{ background: 'var(--accent)' }}
            >
              Get started
              <ArrowRight size={14} />
            </Link>
            <Link
              href="#how"
              className="flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm transition-colors duration-150"
              style={{
                borderColor: 'var(--border)',
                color:       'var(--text)',
              }}
            >
              See how it works
            </Link>
          </div>

          <div className="mt-10 flex items-center gap-6 text-xs" style={{ color: 'var(--text-faint)' }}>
            <span className="flex items-center gap-1.5">
              <Lock size={11} /> Local-first capture
            </span>
            <span className="flex items-center gap-1.5">
              <FileSignature size={11} /> Cryptographically signed
            </span>
          </div>
        </div>

        {/* Right column — illustration */}
        <div className="relative z-10 flex items-center justify-center">
          <HeroIllustration />
        </div>
      </div>
    </section>
  )
}

// ─── Feature strip ────────────────────────────────────────────────────────────

const STRIP_ITEMS = [
  { icon: ScanLine,        label: 'Capture'   },
  { icon: Shield,          label: 'Redact'    },
  { icon: FileSignature,   label: 'Sign'      },
  { icon: Sparkles,        label: 'Evaluate'  },
  { icon: BarChart3,       label: 'Visualize' },
]

function FeatureStrip() {
  return (
    <section
      className="border-y"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 overflow-x-auto px-6 py-6">
        {STRIP_ITEMS.map((item, i) => (
          <div key={item.label} className="flex items-center gap-6">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <item.icon size={16} style={{ color: 'var(--accent)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                {item.label}
              </span>
            </div>
            {i < STRIP_ITEMS.length - 1 && (
              <span style={{ color: 'var(--text-faint)' }}>→</span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Feature cards ────────────────────────────────────────────────────────────

const FEATURE_CARDS = [
  {
    icon:  Sparkles,
    title: 'LLM-graded quality scores',
    body:  'Every session gets a 0–100 score across prompt quality, iteration efficiency, and tool utilization — with concrete feedback.',
    size:  'lg' as const,
  },
  {
    icon:  Lock,
    title: 'Privacy-first by default',
    body:  'Sessions are captured and redacted on the developer machine. Source code, environment variables, and secrets never leave the box.',
    size:  'sm' as const,
  },
  {
    icon:  BarChart3,
    title: 'Two dashboards, one source',
    body:  'Managers see team-wide rollups. Developers see their own progress. Same data, scoped to your role.',
    size:  'sm' as const,
  },
]

const SCORE_DIMENSIONS = [
  { label: 'Prompt Quality',        value: 87 },
  { label: 'Iteration Efficiency',  value: 74 },
  { label: 'Tool Utilization',      value: 91 },
]

function ScoreDimensionBars() {
  return (
    <div className="mt-6 space-y-3">
      {SCORE_DIMENSIONS.map((dim) => (
        <div key={dim.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span style={{ color: 'var(--text-muted)' }}>{dim.label}</span>
            <span className="font-mono" style={{ color: 'var(--text-faint)' }}>{dim.value}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${dim.value}%`, background: 'var(--accent-gradient)' }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function FeatureCards() {
  return (
    <section id="features" className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Why DevScope"
          title="Understand how your team actually works with AI"
          subtitle="Move from gut-feel to grounded data. See which agents perform best, who is iterating efficiently, and where workflows break down."
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
          {FEATURE_CARDS.map((card) => {
            const large = card.size === 'lg'
            return (
              <div
                key={card.title}
                className={`rounded border transition-colors duration-150 ${large ? 'p-10 sm:col-span-2 lg:col-span-2 lg:row-span-2' : 'p-8'}`}
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <div
                  className="mb-5 flex h-9 w-9 items-center justify-center rounded"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                >
                  <card.icon size={18} />
                </div>
                <h3 className={large ? 'text-h2' : 'text-h3'} style={{ color: 'var(--text)' }}>
                  {card.title}
                </h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {card.body}
                </p>
                {large && <ScoreDimensionBars />}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────────

interface HowStep {
  number: string
  title:  string
  body:   string
  icon:   typeof Terminal
}

const HOW_STEPS: HowStep[] = [
  {
    number: '01',
    title:  'Install the CLI',
    body:   'Drop in the devscope binary and authenticate once. No daemons, no kernel modules — a single CLI you run on demand.',
    icon:   Terminal,
  },
  {
    number: '02',
    title:  'Run your agent through it',
    body:   'Wrap your existing agent invocation: devscope run claude code. We capture prompts, tool calls, and durations locally.',
    icon:   Activity,
  },
  {
    number: '03',
    title:  'Sign and sync',
    body:   'The CLI redacts sensitive content, signs the session with your key, and uploads the structured payload.',
    icon:   FileSignature,
  },
  {
    number: '04',
    title:  'Visualize in the dashboard',
    body:   'Sessions appear in real time. Scores, trends, and feedback are computed and displayed within seconds.',
    icon:   LayoutDashboard,
  },
]

function HowItWorks() {
  return (
    <section
      id="how"
      className="border-t py-20"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="How it works"
          title="From shell to dashboard in four steps"
          subtitle="DevScope is built around a thin CLI that does the heavy lifting locally — and a backend that only ever sees the metadata you choose to send."
        />

        <ol className="mx-auto max-w-3xl space-y-4">
          {HOW_STEPS.map((step, i) => {
            const reversed = i % 2 === 1
            return (
              <li
                key={step.number}
                className={`flex flex-col gap-5 rounded border p-6 sm:flex-row sm:items-center ${reversed ? 'sm:flex-row-reverse' : ''}`}
                style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
              >
                {/* Visual block */}
                <div
                  className="flex h-24 w-24 shrink-0 items-center justify-center rounded"
                  style={{
                    background:  'var(--surface-2)',
                    border:      '1px solid var(--border)',
                  }}
                >
                  <step.icon size={28} style={{ color: 'var(--accent)' }} />
                </div>

                {/* Text */}
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-3">
                    <span
                      className="font-mono text-xs"
                      style={{ color: 'var(--text-faint)' }}
                    >
                      {step.number}
                    </span>
                    <h3 className="text-h3" style={{ color: 'var(--text)' }}>
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {step.body}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <Server size={32} className="mx-auto mb-5" style={{ color: 'var(--accent)' }} />
        <h2 className="text-h1" style={{ color: 'var(--text)' }}>
          Ready to see what your team is doing with AI?
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm" style={{ color: 'var(--text-muted)' }}>
          Sign in to your DevScope organization, or talk to us about getting set up.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150"
            style={{ background: 'var(--accent)' }}
          >
            Sign in
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/docs"
            className="flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm transition-colors duration-150"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            Read the docs
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="ds-landing" style={{ background: 'var(--bg)' }}>
      <AnnouncementBar />
      <Nav />
      <main>
        <Hero />
        <FeatureStrip />
        <FeatureCards />
        <HowItWorks />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}
