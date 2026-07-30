import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { user } from '@/db/auth-schema'
import { auth } from '@/lib/auth'
import { SignInClient } from '@/components/SignInClient'

export const dynamic = 'force-dynamic'

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session) redirect('/')

  const isBootstrap = (await db.select({ id: user.id }).from(user).limit(1)).length === 0

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
