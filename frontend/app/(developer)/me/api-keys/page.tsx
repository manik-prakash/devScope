'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Key, Plus } from 'lucide-react'
import { EmptyState, PageHeader } from '@/components/shared'
import { ApiKeyTable } from '@/components/developer/ApiKeyTable'
import { GenerateKeyModal } from '@/components/developer/GenerateKeyModal'
import { useApiKeys, API_KEYS_QUERY_KEY } from '@/lib/queries/keys'

export default function ApiKeysPage() {
  const [showModal, setShowModal] = useState(false)
  const { data: keys, isLoading } = useApiKeys()
  const queryClient = useQueryClient()

  async function handleCreated() {
    await queryClient.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY })
    setShowModal(false)
  }

  const generateButton = (
    <button
      onClick={() => setShowModal(true)}
      className="flex h-9 items-center gap-2 rounded px-4 text-sm font-medium text-white transition-colors duration-150"
      style={{ background: 'var(--accent)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)' }}
    >
      <Plus size={14} />
      Generate new key
    </button>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Keys"
        subtitle="Keys authenticate the DevScope CLI to your account."
        action={generateButton}
      />

      {isLoading ? (
        <div
          className="h-48 animate-pulse rounded border"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        />
      ) : !keys || keys.length === 0 ? (
        <EmptyState
          icon={Key}
          heading="No API keys yet"
          subtext="Generate a key to authenticate the devscope CLI."
          ctaLabel="Generate new key"
          ctaAction={() => setShowModal(true)}
        />
      ) : (
        <div
          className="rounded border"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <ApiKeyTable keys={keys} />
        </div>
      )}

      {showModal && (
        <GenerateKeyModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
