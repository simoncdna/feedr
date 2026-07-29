import Link from 'next/link'

export function CategoryChips({
  categories, activeId,
}: {
  categories: { id: number; name: string }[]
  activeId: number | null
}) {
  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1 text-sm ${
      active
        ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
        : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
    }`
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
      <Link href="/" className={chip(activeId === null)}>Tout</Link>
      {categories.map((c) => (
        <Link key={c.id} href={`/?category=${c.id}`} className={chip(activeId === c.id)}>
          {c.name}
        </Link>
      ))}
    </div>
  )
}
