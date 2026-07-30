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
  const dxRef = useRef(0)
  const start = useRef<{ x: number; y: number } | null>(null)
  const horizontal = useRef(false)
  const holdTimer = useRef<number | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    return () => {
      if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
    }
  }, [])

  function setPull(value: number) {
    dxRef.current = value
    setDx(value)
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === 'mouse') return
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    start.current = { x: e.clientX, y: e.clientY }
    horizontal.current = false
    setSettling(false)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return
    const moveX = e.clientX - start.current.x
    const moveY = e.clientY - start.current.y
    if (!horizontal.current) {
      if (Math.abs(moveX) > LOCK_PX && Math.abs(moveX) > Math.abs(moveY)) {
        horizontal.current = true
        // capture : les events continuent d'arriver même si le doigt sort de la rangée
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      } else {
        return
      }
    }
    setPull(Math.min(0, Math.max(moveX, -MAX_PULL)))
  }

  function onPointerEnd() {
    if (!start.current) return
    const shouldTrigger = horizontal.current && dxRef.current <= -THRESHOLD
    setSettling(true)
    if (shouldTrigger) {
      startTransition(() => action())
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
    start.current = null
    horizontal.current = false
  }

  const armed = dx <= -THRESHOLD || (dx < 0 && settling)

  return (
    <div
      className="relative overflow-hidden"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
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
