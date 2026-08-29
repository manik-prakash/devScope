import { z } from 'zod';

export const inviteManagerSchema = z.object({
  name:  z.string().min(1).max(80),
  email: z.string().email(),
  role:  z.enum(['MANAGER']),
});

export const deleteOrgSchema = z.object({
  // Must equal the org slug — a typed confirmation for an irreversible action.
  confirm: z.string().min(1),
});
