'use client'

import { useEffect, useRef, useState, useTransition } from 'react'

const LOCK_PX = 8
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
  const rootRef = useRef<HTMLDivElement>(null)
  const dxRef = useRef(0)
  const holdTimer = useRef<number | null>(null)
  const actionRef = useRef(action)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    actionRef.current = action
  }, [action])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    let startX = 0
    let startY = 0
    let tracking = false
    let horizontal = false

    const setPull = (value: number) => {
      dxRef.current = value
      setDx(value)
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      if (holdTimer.current !== null) {
        window.clearTimeout(holdTimer.current)
        holdTimer.current = null
      }
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      tracking = true
      horizontal = false
      setSettling(false)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return
      const moveX = e.touches[0].clientX - startX
      const moveY = e.touches[0].clientY - startY
      if (!horizontal) {
        if (Math.abs(moveX) > LOCK_PX && Math.abs(moveX) > Math.abs(moveY)) {
          horizontal = true
        } else if (Math.abs(moveY) > LOCK_PX) {
          tracking = false // scroll vertical : on abandonne le geste
          return
        } else {
          return
        }
      }
      // Geste horizontal verrouillé : on empêche WebKit de scroller/annuler.
      e.preventDefault()
      setPull(Math.min(0, Math.max(moveX, -MAX_PULL)))
    }

    const onTouchEnd = () => {
      if (!tracking) return
      tracking = false
      if (!horizontal) return
      const shouldTrigger = dxRef.current <= -THRESHOLD
      setSettling(true)
      if (shouldTrigger) {
        startTransition(() => actionRef.current())
        // Pause de confirmation : la rangée reste entrouverte sur l'icône,
        // puis se referme — le temps que l'état serveur revienne.
        setPull(CONFIRM_HOLD_PX)
        holdTimer.current = window.setTimeout(() => {
          setPull(0)
          holdTimer.current = null
        }, CONFIRM_HOLD_MS)
      } else {
        setPull(0)
      }
      horizontal = false
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
      if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
    }
  }, [])

  const armed = dx <= -THRESHOLD || (dx < 0 && settling)

  return (
    <div ref={rootRef} className="relative overflow-hidden" style={{ touchAction: 'pan-y' }}>
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
