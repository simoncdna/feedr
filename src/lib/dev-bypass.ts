// Garde-fou du bypass d'authentification en développement.
//
// Isolé dans son propre module — et non dans session.ts — pour rester testable
// sans DATABASE_URL : session.ts importe @/db, qui instancie le client drizzle
// dès l'import. Un garde-fou de sécurité doit pouvoir être vérifié sans base.
//
// Deux verrous : la variable doit être explicitement posée à '1', ET on ne doit
// pas tourner sur Vercel (VERCEL=1 y est toujours défini) — donc jamais en prod.
export function devBypassAllowed(env: Record<string, string | undefined>): boolean {
  return env.DEV_AUTH_BYPASS === '1' && !env.VERCEL
}
