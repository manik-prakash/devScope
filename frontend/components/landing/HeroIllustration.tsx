export function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 480 480"
      xmlns="http://www.w3.org/2000/svg"
      className="h-auto w-full max-w-[520px]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="surfaceGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#1A1A1A" />
          <stop offset="100%" stopColor="#0F0F0F" />
        </linearGradient>
        <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#2563EB" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="accentEdge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>

      {/* Layer 3 (top) — Dashboard */}
      <g transform="translate(240, 120)">
        <polygon
          points="0,-50 170,40 0,130 -170,40"
          fill="url(#surfaceGrad)"
          stroke="url(#accentEdge)"
          strokeWidth="1.2"
        />
        {/* Chart bars on top face */}
        <g opacity="0.85">
          <rect x="-110" y="40"  width="20" height="20" fill="#2563EB" transform="skewY(-15)" />
          <rect x="-80"  y="30"  width="20" height="30" fill="#2563EB" transform="skewY(-15)" opacity="0.7" />
          <rect x="-50"  y="20"  width="20" height="40" fill="#2563EB" transform="skewY(-15)" opacity="0.85" />
          <rect x="-20"  y="10"  width="20" height="50" fill="#2563EB" transform="skewY(-15)" />
          <rect x="10"   y="25"  width="20" height="35" fill="#2563EB" transform="skewY(-15)" opacity="0.65" />
          <rect x="40"   y="15"  width="20" height="45" fill="#2563EB" transform="skewY(-15)" opacity="0.8" />
          <rect x="70"   y="0"   width="20" height="60" fill="#2563EB" transform="skewY(-15)" />
        </g>
        <text x="-170" y="-20" fill="#A0A0A0" fontSize="12" fontFamily="monospace">
          dashboard
        </text>
      </g>

      {/* Connector line */}
      <line x1="240" y1="250" x2="240" y2="290" stroke="#2563EB" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />

      {/* Layer 2 (middle) — Backend */}
      <g transform="translate(240, 260)">
        <polygon
          points="0,-50 170,40 0,130 -170,40"
          fill="url(#surfaceGrad)"
          stroke="url(#accentEdge)"
          strokeWidth="1.2"
          opacity="0.95"
        />
        {/* Grid pattern on top face */}
        <g opacity="0.5" stroke="#2563EB" strokeWidth="0.8" fill="none">
          <line x1="-120" y1="50"  x2="-50"  y2="90"  />
          <line x1="-50"  y1="90"  x2="20"   y2="50"  />
          <line x1="20"   y1="50"  x2="90"   y2="90"  />
          <line x1="-85"  y1="30"  x2="-85"  y2="70"  opacity="0.4" />
          <line x1="-15"  y1="70"  x2="-15"  y2="30"  opacity="0.4" />
          <line x1="55"   y1="30"  x2="55"   y2="70"  opacity="0.4" />
        </g>
        {/* Dots = nodes */}
        <circle cx="-50" cy="90" r="3.5" fill="#3B82F6" />
        <circle cx="20"  cy="50" r="3.5" fill="#3B82F6" />
        <circle cx="-85" cy="30" r="2.5" fill="#A0A0A0" opacity="0.5" />
        <circle cx="55"  cy="70" r="2.5" fill="#A0A0A0" opacity="0.5" />
        <text x="-170" y="-20" fill="#A0A0A0" fontSize="12" fontFamily="monospace">
          backend
        </text>
      </g>

      {/* Connector line */}
      <line x1="240" y1="390" x2="240" y2="425" stroke="#2563EB" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />

      {/* Layer 1 (bottom) — CLI */}
      <g transform="translate(240, 395)">
        <polygon
          points="0,-50 170,40 0,130 -170,40"
          fill="url(#surfaceGrad)"
          stroke="url(#accentEdge)"
          strokeWidth="1.2"
          opacity="0.9"
        />
        {/* Terminal block on top */}
        <g transform="translate(-60, 20) skewY(-15)" fill="#0F0F0F" stroke="rgba(255,255,255,0.12)">
          <rect x="0" y="0" width="120" height="60" rx="2" />
        </g>
        <g transform="translate(-60, 20) skewY(-15)" fill="#86EFAC" fontFamily="monospace" fontSize="9">
          <text x="6" y="14">$ devscope run</text>
          <text x="6" y="28" fill="#A0A0A0">  capturing…</text>
          <text x="6" y="42" fill="#3B82F6">  ▌</text>
        </g>
        <text x="-170" y="-20" fill="#A0A0A0" fontSize="12" fontFamily="monospace">
          cli
        </text>
      </g>

      {/* Accent glow halo behind stack */}
      <ellipse cx="240" cy="280" rx="220" ry="20" fill="url(#accentGrad)" opacity="0.6" />
    </svg>
  )
}
