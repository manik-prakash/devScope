import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/env.ts', 'src/index.ts'],
    },
    // Load test env before each file — overrides .env so CI never needs a real DB
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/devscope_test',
      JWT_SECRET: 'test-secret-that-is-long-enough-for-zod-validation',
      JWT_EXPIRES_IN: '15m',
      REFRESH_EXPIRES_IN: '7d',
      OPENROUTER_API_KEY: 'sk-or-test',
      OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
      OPENROUTER_MODEL: 'openai/gpt-4o-mini',
      CORS_ORIGINS: 'http://localhost:5173',
      PORT: '3001',
    },
  },
})
