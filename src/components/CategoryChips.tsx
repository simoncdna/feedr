import { Link } from '@tanstack/react-router'

export function CategoryChips({
  categories,
  activeId,
}: {
  categories: { id: number; name: string }[]
  activeId: number | null
}) {
  // 44 px dans les deux dimensions, minimum Apple. Mesuré avant : « All » était
  // une cible de 16 × 29 px, placée en haut de l'écran — la zone la moins
  // atteignable au pouce — avec 20 px de vide mort entre chaque chip. Le
  // soulignement suit donc la cible et non le mot, ce qui les met tous à la même
  // largeur : c'est le compromis assumé pour une zone tactile honnête.
  const tab = (active: boolean) =>
    `-mb-px flex min-w-11 shrink-0 justify-center border-b-2 px-1 pt-3 pb-2.5 text-sm transition-colors ${
      active
        ? 'border-foreground font-medium text-foreground'
        : 'border-transparent text-muted'
    }`
  return (
    // `overflow-x: auto` force aussi `overflow-y: auto` (règle CSS : un axe en
    // `auto` ne peut pas cohabiter avec l'autre en `visible`), et Chrome y
    // dessine une barre verticale parasite. On la masque : c'est une bande
    // tactile, elle se défile au doigt.
    <div className="flex gap-2 overflow-x-auto border-b border-rule [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:[display:none]">
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
