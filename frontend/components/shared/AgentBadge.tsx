interface AgentConfig {
  label: string
  bg: string
  text: string
  border: string
}

const AGENT_MAP: Record<string, AgentConfig> = {
  'claude-code': {
    label: 'Claude Code',
    bg:     'rgba(37, 99, 235, 0.12)',
    text:   '#93C5FD',
    border: 'rgba(37, 99, 235, 0.25)',
  },
  'codex': {
    label: 'Codex',
    bg:     'rgba(22, 163, 74, 0.12)',
    text:   '#86EFAC',
    border: 'rgba(22, 163, 74, 0.25)',
  },
  'cursor': {
    label: 'Cursor',
    bg:     'rgba(124, 58, 237, 0.12)',
    text:   '#C4B5FD',
    border: 'rgba(124, 58, 237, 0.25)',
  },
  'copilot': {
    label: 'Copilot',
    bg:     'rgba(217, 119, 6, 0.12)',
    text:   '#FCD34D',
    border: 'rgba(217, 119, 6, 0.25)',
  },
}

const FALLBACK: AgentConfig = {
  label: '',
  bg:     'var(--surface-2)',
  text:   'var(--text-muted)',
  border: 'var(--border)',
}

interface AgentBadgeProps {
  agent: string
  className?: string
}

export function AgentBadge({ agent, className = '' }: AgentBadgeProps) {
  const key = agent.toLowerCase()
  const cfg = AGENT_MAP[key] ?? { ...FALLBACK, label: agent }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}
      style={{
        background:   cfg.bg,
        color:        cfg.text,
        borderColor:  cfg.border,
      }}
    >
      {cfg.label || agent}
    </span>
  )
}
