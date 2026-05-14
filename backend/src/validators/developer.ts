import { z } from 'zod';

export const updateMeSchema = z.object({
  name: z.string().min(1).max(80),
});
