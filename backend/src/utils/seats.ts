import { Prisma } from '@prisma/client';
import { forbidden, notFound } from './errors.js';

/**
 * Throws 403 (`SEAT_LIMIT`) when the organization already has `seats` users.
 *
 * Must be called inside an interactive `$transaction`, with its `user.create`
 * in the same transaction: it takes a `SELECT … FOR UPDATE` lock on the org row
 * so concurrent invites serialize instead of all reading the same pre-create
 * count and overshooting `Organization.seats`.
 *
 * Adding an existing org member to a project does not consume a seat — don't
 * call this on that path.
 */
export async function assertSeatAvailable(
  tx: Prisma.TransactionClient,
  orgId: string,
): Promise<void> {
  // Row lock held until the surrounding transaction commits — a parallel invite
  // blocks here and then sees the post-create count.
  await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${orgId} FOR UPDATE`;

  const org = await tx.organization.findUnique({
    where: { id: orgId },
    select: { seats: true },
  });
  if (!org) throw notFound('Organization');

  const count = await tx.user.count({ where: { orgId } });
  if (count >= org.seats) {
    throw forbidden(
      'Organization seat limit reached — remove a member or increase seats',
      'SEAT_LIMIT',
    );
  }
}
