import { useState } from 'react'
import { Check } from 'lucide-react'
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

  // Voir EnableNotifications : le succès est une phrase, pas un bouton mort.
  return (
    <div aria-live="polite">
      {status === 'done' ? (
        <p className="flex items-center gap-2 text-sm text-accent">
          <Check size={16} strokeWidth={2} aria-hidden="true" />
          Passkey added on this device
        </p>
      ) : (
        <button
          onClick={addPasskey}
          disabled={status === 'working'}
          className="btn btn-secondary"
        >
          {status === 'working' ? 'Waiting for the device…' : 'Add a passkey on this device'}
        </button>
      )}
      {status === 'error' && <p className="mt-2 text-sm text-red-500">Failed — try again.</p>}
    </div>
  )
}
