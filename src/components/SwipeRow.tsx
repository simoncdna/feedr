'use client'

import { useRef, useState, useTransition } from 'react'

const THRESHOLD = 72
const MAX_PULL = 120

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
  const [snapping, setSnapping] = useState(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const horizontal = useRef(false)
  const [pending, startTransition] = useTransition()

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    start.current = { x: t.clientX, y: t.clientY }
    horizontal.current = false
    setSnapping(false)
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
    if (horizontal.current && dx <= -THRESHOLD) {
      startTransition(() => action())
    }
    setSnapping(true)
    setDx(0)
    start.current = null
    horizontal.current = false
  }

  const armed = dx <= -THRESHOLD

  return (
    <div
      className="relative overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-y-0 right-0 flex w-32 items-center justify-end pr-6 transition-colors lg:hidden ${
          armed || pending ? 'text-accent' : 'text-muted'
        }`}
        style={{ opacity: dx < 0 || pending ? 1 : 0 }}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill={bookmarked ? 'none' : 'currentColor'}
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M6 4h12v17l-6-4-6 4z" strokeLinejoin="round" />
        </svg>
      </div>
      <div
        className="bg-background"
        style={{
          transform: dx ? `translateX(${dx}px)` : undefined,
          transition: snapping ? 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  )
}
