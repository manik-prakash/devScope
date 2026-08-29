/**
 * Parse `page` / `limit` query params into safe Prisma arguments.
 *
 * Raw `parseInt(req.query.x) || N` let a negative `page` through as a negative
 * `skip` (Prisma throws → 500) and an unbounded `limit` return the whole table.
 * This clamps both — the same bounds `cli.ts` already applied — so `manager`,
 * `developer`, and `cli` controllers stay consistent.
 */
// The dashboards fetch one large page and aggregate client-side (trend charts,
// "latest N" stats, CSV export). Until there are real aggregation endpoints, the
// session-list controllers allow a larger page so those views cover more history.
export const SESSION_LIST_MAX_LIMIT = 500;

export function parsePageParams(
  query: Record<string, unknown> | undefined,
  { defaultLimit = 20, maxLimit = 50 }: { defaultLimit?: number; maxLimit?: number } = {},
): { page: number; limit: number; skip: number } {
  const rawPage = parseInt(String(query?.['page'] ?? ''), 10);
  const rawLimit = parseInt(String(query?.['limit'] ?? ''), 10);

  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.floor(rawLimit), 1), maxLimit)
    : defaultLimit;

  return { page, limit, skip: (page - 1) * limit };
}
