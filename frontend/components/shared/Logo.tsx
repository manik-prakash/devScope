interface LogoProps {
  /** Pixel size of the icon mark. Wordmark scales relative to this. */
  size?: number
  /** Show "devscope" wordmark next to the mark. */
  showWordmark?: boolean
  className?: string
}

export function Logo({ size = 24, showWordmark = true, className = '' }: LogoProps) {
  const wordmarkSize = Math.round(size * 0.7)

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <circle
          cx="16"
          cy="16"
          r="13"
          stroke="currentColor"
          strokeWidth="1.75"
          fill="none"
        />
        <path
          d="M13 10.5 L19 16 L13 21.5"
          stroke="var(--accent)"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {showWordmark && (
        <span
          className="font-bold"
          style={{
            fontSize:      `${wordmarkSize}px`,
            color:         'currentColor',
            letterSpacing: '-0.02em',
            lineHeight:    1,
          }}
        >
          devscope
        </span>
      )}
    </span>
  )
}
