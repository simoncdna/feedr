import Link from 'next/link'

export function CategoryChips({
  categories,
  activeId,
}: {
  categories: { id: number; name: string }[]
  activeId: number | null
}) {
  const chip = (active: boolean) =>
    `shrink-0 rounded border px-3 py-1 text-sm transition-colors ${
      active
        ? 'border-rule bg-surface text-foreground'
        : 'border-transparent text-muted hover:text-foreground'
    }`
  return (
    <div className="flex gap-1 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
      <Link href="/" className={chip(activeId === null)} aria-current={activeId === null ? 'page' : undefined}>
        All
      </Link>
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/?category=${c.id}`}
          className={chip(activeId === c.id)}
          aria-current={activeId === c.id ? 'page' : undefined}
        >
          {c.name}
        </Link>
      ))}
    </div>
  )
}
