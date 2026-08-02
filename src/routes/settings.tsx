import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useSuspenseQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { AddFeedForm } from '@/components/AddFeedForm'
import { AddPasskeyButton } from '@/components/AddPasskeyButton'
import { ConfirmSubmitButton } from '@/components/ConfirmSubmitButton'
import { EnableNotifications } from '@/components/EnableNotifications'
import { InvitationsSection } from '@/components/InvitationsSection'
import { ThemeToggle } from '@/components/ThemeToggle'
import {
  useCreateCategory,
  useDeleteCategory,
  useDeleteFeed,
  useToggleCategoryNotify,
} from '@/mutations'
import { SettingsSkeleton } from '@/components/Skeletons'
import { settingsQuery } from '@/queries'
import { signOut } from '@/server/mutations'

export const Route = createFileRoute('/settings')({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(settingsQuery()),
  pendingComponent: SettingsSkeleton,
  component: SettingsPage,
})

function SettingsPage() {
  const { data } = useSuspenseQuery(settingsQuery())
  const { user, cats, feedRows, openInvites, allUsers, vapidPublicKey } = data

  const [newCategory, setNewCategory] = useState('')
  const addCategory = useCreateCategory()
  const removeCategory = useDeleteCategory()
  const notifyCategory = useToggleCategoryNotify()
  const removeFeed = useDeleteFeed()
  // signOut jette un redirect côté serveur ; la mutation le laisse remonter.
  const leave = useMutation({ mutationFn: () => signOut() })

  return (
    // Même châssis que le fil et les favoris, où il vient de ResizablePanes.
    // Sans lui, Settings ne fait pas partie de la même page : le conteneur des
    // volets est collant ET opaque, et c'est ce fond-là qui couvre la barre de
    // statut en PWA — Settings laissait son contenu défiler derrière la Dynamic
    // Island. En desktop, `h-dvh` + défilement interne évitent en plus que
    // passer d'un onglet à l'autre change le modèle de défilement (le fil ne
    // fait jamais défiler la fenêtre, Settings si).
    <div className="sticky bg-background lg:h-dvh lg:overflow-y-auto">
      {/* Domino : titre puis sections montent une à une (voir `.cascade`). Seul
          le pas est desserré — sur des blocs de cette hauteur, le cran serré des
          rangées d'articles se lit comme un seul mouvement d'ensemble et non
          comme un enchaînement. */}
      <div className="cascade space-y-12 px-4 [--cascade-pas:80ms] lg:max-w-2xl lg:px-6 lg:py-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

        <section className="space-y-3 lg:hidden">
          <h2 className="mono-label border-b border-rule pb-2">Appearance</h2>
          <div className="flex items-center justify-between">
            <span className="text-sm">Light / dark theme</span>
            <ThemeToggle />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="mono-label border-b border-rule pb-2">Categories</h2>
          <ul className="divide-y divide-rule">
            {cats.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2.5">
                <span className="text-sm">{c.name}</span>
                <span className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => notifyCategory.mutate({ id: c.id, notify: !c.notify })}
                    aria-label="Toggle notifications"
                    className={`-m-2 p-2 transition-colors ${c.notify ? 'text-accent' : 'text-muted hover:text-foreground'}`}
                    title={c.notify ? 'Notifications enabled' : 'Notifications disabled'}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill={c.notify ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <ConfirmSubmitButton
                    confirmMessage="Delete this category? Its feeds and articles (including bookmarked ones) will be deleted."
                    ariaLabel="Delete category"
                    className="-m-2 p-2 text-muted transition-colors hover:text-foreground"
                    onConfirmed={() => removeCategory.mutate(c.id)}
                  >
                    <X className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                  </ConfirmSubmitButton>
                </span>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const name = newCategory.trim()
              if (!name) return
              addCategory.mutate(name)
              setNewCategory('')
            }}
            className="flex gap-2"
          >
            <input
              name="name"
              required
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
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
                <ConfirmSubmitButton
                  confirmMessage="Delete this feed? Its articles (including bookmarked ones) will be deleted."
                  ariaLabel="Delete feed"
                  className="-m-2 p-2 text-muted transition-colors hover:text-foreground"
                  onConfirmed={() => removeFeed.mutate(f.id)}
                >
                  <X className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                </ConfirmSubmitButton>
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
          <h2 className="mono-label border-b border-rule pb-2">Notifications</h2>
          <EnableNotifications vapidPublicKey={vapidPublicKey} />
        </section>

        <section className="space-y-4">
          <h2 className="mono-label border-b border-rule pb-2">Account</h2>
          <p className="text-sm">{user.name}</p>
          <AddPasskeyButton />
          <button
            type="button"
            onClick={() => leave.mutate()}
            className="mono-label rounded border border-rule bg-surface px-3 py-1.5 transition-colors hover:text-foreground motion-reduce:transition-none"
          >
            Sign out
          </button>
        </section>

        {user.role === 'owner' && (
          <section className="space-y-4">
            <h2 className="mono-label border-b border-rule pb-2">Invitations</h2>
            <InvitationsSection invitations={openInvites} users={allUsers} />
          </section>
        )}
      </div>
    </div>
  )
}
