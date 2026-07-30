'use client'

import { useEffect, useRef, useState, useTransition } from 'react'

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
  const start = useRef<{ x: number; y: number } | null>(null)
  const horizontal = useRef(false)
  const holdTimer = useRef<number | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    return () => {
      if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
    }
  }, [])

  function onTouchStart(e: React.TouchEvent) {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    const t = e.touches[0]
    start.current = { x: t.clientX, y: t.clientY }
    horizontal.current = false
    setSettling(false)
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!start.current) return
    const t = e.touches[0]
    const moveX = t.clientX - start.current.x
    const moveY = t.clientY - start.current.y
    if (!horizontal.current) {
      if (Math.abs(moveX) > 12 && Math.abs(moveX) > Math.abs(moveY) * 1.5) {
        horizontal.current = true
      } else {
        return
      }
    }
    setDx(Math.min(0, Math.max(moveX, -MAX_PULL)))
  }

  function onTouchEnd() {
    const shouldTrigger = horizontal.current && dx <= -THRESHOLD
    setSettling(true)
    if (shouldTrigger) {
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
    start.current = null
    horizontal.current = false
  }

  const armed = dx <= -THRESHOLD || (dx < 0 && settling)

  return (
    <div
      className="relative overflow-hidden [touch-action:pan-y]"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
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
