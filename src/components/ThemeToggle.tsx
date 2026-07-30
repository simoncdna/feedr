'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'light' | 'dark'

function currentTheme(): Theme {
  const explicit = document.documentElement.dataset.theme
  if (explicit === 'dark' || explicit === 'light') return explicit
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// A manual override must win over the media-query-based `theme-color` metas Next
// renders from `viewport.themeColor`. Mutating those metas in place conflicts with
// React 19's hoistable-tag hydration (it doesn't recognize its own node anymore and
// re-inserts a fresh one, leaving stale duplicates). Instead we keep a single
// dedicated, React-unaware meta tag and place it first: browsers use the first
// `meta[name="theme-color"]` whose `media` matches, and a tag with no `media`
// attribute always matches, so ordering it first makes it always win.
function applyThemeColor(theme: Theme) {
  const color = theme === 'dark' ? '#0c0c0e' : '#ffffff'
  let override = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-theme-override]')
  if (!override) {
    override = document.createElement('meta')
    override.setAttribute('name', 'theme-color')
    override.setAttribute('data-theme-override', '')
    document.head.insertBefore(override, document.head.querySelector('meta[name="theme-color"]'))
  }
  override.content = color
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null)

  useEffect(() => {
    setTheme(currentTheme())
  }, [])

  function toggle() {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    applyThemeColor(next)
    try {
      localStorage.theme = next
    } catch {}
    setTheme(next)
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className="-m-2 p-2 text-muted transition-colors hover:text-foreground"
    >
      {theme === null ? (
        <span className="block h-4 w-4" aria-hidden="true" />
      ) : theme === 'dark' ? (
        <Sun size={16} strokeWidth={1.5} aria-hidden="true" />
      ) : (
        <Moon size={16} strokeWidth={1.5} aria-hidden="true" />
      )}
    </button>
  )
}
