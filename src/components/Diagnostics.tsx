import { useEffect, useRef, useState } from 'react'

type Env = {
  standalone: string
  safeTop: string
  safeBottom: string
  statusBarMeta: string
  themeColor: string
  viewport: string
  ua: string
}

type Probe = {
  starts: number
  moves: number
  locked: boolean
  aborted: boolean
  dx: number
  prevented: number
  fired: boolean
}

const EMPTY_PROBE: Probe = {
  starts: 0,
  moves: 0,
  locked: false,
  aborted: false,
  dx: 0,
  prevented: 0,
  fired: false,
}

function readEnv(): Env {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;top:0;left:0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);visibility:hidden'
  document.body.appendChild(probe)
  const cs = getComputedStyle(probe)
  const safeTop = cs.paddingTop
  const safeBottom = cs.paddingBottom
  probe.remove()


  const standaloneMedia = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true

  return {
    standalone: `media:${standaloneMedia ? 'yes' : 'no'} ios:${iosStandalone ? 'yes' : 'no'}`,
    safeTop,
    safeBottom,
    statusBarMeta:
      document
        .querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
        ?.getAttribute('content') ?? 'absent',
    // On liste TOUTES les balises avec leur media, et on marque celle qui
    // s'applique réellement (*). Lire la première seule affichait #ffffff en
    // permanence, thème sombre inclus.
    themeColor:
      Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'))
        .map((m) => {
          const media = m.getAttribute('media')
          const active = !media || window.matchMedia(media).matches
          return `${m.content}${media ? `@${media.includes('dark') ? 'dark' : 'light'}` : '@all'}${active ? '*' : ''}`
        })
        .join(' ') || 'absent',
    viewport: `${window.innerWidth}x${window.innerHeight} dpr${window.devicePixelRatio}`,
    ua: navigator.userAgent.slice(0, 60),
  }
}

export function Diagnostics() {
  const [env, setEnv] = useState<Env | null>(null)
  const [probe, setProbe] = useState<Probe>(EMPTY_PROBE)
  const stripRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = window.setTimeout(() => setEnv(readEnv()), 0)
    return () => window.clearTimeout(id)
  }, [])

  // Bandeau de test : même mécanique que SwipeRow, mais isolée (aucun lien,
  // aucune image) et instrumentée pour révéler où le geste casse sur iOS.
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    let startX = 0
    let startY = 0
    let tracking = false
    let horizontal = false
    const state = { ...EMPTY_PROBE }

    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      tracking = true
      horizontal = false
      state.starts += 1
      state.moves = 0
      state.locked = false
      state.aborted = false
      state.prevented = 0
      state.dx = 0
      state.fired = false
      setProbe({ ...state })
    }

    const onMove = (e: TouchEvent) => {
      if (!tracking) return
      state.moves += 1
      const moveX = e.touches[0].clientX - startX
      const moveY = e.touches[0].clientY - startY
      if (!horizontal) {
        if (Math.abs(moveX) > 6 && Math.abs(moveX) > Math.abs(moveY) * 0.8) {
          horizontal = true
          state.locked = true
        } else if (Math.abs(moveY) > 14) {
          tracking = false
          state.aborted = true
          setProbe({ ...state })
          return
        } else {
          setProbe({ ...state })
          return
        }
      }
      e.preventDefault()
      state.prevented += 1
      state.dx = Math.round(Math.min(0, Math.max(moveX, -120)))
      setProbe({ ...state })
    }

    const onEnd = () => {
      if (!tracking) return
      tracking = false
      if (horizontal && state.dx <= -72) state.fired = true
      setProbe({ ...state })
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  const rows: [string, string][] = env
    ? [
        ['standalone', env.standalone],
        // Doit valoir 0px : l'app ne déclare plus viewport-fit=cover, donc iOS
        // garde la vue sous ses barres. Une valeur non nulle = `cover` réintroduit.
        ['safe-area top (0 attendu)', env.safeTop],
        ['safe-area bottom', env.safeBottom],
        ['status bar meta', env.statusBarMeta],
        ['theme-color', env.themeColor],
        ['viewport', env.viewport],
      ]
    : []

  return (
    <div className="space-y-4">
      <div
        ref={stripRef}
        className="flex h-20 items-center justify-center rounded border border-rule bg-surface"
        style={{ touchAction: 'pan-y', WebkitTouchCallout: 'none' }}
      >
        <span className="mono-label">← swipe here to test</span>
      </div>

      <dl className="divide-y divide-rule text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 py-1.5">
            <dt className="mono-label shrink-0">{k}</dt>
            <dd className="truncate font-mono text-xs">{v}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 py-1.5">
          <dt className="mono-label shrink-0">swipe probe</dt>
          <dd className="font-mono text-xs">
            start:{probe.starts} move:{probe.moves} lock:{probe.locked ? 'Y' : 'N'} abort:
            {probe.aborted ? 'Y' : 'N'} dx:{probe.dx} pd:{probe.prevented} fire:
            {probe.fired ? 'Y' : 'N'}
          </dd>
        </div>
      </dl>
    </div>
  )
}
