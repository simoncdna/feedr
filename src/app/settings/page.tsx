import {
  and, asc, desc, eq, gt, isNull,
} from 'drizzle-orm'
import { X } from 'lucide-react'
import { db } from '@/db'
import { categories, feeds, invitations } from '@/db/schema'
import { user as authUser } from '@/db/auth-schema'
import {
  createCategory, deleteCategory, deleteFeed, signOutAction, toggleCategoryNotify,
} from '@/app/actions'
import { AddFeedForm } from '@/components/AddFeedForm'
import { AddPasskeyButton } from '@/components/AddPasskeyButton'
import { ConfirmSubmitButton } from '@/components/ConfirmSubmitButton'
import { Diagnostics } from '@/components/Diagnostics'
import { EnableNotifications } from '@/components/EnableNotifications'
import { InvitationsSection } from '@/components/InvitationsSection'
import { ThemeToggle } from '@/components/ThemeToggle'
import { invitationStatus } from '@/lib/invitations'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await requireUser()
  const cats = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, user.id))
    .orderBy(asc(categories.name))
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
    .where(eq(categories.userId, user.id))
    .orderBy(asc(categories.name), asc(feeds.title))

  const openInvites = user.role === 'owner'
    ? (await db
      .select()
      .from(invitations)
      .where(and(
        eq(invitations.createdBy, user.id),
        isNull(invitations.usedAt),
        gt(invitations.expiresAt, new Date()),
      ))
      .orderBy(desc(invitations.createdAt))).map((inv) => ({ ...inv, status: invitationStatus(inv) }))
    : []
  const allUsers = user.role === 'owner'
    ? await db.select({ id: authUser.id, name: authUser.name }).from(authUser)
    : []

  return (
    <div className="space-y-12 px-4 lg:max-w-2xl lg:px-8 lg:py-8">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      <section className="space-y-3 lg:hidden">
        <h2 className="mono-label border-b border-rule pb-2">Appearance</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm">Light / dark theme</span>
          <ThemeToggle />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="mono-label border-b border-rule pb-2">Account</h2>
        <p className="text-sm">{user.name}</p>
        <AddPasskeyButton />
        <form action={signOutAction}>
          <button className="mono-label rounded border border-rule bg-surface px-3 py-1.5 transition-colors hover:text-foreground motion-reduce:transition-none">
            Sign out
          </button>
        </form>
      </section>

      {user.role === 'owner' && (
        <section className="space-y-4">
          <h2 className="mono-label border-b border-rule pb-2">Invitations</h2>
          <InvitationsSection invitations={openInvites} users={allUsers} />
        </section>
      )}

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

      <section className="space-y-4">
        <h2 id="diagnostics" className="mono-label scroll-mt-4 border-b border-rule pb-2">Diagnostics</h2>
        <Diagnostics />
      </section>
    </div>
  )
}
