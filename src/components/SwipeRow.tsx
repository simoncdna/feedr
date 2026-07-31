'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
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
  const dxRef = useRef(0)
  const finalized = useRef(false)
  const holdTimer = useRef<number | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    return () => {
      if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
    }
  }, [])

  const setPull = useCallback((value: number) => {
    dxRef.current = value
    setDx(value)
  }, [])

  // Fin de geste : déclenche l'action si le seuil est franchi, puis referme.
  // Idempotent — plusieurs sources peuvent terminer le même geste (voir plus bas).
  const finalize = useCallback(() => {
    if (finalized.current) return
    finalized.current = true
    const pulled = dxRef.current
    setSettling(true)
    if (pulled <= -THRESHOLD) {
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
  }, [action, setPull])

  const handlers = useSwipeable({
    onSwipeStart: () => {
      if (holdTimer.current !== null) {
        window.clearTimeout(holdTimer.current)
        holdTimer.current = null
      }
      finalized.current = false
      setSettling(false)
    },
    onSwiping: (e) => {
      setPull(e.dir === 'Left' ? -Math.min(e.absX, MAX_PULL) : 0)
    },
    onSwiped: finalize,
    delta: DELTA,
    // Aucun preventDefault : c'est le CSS `touch-action: pan-y` qui autorise le
    // scroll vertical natif et laisse le mouvement horizontal à JS.
    preventScrollOnSwipe: false,
    trackTouch: true,
    trackMouse: false,
  })

  // Filets de sécurité iOS. Deux défaillances observées sur WebKit :
  //  1. `touchcancel` au lieu de `touchend` quand le navigateur reprend la main —
  //     react-swipeable n'écoute pas cet événement du tout ;
  //  2. un `touchstart` parasite en cours de geste réinitialise l'état interne de
  //     la lib, si bien que son `onSwiped` ne part jamais au relâchement.
  // Dans les deux cas la rangée resterait ouverte sans action. `finalize` étant
  // idempotent, terminer le geste nous-mêmes est sans effet de bord.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onEnd = () => {
      if (dxRef.current !== 0) finalize()
    }
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [finalize])

  const armed = dx <= -THRESHOLD || (dx < 0 && settling)
  const { ref: swipeRef, ...swipeProps } = handlers

  return (
    // iOS : sans ces règles, glisser depuis un <a> ou une <img> démarre le drag
    // natif (aperçu de lien / glisser-déposer) et annule le geste.
    <div
      {...swipeProps}
      ref={(el) => {
        swipeRef(el)
        rootRef.current = el
      }}
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
