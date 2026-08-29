const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/**
 * Parse a short duration string (`7d`, `12h`, `30m`, `45s`) to milliseconds.
 * Returns null if it does not match — callers fall back to a documented default.
 *
 * `auth.ts` previously did `parseInt('12h')` → 12 and added 12 *days*; this makes
 * the configured refresh-token lifetime mean what it says.
 */
export function parseDuration(value: string): number | null {
  const m = /^\s*(\d+)\s*([a-z])\s*$/i.exec(value);
  if (!m) return null;
  const [, amount, rawUnit] = m;
  const unit = UNIT_MS[rawUnit!.toLowerCase()];
  if (!unit) return null;
  return parseInt(amount!, 10) * unit;
}
