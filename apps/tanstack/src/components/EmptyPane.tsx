// Vivait dans ArticlePane.tsx côté Next, en un seul exemplaire : la colonne de
// détail du fil et celle des bookmarks l'utilisent toutes les deux.
export function EmptyPane({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[50dvh] items-center justify-center">
      <p className="mono-label">{label}</p>
    </div>
  )
}
