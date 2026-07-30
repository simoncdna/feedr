import { asc, eq } from 'drizzle-orm'
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
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="space-y-3 lg:hidden">
        <h2 className="mono-label border-b border-rule pb-2">Appearance</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm">Light / dark theme</span>
          <ThemeToggle />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Notifications</h2>
        <EnableNotifications vapidPublicKey={process.env.VAPID_PUBLIC_KEY!} />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Categories</h2>
        <ul className="space-y-2">
          {cats.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2">
              <span>{c.name}</span>
              <span className="flex items-center gap-3">
                <form action={toggleCategoryNotify.bind(null, c.id, !c.notify)}>
                  <button
                    aria-label="Toggle notifications"
                    className={`-m-2 p-2 ${c.notify ? 'text-orange-500' : 'text-neutral-400'}`}
                    title={c.notify ? 'Notifications enabled' : 'Notifications disabled'}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill={c.notify ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </form>
                <form action={deleteCategory.bind(null, c.id)}>
                  <ConfirmSubmitButton
                    ariaLabel="Delete category"
                    className="-m-2 p-2 text-neutral-400"
                    confirmMessage="Delete this category? Its feeds and articles (including bookmarked ones) will be deleted."
                  >
                    ✕
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
            className="flex-1 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
          />
          <button className="rounded-xl bg-neutral-900 px-4 font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
            +
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Feeds</h2>
        <ul className="space-y-2">
          {feedRows.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate">{f.title}</span>
                <span className="block text-xs text-neutral-500">
                  {f.categoryName}
                  {f.lastError && <span className="text-red-600"> · error: {f.lastError}</span>}
                </span>
              </span>
              <form action={deleteFeed.bind(null, f.id)}>
                <ConfirmSubmitButton
                  ariaLabel="Delete feed"
                  className="-m-2 p-2 text-neutral-400"
                  confirmMessage="Delete this feed? Its articles (including bookmarked ones) will be deleted."
                >
                  ✕
                </ConfirmSubmitButton>
              </form>
            </li>
          ))}
        </ul>
        {cats.length === 0 ? (
          <p className="text-sm text-neutral-500">Create a category first.</p>
        ) : (
          <AddFeedForm categories={cats.map(({ id, name }) => ({ id, name }))} />
        )}
      </section>
    </div>
  )
}
