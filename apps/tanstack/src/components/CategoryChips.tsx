import { Link } from '@tanstack/react-router'

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
      {/* `search={{}}` serait un sous-ensemble de n'importe quelle URL : le routeur
          considérerait « All » actif en permanence (includeSearch est inclusif par
          défaut) et poserait aria-current sur tous les chips à la fois. Déclarer
          category explicitement undefined + explicitUndefined le rend actif
          uniquement quand aucune catégorie n'est sélectionnée. */}
      <Link
        to="/"
        search={{ category: undefined }}
        activeOptions={{ explicitUndefined: true }}
        className={tab(activeId === null)}
      >
        All
      </Link>
      {categories.map((c) => (
        <Link
          key={c.id}
          to="/"
          search={{ category: c.id }}
          className={tab(activeId === c.id)}
        >
          {c.name}
        </Link>
      ))}
    </div>
  )
}
