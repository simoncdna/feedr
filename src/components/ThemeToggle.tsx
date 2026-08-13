import { useSyncExternalStore } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'

// Trois états, et non deux. Le réglage par défaut est « suivre le système »,
// mais l'ancien bouton ne faisait qu'alterner clair/sombre : au premier appui il
// écrivait `localStorage.theme` et il n'existait plus AUCUN chemin de retour vers
// l'automatique. L'état par défaut de l'app était donc inatteignable une fois
// quitté.
type Preference = 'auto' | 'light' | 'dark'

const SUIVANT: Record<Preference, Preference> = {
  auto: 'light',
  light: 'dark',
  dark: 'auto',
}

const LIBELLE: Record<Preference, string> = {
  auto: 'Auto',
  light: 'Light',
  dark: 'Dark',
}

// L'état vit dans localStorage, pas dans un état React : le bootstrap de thème
// (__root.tsx) le lit avant le premier paint, et deux ThemeToggle peuvent être
// montés (Sidebar, Settings). Ce registre les tient d'accord.
const abonnes = new Set<() => void>()

function subscribe(onChange: () => void) {
  abonnes.add(onChange)
  // Un autre onglet a pu changer le réglage.
  window.addEventListener('storage', onChange)
  return () => {
    abonnes.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

function getSnapshot(): Preference {
  try {
    const stored = localStorage.theme
    if (stored === 'dark' || stored === 'light') return stored
  } catch {}
  return 'auto'
}

// Rendu serveur : réglage inconnu, on affiche un placeholder jusqu'à l'hydratation.
function getServerSnapshot(): Preference | null {
  return null
}

// A manual override must win over the media-query-based `theme-color` metas the
// root shell renders (__root.tsx). Mutating those metas in place conflicts with
// React 19's hoistable-tag hydration (it doesn't recognize its own node anymore and
// re-inserts a fresh one, leaving stale duplicates). Instead we keep a single
// dedicated, React-unaware meta tag and place it first: browsers use the first
// `meta[name="theme-color"]` whose `media` matches, and a tag with no `media`
// attribute always matches, so ordering it first makes it always win.
//
// `null` retire l'override : les deux balises médiatisées du shell reprennent la
// main, ce qui est exactement ce que veut dire « auto ».
function applyThemeColor(theme: 'light' | 'dark' | null) {
  const existant = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-theme-override]')
  if (theme === null) {
    existant?.remove()
    return
  }
  const color = theme === 'dark' ? '#0c0c0e' : '#ffffff'
  let override = existant
  if (!override) {
    override = document.createElement('meta')
    override.setAttribute('name', 'theme-color')
    override.setAttribute('data-theme-override', '')
    document.head.insertBefore(override, document.head.querySelector('meta[name="theme-color"]'))
  }
  override.content = color
}

export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const preference = useSyncExternalStore<Preference | null>(subscribe, getSnapshot, getServerSnapshot)

  function cycle() {
    const next = SUIVANT[getSnapshot()]
    if (next === 'auto') {
      delete document.documentElement.dataset.theme
      try {
        localStorage.removeItem('theme')
      } catch {}
    } else {
      document.documentElement.dataset.theme = next
      try {
        localStorage.theme = next
      } catch {}
    }
    applyThemeColor(next === 'auto' ? null : next)
    abonnes.forEach((notifier) => notifier())
  }

  if (preference === null) {
    return <span className={withLabel ? 'block h-11' : 'block h-4 w-4'} aria-hidden="true" />
  }

  const Icone = preference === 'auto' ? Monitor : preference === 'dark' ? Moon : Sun
  return (
    <button
      type="button"
      onClick={cycle}
      // L'état COURANT, plus le suivant : un bouton à trois positions dont
      // l'icône ne montrerait que la destination n'est pas lisible.
      aria-label={`Theme: ${LIBELLE[preference]} — switch to ${LIBELLE[SUIVANT[preference]]}`}
      title={`Theme: ${LIBELLE[preference]}`}
      className={withLabel ? 'btn btn-secondary' : 'icon-button'}
    >
      <Icone size={16} strokeWidth={1.5} aria-hidden="true" />
      {withLabel && LIBELLE[preference]}
    </button>
  )
}
