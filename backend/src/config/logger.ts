/**
 * src/config/logger.ts
 *
 * Pino logger instance shared across the application.
 * Pretty-prints in development, emits JSON in production.
 */

import pino from 'pino'
import { env } from './env.js'

export const logger = pino(
  env.NODE_ENV === 'production'
    ? { level: 'info' }
    : {
        level: 'debug',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      },
)
