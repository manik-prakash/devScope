import { vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * Minimal Express Response double for calling controllers directly.
 * `status()` records the code and chains; `json()` / `end()` record the body.
 */
export function mockRes() {
  const res = {
    statusCode: 200 as number,
    body: undefined as unknown,
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn((payload: unknown) => {
      res.body = payload;
      return res;
    }),
    end: vi.fn(() => res),
  };
  return res as typeof res & Response;
}

type MockReqOverrides = Partial<{
  body: unknown;
  params: Record<string, string>;
  query: Record<string, unknown>;
  headers: Record<string, string>;
  prisma: unknown;
  user: unknown;
  apiKey: unknown;
  get: (name: string) => string | undefined;
}>;

/**
 * Minimal Express Request double. Supply `prisma` sub-objects per test.
 */
export function mockReq(overrides: MockReqOverrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    get: () => undefined,
    ...overrides,
  } as unknown as Request;
}
