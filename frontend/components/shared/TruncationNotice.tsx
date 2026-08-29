interface TruncationNoticeProps {
  /** How many rows the screen actually has in hand. */
  shown: number
  /** The capped fetch size those rows came from. */
  limit: number
  noun?: string
  className?: string
}

/**
 * Muted caption for screens that compute stats / charts / counts from a capped
 * "latest N" fetch. Renders only once the fetch is actually saturated
 * (`shown >= limit`) — below that the data is complete and no caveat is needed.
 */
export function TruncationNotice({
  shown,
  limit,
  noun = 'sessions',
  className = 'text-xs',
}: TruncationNoticeProps) {
  if (shown < limit) return null
  return (
    <p className={className} style={{ color: 'var(--text-faint)' }}>
      Based on the most recent {limit.toLocaleString()} {noun} — older {noun} aren’t loaded.
    </p>
  )
}
