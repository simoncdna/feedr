import { useState } from 'react'
import { CategorySelect } from '@/components/CategorySelect'
import { useAddFeed } from '@/mutations'

export function AddFeedForm({ categories }: { categories: { id: number; name: string }[] }) {
  const [url, setUrl] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(categories[0]?.id ?? null)
  // Les messages d'erreur viennent du serveur et sont vus par l'utilisateur :
  // 'Invalid URL or category', 'Could not read this RSS feed',
  // 'This feed already exists'. Ils ne sont pas reformulés ici.
  const [error, setError] = useState<string | null>(null)
  const addFeed = useAddFeed()

  // useActionState est propre aux Server Actions : remplacé par la mutation, qui
  // porte elle-même l'état `pending`.
  // SubmitEvent et non FormEvent : `FormEvent` est déprécié dans les types React
  // installés (« FormEvent doesn't actually exist »).
  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (categoryId === null) return
    setError(null)
    try {
      const result = await addFeed.mutateAsync({ url: url.trim(), categoryId })
      if (result.error) {
        setError(result.error)
        return
      }
      setUrl('')
    } catch {
      setError('Could not read this RSS feed')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <input
        name="url"
        type="url"
        required
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://exemple.com/feed.xml"
        className="w-full rounded border border-rule bg-surface px-3 py-1.5 text-sm outline-none focus:border-foreground"
      />
      <CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} />
      <button
        disabled={addFeed.isPending}
        className="mono-label rounded border border-rule bg-surface px-3 py-1.5 transition-colors hover:text-foreground disabled:opacity-50 motion-reduce:transition-none"
      >
        {addFeed.isPending ? 'Adding…' : 'Add feed'}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  )
}
