import { z } from 'zod';

export const loginSchema = z.object({
  orgSlug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and dashes')
    .min(2)
    .max(40),
  email: z.string().email(),
  password: z.string().min(8),
});

export const refreshSchema = z.object({
  refreshToken: z.string(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const registerSchema = z.object({
  orgName:  z.string().min(2).max(80),
  orgSlug:  z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and dashes').min(2).max(40),
  name:     z.string().min(1).max(80),
  email:    z.string().email(),
  password: z.string().min(8),
});
