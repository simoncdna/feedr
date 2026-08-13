import { useState } from 'react'
import { Check } from 'lucide-react'

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

  // Le succès n'est PLUS un bouton désactivé. L'abonnement Web Push demande une
  // à trois secondes et un accord système ; l'état terminal était un bouton
  // grisé à 50 % d'opacité portant « Notifications enabled ✓ », c'est-à-dire
  // l'apparence exacte d'une commande morte pour la réussite de l'action la plus
  // importante des réglages. `aria-live` annonce la bascule.
  return (
    <div aria-live="polite">
      {status === 'done' ? (
        <p className="flex items-center gap-2 text-sm text-accent">
          <Check size={16} strokeWidth={2} aria-hidden="true" />
          Notifications enabled on this device
        </p>
      ) : (
        <button
          onClick={enable}
          disabled={status === 'working'}
          className="btn btn-primary"
        >
          {status === 'working' ? 'Enabling…' : 'Enable notifications on this device'}
        </button>
      )}
      {status === 'error' && (
        <p className="mt-2 text-sm text-red-500">
          Failed — check the PWA is installed (home screen) and notifications are allowed.
        </p>
      )}
    </div>
  )
}
