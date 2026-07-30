'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'

export function AddPasskeyButton() {
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle')

  async function addPasskey() {
    setStatus('working')
    try {
      const res = await authClient.passkey.addPasskey()
      if (res?.error) throw res.error
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div>
      <button
        onClick={addPasskey}
        disabled={status === 'working' || status === 'done'}
        className="mono-label rounded border border-rule bg-surface px-3 py-1.5 transition-colors hover:text-foreground disabled:opacity-50 motion-reduce:transition-none"
      >
        {status === 'done' ? 'Passkey added ✓' : 'Add a passkey on this device'}
      </button>
      {status === 'error' && (
        <p className="mt-2 text-sm text-red-500">Failed — try again.</p>
      )}
    </div>
  )
}
