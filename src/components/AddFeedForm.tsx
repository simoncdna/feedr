'use client'

import { useActionState } from 'react'
import { addFeed, type AddFeedState } from '@/app/actions'
import { CategorySelect } from '@/components/CategorySelect'

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
        className="w-full rounded border border-rule bg-surface px-3 py-1.5 text-sm outline-none focus:border-foreground"
      />
      <CategorySelect name="categoryId" categories={categories} />
      <button
        disabled={pending}
        className="mono-label rounded border border-rule bg-surface px-3 py-1.5 transition-colors hover:text-foreground disabled:opacity-50 motion-reduce:transition-none"
      >
        {pending ? 'Adding…' : 'Add feed'}
      </button>
      {state.error && <p className="text-sm text-red-500">{state.error}</p>}
    </form>
  )
}
