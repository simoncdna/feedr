export default function Loading() {
  return (
    <div className="px-4 pt-6 lg:px-6 lg:pt-8">
      <div className="mono-label">Loading…</div>
      <div className="mt-6 space-y-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-5 w-3/4 rounded bg-surface" />
            <div className="h-4 w-full rounded bg-surface" />
            <div className="h-3 w-24 rounded bg-surface" />
          </div>
        ))}
      </div>
    </div>
  )
}
