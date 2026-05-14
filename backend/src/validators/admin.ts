import { z } from 'zod';

export const inviteManagerSchema = z.object({
  name:  z.string().min(1).max(80),
  email: z.string().email(),
  role:  z.enum(['MANAGER']),
});
