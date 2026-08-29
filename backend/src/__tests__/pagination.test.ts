import { describe, it, expect } from 'vitest';
import { parsePageParams } from '../utils/pagination.js';

describe('parsePageParams', () => {
  it('defaults to page 1 / limit 20 when absent', () => {
    expect(parsePageParams({})).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('clamps a negative page to 1 (never a negative skip)', () => {
    const { page, skip } = parsePageParams({ page: '-3', limit: '10' });
    expect(page).toBe(1);
    expect(skip).toBe(0);
  });

  it('caps limit at 50 by default and floors it at 1', () => {
    expect(parsePageParams({ limit: '99999' }).limit).toBe(50);
    expect(parsePageParams({ limit: '0' }).limit).toBe(1);
    expect(parsePageParams({ limit: '-5' }).limit).toBe(1);
  });

  it('honours a caller-supplied maxLimit (session-list endpoints allow 500)', () => {
    expect(parsePageParams({ limit: '99999' }, { maxLimit: 500 }).limit).toBe(500);
    expect(parsePageParams({ limit: '200' }, { maxLimit: 500 }).limit).toBe(200);
  });

  it('computes skip from the clamped values', () => {
    expect(parsePageParams({ page: '3', limit: '20' })).toEqual({ page: 3, limit: 20, skip: 40 });
  });

  it('falls back to defaults for non-numeric input', () => {
    expect(parsePageParams({ page: 'abc', limit: 'xyz' })).toEqual({ page: 1, limit: 20, skip: 0 });
  });
});
