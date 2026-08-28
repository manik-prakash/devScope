import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

/**
 * Regression guard for the Express 4 async-error bug: controllers and
 * middleware are `async` and `throw` AppError / ZodError. Without
 * `express-async-errors` (imported at the top of app.ts) those rejections never
 * reach the error handler — the request hangs and the process can exit. These
 * cases all throw *before* any DB call, so no database is needed.
 */
const app = createApp();

describe('async error handling', () => {
  it('400 JSON for a validation error thrown in an async handler', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('401 JSON for a missing API key (async middleware throw)', async () => {
    const res = await request(app).get('/api/v1/cli/me');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('401 JSON for a missing JWT (sync middleware throw)', async () => {
    const res = await request(app).get('/api/v1/manager/org');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('404 JSON for an unknown route', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
  });
});
