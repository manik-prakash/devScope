import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function AnnouncementBar() {
  return (
    <Link
      href="/signup"
      className="block w-full py-2 text-center text-xs transition-opacity duration-150 hover:opacity-90 sm:text-sm"
      style={{ background: 'var(--accent)', color: '#FFFFFF' }}
    >
      DevScope — AI agent analytics for engineering teams
      <ArrowRight size={12} className="ml-1.5 inline-block align-[-1px]" />
    </Link>
  )
}
