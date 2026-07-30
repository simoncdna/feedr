'use client'

import { useState } from 'react'

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const array = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) array[i] = raw.charCodeAt(i)
  return array
}

export function EnableNotifications({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle')

  async function enable() {
    setStatus('working')
    try {
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sw timeout')), 10_000)),
      ])
      if ((await Notification.requestPermission()) !== 'granted') throw new Error('denied')
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      })
      if (!res.ok) throw new Error('subscribe failed')
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div>
      <button
        onClick={enable}
        disabled={status === 'working' || status === 'done'}
        className="rounded-xl bg-orange-500 px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {status === 'done' ? 'Notifications enabled ✓' : 'Enable notifications on this device'}
      </button>
      {status === 'error' && (
        <p className="mt-2 text-sm text-red-600">
          Failed — check the PWA is installed (home screen) and notifications are allowed.
        </p>
      )}
    </div>
  )
}
