import { useEffect, useId, useRef, useState } from 'react'
import { CategorySelect } from '@/components/CategorySelect'
import type { FeedCandidate } from '@/lib/feed-discovery'
import { useAddFeed } from '@/mutations'

export function AddFeedForm({ categories }: { categories: { id: number; name: string }[] }) {
  const [url, setUrl] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(categories[0]?.id ?? null)
  // Les quatre messages ci-dessous viennent du serveur mot pour mot :
  // 'Invalid URL or category', 'Could not read this RSS feed',
  // 'This feed already exists', 'No RSS feed found at this address'.
  // Le `catch` de tryUrl réutilise le deuxième comme filet pour toute mutation
  // qui lève sans résultat exploitable (réseau coupé, redirection d'auth,
  // échec de sérialisation) : simplification volontaire, l'utilisateur agit
  // pareil quelle que soit la panne d'infrastructure en cause.
  const [error, setError] = useState<string | null>(null)
  // Plusieurs flux trouvés : le serveur nous les renvoie et attend un choix.
  const [candidates, setCandidates] = useState<FeedCandidate[] | null>(null)
  const candidatesHeadingId = useId()
  const firstCandidateRef = useRef<HTMLButtonElement>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)
  // Pas useActionState : la mutation porte déjà `pending` et déclenche elle-même
  // l'invalidation du cache via useSettingsMutation, ce que useActionState ne
  // ferait pas ; et le résultat à trois issues (succès / erreur / candidats) ne
  // se réduit pas proprement à un seul retour de reducer.
  const addFeed = useAddFeed()

  // Le focus suit l'apparition du picker : un bouton qui prend le focus
  // s'annonce lui-même, avec son groupe, ce qui règle aussi l'apparition
  // silencieuse pour un lecteur d'écran.
  useEffect(() => {
    if (candidates?.length) firstCandidateRef.current?.focus()
  }, [candidates])

  // Choisir un candidat re-soumet simplement la mutation avec son URL : elle
  // repasse alors par la couche 1 côté serveur et s'insère normalement. Elle
  // le fait avec la catégorie actuellement sélectionnée, pas celle active au
  // lancement de la recherche — la fermeture capture le rendu courant, et
  // c'est le comportement voulu.
  //
  // `fromPicker` ne sert qu'à la sortie de focus ci-dessous : un succès venu
  // du picker démonte le bouton qui avait le focus (voir l'effet plus haut),
  // il faut donc le rendre explicitement ; un succès venu du formulaire normal
  // n'a jamais déplacé le focus, il n'y a rien à lui rendre.
  async function tryUrl(feedUrl: string, fromPicker: boolean) {
    if (categoryId === null || addFeed.isPending) return
    setError(null)
    try {
      const result = await addFeed.mutateAsync({ url: feedUrl, categoryId })
      // `candidates` d'abord : ce cas porte error === null sans être un succès.
      if (result.candidates) {
        setCandidates(result.candidates)
        return
      }
      if (result.error) {
        setError(result.error)
        return
      }
      setUrl('')
      setCandidates(null)
      if (fromPicker) urlInputRef.current?.focus()
    } catch {
      setError('Could not read this RSS feed')
    }
  }

  // SubmitEvent et non FormEvent : `FormEvent` est déprécié dans les types React
  // installés (« FormEvent doesn't actually exist »).
  function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    // Avant de vider la liste : sans ce garde, une entrée au clavier pendant un
    // ajout en vol ferait disparaître le picker sans rien soumettre.
    if (addFeed.isPending) return
    setCandidates(null)
    void tryUrl(url.trim(), false)
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <input
        ref={urlInputRef}
        name="url"
        type="url"
        required
        value={url}
        onChange={(e) => {
          setUrl(e.target.value)
          setCandidates(null)
          setError(null)
        }}
        placeholder="https://exemple.com"
        className="w-full rounded border border-rule bg-surface px-3 py-1.5 text-sm outline-none focus:border-foreground"
      />
      <CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} />
      {candidates?.length ? (
        <div className="space-y-2">
          <p id={candidatesHeadingId} className="mono-label text-muted">
            Several feeds found — pick one
          </p>
          <ul aria-labelledby={candidatesHeadingId} aria-busy={addFeed.isPending} className="space-y-1">
            {candidates.map((candidate, i) => (
              <li key={candidate.url}>
                <button
                  ref={i === 0 ? firstCandidateRef : undefined}
                  type="button"
                  disabled={addFeed.isPending}
                  onClick={() => void tryUrl(candidate.url, true)}
                  className="w-full rounded border border-rule bg-surface px-3 py-2 text-left transition-colors hover:text-foreground disabled:opacity-50 motion-reduce:transition-none"
                >
                  {/* Jamais vide : extractFeedLinks replie titre → chemin → hôte,
                      et platformFeeds code ses libellés en dur — invariant défini
                      dans feed-discovery.ts, comme mutations.ts documente celui,
                      structurellement identique, de formatFeed. */}
                  <span className="block truncate text-sm">{candidate.label}</span>
                  <span className="block truncate text-xs text-muted">{candidate.url}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <button
          disabled={addFeed.isPending}
          className="mono-label rounded border border-rule bg-surface px-3 py-1.5 transition-colors hover:text-foreground disabled:opacity-50 motion-reduce:transition-none"
        >
          {addFeed.isPending ? 'Adding…' : 'Add feed'}
        </button>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  )
}
