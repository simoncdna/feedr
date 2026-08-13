import { useState } from 'react'
import { CopyButton } from '@/components/CopyButton'
import { useCreateInvitation } from '@/mutations'
import { publishedLabel } from '@/lib/text'

export type InvitationRow = {
  id: number
  token: string
  kind: string
  expiresAt: Date
  status: 'valid' | 'used' | 'expired'
}

export type InvitableUser = { id: string; name: string }

export function InvitationsSection({
  invitations,
  users,
}: {
  invitations: InvitationRow[]
  users: InvitableUser[]
}) {
  const [newUrl, setNewUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle')
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? '')
  const create = useCreateInvitation()

  async function newInvite(kind: 'signup' | 'recovery', targetUserId?: string) {
    setStatus('working')
    setNewUrl(null)
    try {
      const { url } = await create.mutateAsync({ kind, targetUserId })
      setNewUrl(`${window.location.origin}${url}`)
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => newInvite('signup')}
          disabled={status === 'working'}
          className="btn btn-secondary"
        >
          {status === 'working' ? 'Creating…' : 'New invite link'}
        </button>
        {users.length > 0 && (
          <>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="field"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <button
              onClick={() => newInvite('recovery', selectedUserId)}
              disabled={status === 'working' || !selectedUserId}
              className="btn btn-secondary"
            >
              New recovery link
            </button>
          </>
        )}
      </div>

      {status === 'error' && (
        <p className="text-sm text-red-500">Could not create the link — try again.</p>
      )}

      {newUrl && (
        <div className="flex items-center gap-2 rounded border border-rule bg-surface p-1.5 pl-3">
          <span className="min-w-0 flex-1 truncate text-sm">{newUrl}</span>
          <CopyButton text={newUrl} />
        </div>
      )}

      <ul className="divide-y divide-rule">
        {invitations.map((inv) => (
          <li key={inv.id} className="flex items-center justify-between gap-2 py-2.5">
            <span className="min-w-0">
              <span className="block truncate text-sm">
                {inv.token.slice(0, 8)}… · {inv.kind}
              </span>
              <span className="mono-label block">
                expires {publishedLabel(inv.expiresAt)} · {inv.status}
              </span>
            </span>
          </li>
        ))}
        {invitations.length === 0 && (
          <li className="py-2.5 text-sm text-muted">No open invitations.</li>
        )}
      </ul>
    </div>
  )
}
