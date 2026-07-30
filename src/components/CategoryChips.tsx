import Link from 'next/link'

export function CategoryChips({
  categories,
  activeId,
}: {
  categories: { id: number; name: string }[]
  activeId: number | null
}) {
  const tab = (active: boolean) =>
    `-mb-px shrink-0 border-b pb-2 text-sm transition-colors ${
      active
        ? 'border-foreground font-medium text-foreground'
        : 'border-transparent text-muted hover:text-foreground'
    }`
  return (
    <div className="flex gap-5 overflow-x-auto border-b border-rule [-webkit-overflow-scrolling:touch]">
      <Link href="/" className={tab(activeId === null)} aria-current={activeId === null ? 'page' : undefined}>
        All
      </Link>
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/?category=${c.id}`}
          className={tab(activeId === c.id)}
          aria-current={activeId === c.id ? 'page' : undefined}
        >
          {c.name}
        </Link>
      ))}
    </div>
  )
}
