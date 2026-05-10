import { DeveloperDetail } from './DeveloperDetail'

// ─── Server component — awaits async params (Next.js 16 requirement) ──────────

export default async function DeveloperDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  return <DeveloperDetail userId={userId} />
}
