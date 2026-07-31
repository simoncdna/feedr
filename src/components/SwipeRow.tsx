'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useSwipeable } from 'react-swipeable'

const DELTA = 8
const THRESHOLD = 72
const MAX_PULL = 120
const CONFIRM_HOLD_PX = -56
const CONFIRM_HOLD_MS = 350

export function SwipeRow({
  action,
  bookmarked,
  children,
}: {
  action: () => Promise<void>
  bookmarked: boolean
  children: React.ReactNode
}) {
  const [dx, setDx] = useState(0)
  const [settling, setSettling] = useState(false)
  const holdTimer = useRef<number | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    return () => {
      if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
    }
  }, [])

  // Config recommandée pour iOS : aucun preventDefault (listeners passifs), c'est
  // le CSS `touch-action: pan-y` qui autorise le scroll vertical natif et laisse
  // le mouvement horizontal à JS. Activer preventScrollOnSwipe bloquerait les
  // deux axes ici, puisque onSwiping/onSwiped ne sont pas directionnels.
  const handlers = useSwipeable({
    onSwipeStart: () => {
      if (holdTimer.current !== null) {
        window.clearTimeout(holdTimer.current)
        holdTimer.current = null
      }
      setSettling(false)
    },
    onSwiping: (e) => {
      setDx(e.dir === 'Left' ? -Math.min(e.absX, MAX_PULL) : 0)
    },
    onSwiped: (e) => {
      setSettling(true)
      if (e.dir === 'Left' && e.absX >= THRESHOLD) {
        startTransition(() => action())
        // Pause de confirmation : la rangée reste entrouverte sur l'icône,
        // puis se referme — le temps que l'état serveur revienne.
        setDx(CONFIRM_HOLD_PX)
        holdTimer.current = window.setTimeout(() => {
          setDx(0)
          holdTimer.current = null
        }, CONFIRM_HOLD_MS)
      } else {
        setDx(0)
      }
    },
    delta: DELTA,
    preventScrollOnSwipe: false,
    trackTouch: true,
    trackMouse: false,
  })

  const armed = dx <= -THRESHOLD || (dx < 0 && settling)

  return (
    // iOS : sans ces règles, glisser depuis un <a> ou une <img> démarre le drag
    // natif (aperçu de lien / glisser-déposer) et annule le geste.
    <div
      {...handlers}
      className="relative overflow-hidden [&_a]:[-webkit-user-drag:none] [&_img]:[-webkit-user-drag:none]"
      style={{ touchAction: 'pan-y', WebkitTouchCallout: 'none' }}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-y-0 right-0 flex w-32 items-center justify-end pr-6 lg:hidden ${
          armed || pending ? 'text-accent' : 'text-muted'
        }`}
        style={{
          opacity: dx < 0 || pending ? 1 : 0,
          transition: 'opacity 180ms ease, color 120ms ease',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill={bookmarked ? 'none' : 'currentColor'}
          stroke="currentColor"
          strokeWidth="1.5"
          style={{
            transform: armed || pending ? 'scale(1.15)' : 'scale(1)',
            transition: 'transform 160ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <path d="M6 4h12v17l-6-4-6 4z" strokeLinejoin="round" />
        </svg>
      </div>
      <div
        className="bg-background"
        style={{
          transform: dx ? `translateX(${dx}px)` : undefined,
          transition: settling ? 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  )
}
