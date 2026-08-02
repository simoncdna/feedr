import { useState } from 'react'
import { CategorySelect } from '@/components/CategorySelect'
import type { FeedCandidate } from '@/lib/feed-discovery'
import { useAddFeed } from '@/mutations'

export function AddFeedForm({ categories }: { categories: { id: number; name: string }[] }) {
  const [url, setUrl] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(categories[0]?.id ?? null)
  // Les messages d'erreur viennent du serveur et sont vus par l'utilisateur :
  // 'Invalid URL or category', 'Could not read this RSS feed',
  // 'This feed already exists', 'No RSS feed found at this address'.
  // Ils ne sont pas reformulés ici.
  const [error, setError] = useState<string | null>(null)
  // Plusieurs flux trouvés : le serveur nous les renvoie et attend un choix.
  const [candidates, setCandidates] = useState<FeedCandidate[] | null>(null)
  const addFeed = useAddFeed()

  // Choisir un candidat re-soumet simplement la mutation avec son URL : elle
  // repasse alors par la couche 1 côté serveur et s'insère normalement.
  async function send(feedUrl: string) {
    if (categoryId === null) return
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
    } catch {
      setError('Could not read this RSS feed')
    }
  }

  // SubmitEvent et non FormEvent : `FormEvent` est déprécié dans les types React
  // installés (« FormEvent doesn't actually exist »).
  function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setCandidates(null)
    void send(url.trim())
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <input
        name="url"
        type="url"
        required
        value={url}
        onChange={(e) => {
          setUrl(e.target.value)
          setCandidates(null)
        }}
        placeholder="https://exemple.com"
        className="w-full rounded border border-rule bg-surface px-3 py-1.5 text-sm outline-none focus:border-foreground"
      />
      <CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} />
      {candidates ? (
        <div className="space-y-2">
          <p className="mono-label text-muted">Several feeds found — pick one</p>
          <ul className="space-y-1">
            {candidates.map((candidate) => (
              <li key={candidate.url}>
                <button
                  type="button"
                  disabled={addFeed.isPending}
                  onClick={() => void send(candidate.url)}
                  className="w-full rounded border border-rule bg-surface px-3 py-2 text-left transition-colors hover:text-foreground disabled:opacity-50 motion-reduce:transition-none"
                >
                  <span className="block text-sm">{candidate.label}</span>
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
