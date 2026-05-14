import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/),
});

export const inviteEngineerSchema = z.object({
  name:  z.string().min(1).max(80),
  email: z.string().email(),
});
