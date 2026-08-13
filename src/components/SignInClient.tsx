import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { claimOwnerRole } from '@/server/mutations'

export function SignInClient({ bootstrap }: { bootstrap: boolean }) {
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle')

  async function signIn() {
    setStatus('working')
    try {
      const res = await authClient.signIn.passkey()
      if (res?.error) throw res.error
      window.location.href = '/'
    } catch {
      setStatus('error')
    }
  }

  async function createOwner() {
    if (!name.trim()) return
    setStatus('working')
    try {
      const anon = await authClient.signIn.anonymous()
      if (anon?.error) throw anon.error
      await authClient.updateUser({ name: name.trim() })
      await claimOwnerRole()
      const pk = await authClient.passkey.addPasskey({ name: name.trim() })
      if (pk?.error) throw pk.error
      window.location.href = '/'
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="space-y-4">
      {bootstrap ? (
        <>
          <p className="text-sm text-muted">First run — create the owner account.</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Your name"
            className="field w-full"
          />
          <button
            onClick={createOwner}
            disabled={status === 'working'}
            className="btn btn-primary w-full"
          >
            {status === 'working' ? 'Creating…' : 'Create owner account'}
          </button>
        </>
      ) : (
        <button
          onClick={signIn}
          disabled={status === 'working'}
          className="btn btn-primary w-full"
        >
          {status === 'working' ? 'Waiting for passkey…' : 'Sign in with passkey'}
        </button>
      )}
      {status === 'error' && (
        <p className="text-sm text-red-500">Something went wrong — try again.</p>
      )}
    </div>
  )
}
