import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { db } from '@/db'
import { user } from '@/db/auth-schema'
import { auth } from '@/lib/auth'
import { SignInClient } from '@/components/SignInClient'

const signInState = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  const isBootstrap = (await db.select({ id: user.id }).from(user).limit(1)).length === 0
  return { signedIn: Boolean(session), isBootstrap }
})

export const Route = createFileRoute('/sign-in')({
  loader: async () => {
    const state = await signInState()
    if (state.signedIn) throw redirect({ to: '/' })
    return state
  },
  component: SignInPage,
})

function SignInPage() {
  const { isBootstrap } = Route.useLoaderData()
  return (
    <div className="mx-auto max-w-sm px-4 pt-16">
      <p className="mono-label">Feedr</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Sign in</h1>
      <div className="mt-8">
        <SignInClient bootstrap={isBootstrap} />
      </div>
    </div>
  )
}
