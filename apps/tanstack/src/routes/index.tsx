import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

// Placeholder : le vrai fil arrive en Task 12.
function Home() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <p className="mono-label">Feedr</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Le fil</h1>
    </main>
  )
}
