const DAY_MS = 24 * 60 * 60 * 1000;

const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: DAY_MS,
};

// Anything longer than this is almost certainly a mistake and risks Date
// overflow when added to Date.now().
const MAX_DURATION_MS = 400 * DAY_MS;

/**
 * Parse a short duration string (`7d`, `12h`, `30m`, `45s`) to milliseconds.
 * Returns null if it does not match, is zero, or exceeds a sane cap — callers
 * fall back to a documented default.
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
  const ms = parseInt(amount!, 10) * unit;
  if (ms <= 0 || ms > MAX_DURATION_MS) return null;
  return ms;
}
