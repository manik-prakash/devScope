import type { PrismaClient } from '@prisma/client';
import { forbidden, notFound } from './errors.js';

/**
 * Throws 403 (`SEAT_LIMIT`) when the organization already has `seats` users.
 * Call this before creating a NEW user — adding an existing org member to a
 * project does not consume a seat.
 */
export async function assertSeatAvailable(
  prisma: Pick<PrismaClient, 'organization' | 'user'>,
  orgId: string,
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { seats: true },
  });
  if (!org) throw notFound('Organization');

  const count = await prisma.user.count({ where: { orgId } });
  if (count >= org.seats) {
    throw forbidden(
      'Organization seat limit reached — remove a member or increase seats',
      'SEAT_LIMIT',
    );
  }
}
