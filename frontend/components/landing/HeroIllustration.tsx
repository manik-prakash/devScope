interface TermLineProps {
  prompt?: boolean
  check?:  boolean
  label:   string
  value?:  string
}

function TermLine({ prompt, check, label, value }: TermLineProps) {
  if (prompt) {
    return (
      <div className="flex items-baseline gap-2">
        <span style={{ color: 'var(--accent-2)' }}>$</span>
        <span style={{ color: 'var(--text)' }}>{label}</span>
      </div>
    )
  }
  return (
    <div className="flex items-baseline gap-2 pl-4">
      {check && <span style={{ color: 'var(--terminal-green)' }}>✓</span>}
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      {value && (
        <span className="ml-auto" style={{ color: 'var(--text-faint)' }}>
          {value}
        </span>
      )}
    </div>
  )
}

export function HeroIllustration() {
  return (
    <div
      className="w-full max-w-[520px] overflow-hidden rounded-lg border"
      style={{
        background: 'var(--terminal-bg)',
        borderColor: 'var(--border)',
        boxShadow: '0 20px 60px -20px rgba(79,107,255,0.25)',
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--danger)', opacity: 0.6 }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--warning)', opacity: 0.6 }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--success)', opacity: 0.6 }} />
        <span
          className="mx-auto font-mono text-xs"
          style={{ color: 'var(--text-faint)' }}
        >
          devscope run claude code
        </span>
      </div>

      {/* Body */}
      <div className="space-y-2.5 p-6 font-mono text-[13px] leading-relaxed">
        <TermLine prompt label="devscope run claude code" />
        <div className="h-1" />
        <TermLine check label="snapshot taken"  value="231 files" />
        <TermLine check label="diff computed"   value="4 files changed" />
        <TermLine check label="redacted"        value="2 secrets masked" />
        <TermLine check label="payload signed"  value="HMAC-SHA256" />
        <TermLine check label="shipped"         value="ses_01H8Z3K9F7QXMD9YATZY3RA1BJ" />
        <span className="animate-ds-blink inline-block" style={{ color: 'var(--accent)' }}>
          ▌
        </span>
      </div>
    </div>
  )
}
