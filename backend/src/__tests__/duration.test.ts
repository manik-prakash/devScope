import { describe, it, expect } from 'vitest';
import { parseDuration } from '../utils/duration.js';

describe('parseDuration', () => {
  it('parses days/hours/minutes/seconds to milliseconds', () => {
    expect(parseDuration('7d')).toBe(7 * 24 * 60 * 60 * 1000);
    expect(parseDuration('12h')).toBe(12 * 60 * 60 * 1000);
    expect(parseDuration('30m')).toBe(30 * 60 * 1000);
    expect(parseDuration('45s')).toBe(45 * 1000);
  });

  it('does NOT treat "12h" as 12 days', () => {
    expect(parseDuration('12h')).not.toBe(12 * 24 * 60 * 60 * 1000);
  });

  it('tolerates whitespace and unit case', () => {
    expect(parseDuration(' 7D ')).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('returns null for unparseable input', () => {
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('soon')).toBeNull();
    expect(parseDuration('7')).toBeNull();
    expect(parseDuration('7y')).toBeNull();
  });

  it('returns null for a zero-length duration (would expire tokens instantly)', () => {
    expect(parseDuration('0d')).toBeNull();
    expect(parseDuration('0h')).toBeNull();
  });

  it('returns null for an absurdly large duration (Date overflow)', () => {
    expect(parseDuration('99999d')).toBeNull();
    expect(parseDuration('100000000h')).toBeNull();
  });
});
