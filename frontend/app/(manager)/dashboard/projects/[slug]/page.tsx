import { ProjectDetail } from './ProjectDetail'

// ─── Server component — awaits async params (Next.js 16 requirement) ──────────

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <ProjectDetail slug={slug} />
}
