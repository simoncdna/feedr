'use client'

import { useActionState } from 'react'
import { addFeed, type AddFeedState } from '@/app/actions'

const initial: AddFeedState = { error: null }

export function AddFeedForm({ categories }: { categories: { id: number; name: string }[] }) {
  const [state, formAction, pending] = useActionState(addFeed, initial)
  return (
    <form action={formAction} className="space-y-2">
      <input
        name="url"
        type="url"
        required
        placeholder="https://exemple.com/feed.xml"
        className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
      />
      <select
        name="categoryId"
        required
        className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <button
        disabled={pending}
        className="rounded-xl bg-orange-500 px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {pending ? 'Adding…' : 'Add feed'}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  )
}
