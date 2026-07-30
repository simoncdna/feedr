'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { completeSignup, consumeInvitation } from '@/app/actions'

export function InviteClient({ token, kind }: { token: string; kind: string }) {
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle')

  async function accept() {
    if (!name.trim()) return
    setStatus('working')
    try {
      const anon = await authClient.signIn.anonymous()
      if (anon?.error) throw anon.error
      const consumed = await consumeInvitation(token)
      if (!consumed.ok) {
        await authClient.signOut()
        throw new Error('invalid invitation')
      }
      await authClient.updateUser({ name: name.trim() })
      await completeSignup()
      const pk = await authClient.passkey.addPasskey({ name: name.trim() })
      if (pk?.error) throw pk.error
      window.location.href = '/'
    } catch {
      setStatus('error')
    }
  }

  if (kind === 'recovery') {
    return (
      <div className="space-y-2">
        <p className="mono-label">Lost your passkey?</p>
        <p className="text-sm text-muted">
          Sign in on a device where you still have a passkey, then add a new one from Settings.
          If all passkeys are lost, ask the owner for a fresh signup link.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">You&apos;re invited to Feedr.</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        placeholder="Your name"
        className="w-full rounded border border-rule bg-surface px-3 py-1.5 text-sm outline-none focus:border-foreground"
      />
      <button
        onClick={accept}
        disabled={status === 'working'}
        className="mono-label rounded border border-rule bg-surface px-3 py-1.5 transition-colors hover:text-foreground disabled:opacity-50"
      >
        {status === 'working' ? 'Creating…' : 'Join with a passkey'}
      </button>
      {status === 'error' && <p className="text-sm text-red-500">This link no longer works.</p>}
    </div>
  )
}
