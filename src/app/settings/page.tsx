import { asc, eq } from 'drizzle-orm'
import { X } from 'lucide-react'
import { db } from '@/db'
import { categories, feeds } from '@/db/schema'
import {
  createCategory, deleteCategory, deleteFeed, toggleCategoryNotify,
} from '@/app/actions'
import { AddFeedForm } from '@/components/AddFeedForm'
import { ConfirmSubmitButton } from '@/components/ConfirmSubmitButton'
import { EnableNotifications } from '@/components/EnableNotifications'
import { ThemeToggle } from '@/components/ThemeToggle'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const cats = await db.select().from(categories).orderBy(asc(categories.name))
  const feedRows = await db
    .select({
      id: feeds.id,
      url: feeds.url,
      title: feeds.title,
      lastError: feeds.lastError,
      categoryName: categories.name,
    })
    .from(feeds)
    .innerJoin(categories, eq(feeds.categoryId, categories.id))
    .orderBy(asc(categories.name), asc(feeds.title))

  return (
    <div className="space-y-12 lg:max-w-2xl lg:px-8 lg:py-8">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      <section className="space-y-3 lg:hidden">
        <h2 className="mono-label border-b border-rule pb-2">Appearance</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm">Light / dark theme</span>
          <ThemeToggle />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="mono-label border-b border-rule pb-2">Notifications</h2>
        <EnableNotifications vapidPublicKey={process.env.VAPID_PUBLIC_KEY!} />
      </section>

      <section className="space-y-4">
        <h2 className="mono-label border-b border-rule pb-2">Categories</h2>
        <ul className="divide-y divide-rule">
          {cats.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 py-2.5">
              <span className="text-sm">{c.name}</span>
              <span className="flex items-center gap-4">
                <form action={toggleCategoryNotify.bind(null, c.id, !c.notify)}>
                  <button
                    aria-label="Toggle notifications"
                    className={`-m-2 p-2 transition-colors ${c.notify ? 'text-accent' : 'text-muted hover:text-foreground'}`}
                    title={c.notify ? 'Notifications enabled' : 'Notifications disabled'}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill={c.notify ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </form>
                <form action={deleteCategory.bind(null, c.id)}>
                  <ConfirmSubmitButton
                    confirmMessage="Delete this category? Its feeds and articles (including bookmarked ones) will be deleted."
                    ariaLabel="Delete category"
                    className="-m-2 p-2 text-muted transition-colors hover:text-foreground"
                  >
                    <X className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                  </ConfirmSubmitButton>
                </form>
              </span>
            </li>
          ))}
        </ul>
        <form action={createCategory} className="flex gap-2">
          <input
            name="name"
            required
            placeholder="New category"
            className="flex-1 rounded border border-rule bg-surface px-3 py-1.5 text-sm outline-none focus:border-foreground"
          />
          <button className="mono-label rounded border border-rule bg-surface px-3 py-1.5 transition-colors hover:text-foreground motion-reduce:transition-none">
            Add
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="mono-label border-b border-rule pb-2">Feeds</h2>
        <ul className="divide-y divide-rule">
          {feedRows.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 py-2.5">
              <span className="min-w-0">
                <span className="block truncate text-sm">{f.title}</span>
                <span className="mono-label block">
                  {f.categoryName}
                  {f.lastError && <span className="text-red-500"> · error: {f.lastError}</span>}
                </span>
              </span>
              <form action={deleteFeed.bind(null, f.id)}>
                <ConfirmSubmitButton
                  confirmMessage="Delete this feed? Its articles (including bookmarked ones) will be deleted."
                  ariaLabel="Delete feed"
                  className="-m-2 p-2 text-muted transition-colors hover:text-foreground"
                >
                  <X className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                </ConfirmSubmitButton>
              </form>
            </li>
          ))}
        </ul>
        {cats.length === 0 ? (
          <p className="text-sm text-muted">Create a category first.</p>
        ) : (
          <AddFeedForm categories={cats.map(({ id, name }) => ({ id, name }))} />
        )}
      </section>
    </div>
  )
}
